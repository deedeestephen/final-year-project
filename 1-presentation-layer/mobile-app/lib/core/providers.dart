import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/application/session_controller.dart';
import '../features/auth/data/auth_repository.dart';
import 'config/app_env.dart';
import 'db/app_database.dart';
import 'db/local_store.dart';
import 'network/api_client.dart';
import 'storage/token_store.dart';

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
  (ref) => LocalStore(ref.watch(appDatabaseProvider)),
);
