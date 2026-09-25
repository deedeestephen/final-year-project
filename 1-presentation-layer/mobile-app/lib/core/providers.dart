import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../features/auth/application/session_controller.dart';
import '../features/auth/data/auth_repository.dart';
import 'config/app_env.dart';
import 'db/app_database.dart';
import 'db/local_store.dart';
import 'network/api_client.dart';
import 'storage/token_store.dart';
import 'uploads/upload_queue.dart';

/// Dependency wiring. Tests override these providers with fakes.
final tokenStoreProvider = Provider<TokenStore>((ref) => SecureTokenStore());

/// Null uses Dio's platform adapter; tests supply a scripted fake server.
final httpAdapterProvider = Provider<HttpClientAdapter?>((ref) => null);

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    baseUrl: AppEnv.apiRoot,
    tokenStore: ref.watch(tokenStoreProvider),
    adapter: ref.watch(httpAdapterProvider),
    onSessionExpired: () =>
        ref.read(sessionControllerProvider.notifier).sessionExpired(),
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(apiClientProvider),
    ref.watch(tokenStoreProvider),
  );
});

/// The encrypted on-device database, opened in `main()` before the app starts
/// (tests supply an in-memory one).
final appDatabaseProvider = Provider<AppDatabase>(
  (ref) => throw UnimplementedError('appDatabaseProvider must be overridden'),
);

final localStoreProvider = Provider<LocalStore>(
  (ref) => LocalStore(
    ref.watch(appDatabaseProvider),
    // Sign-out and a change of user also delete the queued file copies.
    onWipe: () => ref.read(uploadQueueProvider).deleteAllFiles(),
  ),
);

/// Where queued image and slide files are kept until uploaded (app-private).
/// Tests point this at a temporary folder.
final uploadDirectoryProvider = Provider<Future<Directory> Function()>(
  (ref) =>
      () async => Directory(
        p.join((await getApplicationSupportDirectory()).path, 'uploads'),
      ),
);

final uploadQueueProvider = Provider<UploadQueue>((ref) {
  final queue = UploadQueue(
    db: ref.watch(appDatabaseProvider),
    api: ref.watch(apiClientProvider),
    directory: ref.watch(uploadDirectoryProvider),
  );
  ref.onDispose(queue.dispose);
  return queue;
});
