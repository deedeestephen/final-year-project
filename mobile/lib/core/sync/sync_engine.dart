import 'dart:async';
import 'dart:convert';
import 'dart:math';

import '../db/app_database.dart';
import '../db/local_store.dart';
import '../network/api_client.dart';
import '../network/api_exception.dart';

enum SyncPhase { idle, syncing, offline, failed }

/// What the engine is doing, for the status badge and the Sync screen.
class SyncActivity {
  const SyncActivity({
    this.phase = SyncPhase.idle,
    this.lastSyncAt,
    this.lastError,
    this.nextAttemptAt,
  });

  final SyncPhase phase;
  final DateTime? lastSyncAt;
  final String? lastError;
  final DateTime? nextAttemptAt;
}

enum SyncOutcome { completed, skipped, offline, failed }

/// Sends queued changes (`POST /sync`) and downloads changes from the server
/// (`GET /sync/changes`). One run at a time; after a failure it waits with
/// exponential backoff (2 s doubling, max 15 min, with jitter) unless the
/// user asks to sync now.
class SyncEngine {
  SyncEngine({
    required this.store,
    required this.api,
    this.batchSize = 50,
    DateTime Function()? now,
    Random? random,
  }) : _now = now ?? DateTime.now,
       _random = random ?? Random();

  static const maxBackoff = Duration(minutes: 15);
  static const _maxBatchesPerRun = 20;
  static const _maxPullPages = 50;

  final LocalStore store;
  final ApiClient api;
  final int batchSize;
  final DateTime Function() _now;
  final Random _random;

  final _activity = StreamController<SyncActivity>.broadcast();
  SyncActivity _current = const SyncActivity();
  Future<SyncOutcome>? _running;
  int _failures = 0;
  DateTime? _nextAttemptAt;
  bool _recovered = false;

  SyncActivity get activity => _current;
  Stream<SyncActivity> get activityStream => _activity.stream;

  /// Delay before the next automatic attempt after [failures] failures.
  Duration backoffFor(int failures) {
    final base = const Duration(seconds: 2) * pow(2, min(failures - 1, 20));
    final capped = base > maxBackoff ? maxBackoff : base;
    // Jitter between 50% and 100% so many devices do not retry together.
    return capped * (0.5 + _random.nextDouble() * 0.5);
  }

  /// Runs a sync unless one is running (then joins it) or the backoff has
  /// not passed. [force] ignores the backoff ("Sync now").
  Future<SyncOutcome> sync({bool force = false}) {
    final running = _running;
    if (running != null) return running;
    final wait = _nextAttemptAt;
    if (!force && wait != null && _now().isBefore(wait)) {
      return Future.value(SyncOutcome.skipped);
    }
    final run = _run().whenComplete(() => _running = null);
    _running = run;
    return run;
  }

  Future<SyncOutcome> _run() async {
    _emit(SyncPhase.syncing);
    if (!_recovered) {
      await store.recoverInterrupted();
      _recovered = true;
    }
    List<OutboxData> inFlight = const [];
    try {
      final deviceId = await store.deviceId();
      for (var i = 0; i < _maxBatchesPerRun; i++) {
        inFlight = await store.takeBatch(batchSize);
        if (inFlight.isEmpty) break;
        await _push(deviceId, inFlight);
        inFlight = const [];
      }
      await _pull();

      final finished = _now();
      _failures = 0;
      _nextAttemptAt = null;
      await store.setMeta(
        MetaKey.lastSyncAt,
        finished.toUtc().toIso8601String(),
      );
      _emit(SyncPhase.idle, lastSyncAt: finished);
      return SyncOutcome.completed;
    } catch (e) {
      if (inFlight.isNotEmpty) {
        await store.releaseBatch(inFlight.map((o) => o.seq));
      }
      _failures++;
      _nextAttemptAt = _now().add(backoffFor(_failures));
      final offline = e is ApiException && e.isNetwork;
      _emit(
        offline ? SyncPhase.offline : SyncPhase.failed,
        error: e is ApiException
            ? e.message
            : 'Sync failed. It will try again.',
      );
      return offline ? SyncOutcome.offline : SyncOutcome.failed;
    }
  }

  Future<void> _push(String deviceId, List<OutboxData> ops) async {
    final operations = <Map<String, Object?>>[];
    for (final op in ops) {
      final refs = await store.references(op);
      operations.add({
        'idempotencyKey': op.idempotencyKey,
        'entityType': op.entityType,
        'operation': op.operation,
        if (refs.entityId != null && op.operation == 'UPDATE')
          'entityId': refs.entityId,
        if (refs.patientId != null) 'patientId': refs.patientId,
        if (op.baseVersion != null) 'baseVersion': op.baseVersion,
        'clientTimestamp': op.createdAt.toUtc().toIso8601String(),
        'payload': jsonDecode(op.payload),
      });
    }
    final body = await api.post<Map<String, dynamic>>(
      '/sync',
      data: {'deviceId': deviceId, 'operations': operations},
    );
    final results = (body['results'] as List).cast<Map<String, dynamic>>();
    for (var i = 0; i < ops.length; i++) {
      await store.applyResult(ops[i], SyncOpResult.fromJson(results[i]));
    }
  }

  Future<void> _pull() async {
    var cursor = await store.meta(MetaKey.cursor);
    for (var page = 0; page < _maxPullPages; page++) {
      final body = await api.get<Map<String, dynamic>>(
        '/sync/changes',
        query: {'limit': 200, if (cursor != null) 'cursor': cursor},
      );
      await store.mergePulled(
        (body['patients'] as List).cast<Map<String, dynamic>>(),
        (body['clinicalRecords'] as List).cast<Map<String, dynamic>>(),
      );
      cursor = body['cursor'] as String;
      await store.setMeta(MetaKey.cursor, cursor);
      if (body['hasMore'] != true) break;
    }
  }

  void _emit(SyncPhase phase, {DateTime? lastSyncAt, String? error}) {
    _current = SyncActivity(
      phase: phase,
      lastSyncAt: lastSyncAt ?? _current.lastSyncAt,
      lastError: phase == SyncPhase.idle ? null : error ?? _current.lastError,
      nextAttemptAt: _nextAttemptAt,
    );
    if (!_activity.isClosed) _activity.add(_current);
  }

  Future<void> dispose() => _activity.close();
}
