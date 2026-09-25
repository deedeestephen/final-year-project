import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/application/session_controller.dart';
import '../../shared/widgets/sync_status_badge.dart';
import '../connectivity/connectivity_service.dart';
import '../db/local_store.dart';
import '../providers.dart';
import 'sync_engine.dart';

final syncEngineProvider = Provider<SyncEngine>((ref) {
  final engine = SyncEngine(
    store: ref.watch(localStoreProvider),
    api: ref.watch(apiClientProvider),
  );
  ref.onDispose(engine.dispose);
  return engine;
});

final syncCountsProvider = StreamProvider<SyncCounts>(
  (ref) => ref.watch(localStoreProvider).watchCounts(),
);

final syncActivityProvider = StreamProvider<SyncActivity>((ref) async* {
  final engine = ref.watch(syncEngineProvider);
  yield engine.activity;
  yield* engine.activityStream;
});

/// One status for the whole device, shown in app bars.
final deviceSyncStatusProvider = Provider<SyncStatus>((ref) {
  final counts = ref.watch(syncCountsProvider).value ?? const SyncCounts();
  final activity =
      ref.watch(syncActivityProvider).value ?? const SyncActivity();
  if (activity.phase == SyncPhase.syncing && counts.pending > 0) {
    return Syncing(counts.pending);
  }
  if (counts.pending > 0) return const SavedOffline();
  return const Synced();
});

/// Starts syncing while a clinical user is signed in: straight away, when the
/// connection returns, when the app comes back to the foreground, and every
/// five minutes. Watched by the app root.
final syncSchedulerProvider = Provider<void>((ref) {
  final session = ref.watch(sessionControllerProvider);
  if (session is! SignedIn ||
      !session.user.canSync ||
      session.user.mustChangePassword) {
    return;
  }
  final engine = ref.watch(syncEngineProvider);
  final uploads = ref.watch(uploadQueueProvider);
  // Records first (a patient must exist on the server), then queued files.
  void run() => unawaited(engine.sync().then((_) => uploads.process()));

  final timer = Timer.periodic(const Duration(minutes: 5), (_) => run());
  ref.onDispose(timer.cancel);

  ref.listen(onlineProvider, (previous, next) {
    if (next.value == true && previous?.value != true) run();
  });

  final lifecycle = AppLifecycleListener(onResume: run);
  ref.onDispose(lifecycle.dispose);

  scheduleMicrotask(run);
});
