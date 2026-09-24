import 'dart:convert';
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/core/db/app_database.dart';
import 'package:pca_mhealth/core/db/local_store.dart';
import 'package:pca_mhealth/core/network/api_client.dart';
import 'package:pca_mhealth/core/sync/sync_engine.dart';

import '../support/app_harness.dart';
import '../support/fakes.dart';
import '../support/test_db.dart';

const draft = PatientDraft(
  givenName: ' SYNTHETIC ',
  familyName: 'Banda',
  dateOfBirth: '1960-05-01',
  regionClass: 'RURAL',
  phone: '+260971234567',
  nationalId: '123456/78/1',
);
const record = RecordDraft(
  encounterDate: '2026-09-01',
  dreFinding: 'NORMAL',
  psaNgMl: 5.2,
);

Map<String, dynamic> serverPatient({
  required String id,
  String? clientUuid,
  String familyName = 'Banda',
  int version = 1,
}) => {
  'id': id,
  'mrn': 'PCA-2026-000001',
  'givenName': 'SYNTHETIC',
  'familyName': familyName,
  'ageYears': 66,
  'regionClass': 'RURAL',
  'version': version,
  'facilityId': 'f-1',
  'nationalIdMasked': '*******78/1',
  'phone': '+260971234567',
  'dateOfBirth': '1960-05-01',
  'district': null,
  'accountUserId': null,
  'isSynthetic': true,
  'clientUuid': clientUuid,
  'createdAt': '2026-09-01T10:00:00.000Z',
  'updatedAt': '2026-09-01T10:00:00.000Z',
};

void main() {
  late AppDatabase db;
  late LocalStore store;
  late FakeBackend backend;
  late SyncEngine engine;
  late DateTime clock;

  /// The fake server: records every /sync batch and answers from [respond].
  late List<Map<String, dynamic>> Function(List<Map<String, dynamic>> ops)
  respond;
  final batches = <List<Map<String, dynamic>>>[];
  var changes = <Map<String, dynamic>>[
    {'patients': [], 'clinicalRecords': [], 'cursor': 'c1', 'hasMore': false},
  ];

  Map<String, dynamic> applied(
    Map<String, dynamic> op,
    String id, [
    int v = 1,
  ]) => {
    'idempotencyKey': op['idempotencyKey'],
    'result': 'APPLIED',
    'entityType': op['entityType'],
    'entityId': id,
    'version': v,
    'replayed': false,
  };

  setUp(() {
    db = memoryDatabase();
    clock = DateTime(2026, 9, 24, 9);
    store = LocalStore(db, now: () => clock);
    backend = FakeBackend();
    batches.clear();
    changes = [
      {'patients': [], 'clinicalRecords': [], 'cursor': 'c1', 'hasMore': false},
    ];
    var n = 0;
    respond = (ops) => [for (final op in ops) applied(op, 'srv-${++n}')];
    backend.routes['POST /sync'] = (r) async {
      final ops = ((r.body as Map)['operations'] as List)
          .cast<Map<String, dynamic>>();
      batches.add(ops);
      return FakeResponse(200, {
        'results': respond(ops),
        'serverTime': '2026-09-24T09:00:00Z',
      });
    };
    backend.routes['GET /sync/changes'] = (_) async => FakeResponse(
      200,
      changes.length > 1 ? changes.removeAt(0) : changes.first,
    );
    final store0 = InMemoryTokenStore()..tokens = savedTokens;
    engine = SyncEngine(
      store: store,
      api: ApiClient(
        baseUrl: 'http://test/api/v1',
        tokenStore: store0,
        adapter: backend.adapter,
      ),
      now: () => clock,
      random: Random(1),
      batchSize: 2,
    );
  });

  tearDown(() async {
    await engine.dispose();
    await db.close();
  });

  Future<List<LocalPatient>> patients() => store.watchPatients().first;

  group('LocalStore', () {
    test(
      'registering saves the patient and queues it with a client id',
      () async {
        final p = await store.registerPatient(draft);
        expect(p.givenName, 'SYNTHETIC');
        expect(p.syncState, RowSync.pending);
        expect(p.nationalIdMasked, '*******78/1');
        expect(p.serverId, isNull);

        final op = (await db.select(db.outbox).get()).single;
        expect(op.operation, 'CREATE');
        final payload = jsonDecode(op.payload) as Map<String, dynamic>;
        expect(payload['clientUuid'], p.id);
        expect(payload['nationalId'], '123456/78/1');
        expect(
          payload.containsKey('district'),
          isFalse,
          reason: 'no nulls sent',
        );
        expect((await store.counts()).pending, 1);
      },
    );

    test('search matches names and MRN, case-insensitively', () async {
      await store.registerPatient(draft);
      await store.registerPatient(
        const PatientDraft(
          givenName: 'Other',
          familyName: 'Phiri',
          dateOfBirth: '1955-01-01',
          regionClass: 'URBAN',
        ),
      );
      expect(
        (await store.watchPatients(query: 'band').first).single.familyName,
        'Banda',
      );
      expect(await store.watchPatients(query: 'zzz').first, isEmpty);
      expect(await patients(), hasLength(2));
    });

    test('editing is only allowed once the server has the patient', () async {
      final p = await store.registerPatient(draft);
      expect(
        () => store.updatePatient(
          p.id,
          const PatientChanges(phone: '+260977000000'),
        ),
        throwsStateError,
      );
    });

    test('several edits before a sync become one update', () async {
      final p = await store.registerPatient(draft);
      await engine.sync();
      await store.updatePatient(
        p.id,
        const PatientChanges(phone: '+260977000000'),
      );
      await store.updatePatient(
        p.id,
        const PatientChanges(district: 'Chongwe'),
      );
      final ops = await db.select(db.outbox).get();
      expect(ops, hasLength(1));
      expect(ops.single.baseVersion, 1);
      expect(jsonDecode(ops.single.payload), {
        'phone': '+260977000000',
        'district': 'Chongwe',
      });
    });

    test(
      'a different user signing in removes the previous user data',
      () async {
        await store.prepareFor('user-a');
        await store.registerPatient(draft);
        await store.cacheUser({'id': 'user-a'});
        final device = await store.deviceId();

        await store.prepareFor('user-a');
        expect(await patients(), hasLength(1), reason: 'same user keeps data');

        await store.prepareFor('user-b');
        expect(await patients(), isEmpty);
        expect(await db.select(db.outbox).get(), isEmpty);
        expect(await store.cachedUser(), isNull);
        expect(await store.deviceId(), device, reason: 'device id is kept');
      },
    );
  });

  group('SyncEngine push', () {
    test(
      'sends a patient and its record, maps server ids, then pulls',
      () async {
        final p = await store.registerPatient(draft);
        final r = await store.addRecord(p.id, record);

        expect(await engine.sync(), SyncOutcome.completed);

        final sent = batches.single;
        expect(sent.map((o) => o['entityType']), [
          'patient',
          'clinical_record',
        ]);
        expect(
          sent[1]['patientId'],
          p.id,
          reason: 'offline patient referenced by clientUuid',
        );
        expect(sent[0].containsKey('entityId'), isFalse);

        final synced = (await patients()).single;
        expect(synced.serverId, 'srv-1');
        expect(synced.version, 1);
        expect(synced.syncState, RowSync.synced);
        final rec = (await store.watchRecords(synced).first).single;
        expect(rec.id, r.id);
        expect(rec.serverId, 'srv-2');
        expect(rec.patientServerId, 'srv-1');
        expect(rec.syncState, RowSync.synced);
        expect(await db.select(db.outbox).get(), isEmpty);
        expect(await store.meta(MetaKey.cursor), 'c1');
        expect(await store.meta(MetaKey.lastSyncAt), isNotNull);
      },
    );

    test('sends in batches, oldest first', () async {
      for (var i = 0; i < 5; i++) {
        await store.registerPatient(draft);
      }
      await engine.sync();
      expect(batches.map((b) => b.length), [2, 2, 1]);
    });

    test('records use the server id once the patient is synced', () async {
      final p = await store.registerPatient(draft);
      await engine.sync();
      await store.addRecord(p.id, record);
      await engine.sync();
      expect(batches.last.single['patientId'], 'srv-1');
    });

    test(
      'an update carries the entity and the version it was based on',
      () async {
        final p = await store.registerPatient(draft);
        await engine.sync();
        await store.updatePatient(
          p.id,
          const PatientChanges(familyName: 'Mwale'),
        );
        respond = (ops) => [applied(ops.single, 'srv-1', 2)];
        await engine.sync();
        final sent = batches.last.single;
        expect(sent['operation'], 'UPDATE');
        expect(sent['entityId'], 'srv-1');
        expect(sent['baseVersion'], 1);
        expect(sent['payload'], {'familyName': 'Mwale'});
        final after = (await patients()).single;
        expect(after.version, 2);
        expect(after.syncState, RowSync.synced);
      },
    );

    test('offline: nothing is lost, and it retries after a backoff', () async {
      await store.registerPatient(draft);
      backend.isOffline = true;

      expect(await engine.sync(), SyncOutcome.offline);
      expect(engine.activity.phase, SyncPhase.offline);
      final op = (await db.select(db.outbox).get()).single;
      expect(op.status, 'pending');
      expect(op.attempts, 1);

      backend.isOffline = false;
      expect(
        await engine.sync(),
        SyncOutcome.skipped,
        reason: 'still in backoff',
      );
      clock = clock.add(const Duration(seconds: 3));
      expect(await engine.sync(), SyncOutcome.completed);
      expect(await db.select(db.outbox).get(), isEmpty);
    });

    test('a rate-limited server is not retried before Retry-After', () async {
      await store.registerPatient(draft);
      backend.routes['POST /sync'] = (_) async => const FakeResponse(
        429,
        {
          'error': {
            'status': 429,
            'code': 'RATE_LIMITED',
            'message': 'Too many requests',
          },
        },
        {'retry-after': '120'},
      );
      expect(await engine.sync(), SyncOutcome.failed);
      clock = clock.add(const Duration(seconds: 60));
      expect(
        await engine.sync(),
        SyncOutcome.skipped,
        reason: 'server asked for 120 s',
      );
      clock = clock.add(const Duration(seconds: 61));
      backend.routes.remove('POST /sync');
      backend.routes['POST /sync'] = (r) async => FakeResponse(200, {
        'results': [
          for (final op
              in ((r.body as Map)['operations'] as List)
                  .cast<Map<String, dynamic>>())
            applied(op, 'srv-9'),
        ],
        'serverTime': '2026-09-24T09:00:00Z',
      });
      expect(await engine.sync(), SyncOutcome.completed);
    });

    test('"Sync now" ignores the backoff', () async {
      await store.registerPatient(draft);
      backend.isOffline = true;
      await engine.sync();
      backend.isOffline = false;
      expect(await engine.sync(force: true), SyncOutcome.completed);
    });

    test('backoff doubles, is capped at 15 minutes and has jitter', () {
      final delays = [for (var f = 1; f <= 12; f++) engine.backoffFor(f)];
      final ms = delays.map((d) => d.inMilliseconds).toList();
      expect(ms.first, inInclusiveRange(1000, 2000));
      expect(ms[3], inInclusiveRange(8000, 16000));
      for (final d in delays) {
        expect(d, lessThanOrEqualTo(SyncEngine.maxBackoff));
      }
      expect(delays.last, greaterThanOrEqualTo(SyncEngine.maxBackoff * 0.5));
    });

    test('concurrent calls share one run', () async {
      await store.registerPatient(draft);
      final a = engine.sync();
      final b = engine.sync();
      expect(await a, SyncOutcome.completed);
      expect(await b, SyncOutcome.completed);
      expect(batches, hasLength(1));
    });

    test('a server error keeps the batch and reports failure', () async {
      await store.registerPatient(draft);
      backend.routes['POST /sync'] = (_) async => FakeResponse.error(
        503,
        'SERVICE_UNAVAILABLE',
        'Down for maintenance',
      );
      expect(await engine.sync(), SyncOutcome.failed);
      expect(engine.activity.lastError, 'Down for maintenance');
      expect((await db.select(db.outbox).get()).single.status, 'pending');
    });

    test('interrupted sends are recovered on the next run', () async {
      await store.registerPatient(draft);
      await store.takeBatch(10); // app killed mid-send
      expect(await engine.sync(), SyncOutcome.completed);
      expect(batches.single, hasLength(1));
    });

    test('a refused change is kept for the user and not retried', () async {
      await store.registerPatient(draft);
      respond = (ops) => [
        {
          'idempotencyKey': ops.single['idempotencyKey'],
          'result': 'REJECTED',
          'entityType': 'patient',
          'replayed': false,
          'error': {
            'code': 'DUPLICATE_PATIENT',
            'message': 'Already registered',
          },
        },
      ];
      await engine.sync();
      final op = (await store.watchRejected().first).single;
      expect(op.lastErrorCode, 'DUPLICATE_PATIENT');
      expect((await patients()).single.syncState, RowSync.rejected);
      expect((await store.counts()).rejected, 1);

      await engine.sync(force: true);
      expect(batches, hasLength(1), reason: 'rejected changes are not resent');

      await store.discardRejected(op.seq);
      expect(await patients(), isEmpty);
      expect(
        await store.counts(),
        isA<SyncCounts>().having((c) => c.pending + c.rejected, 'total', 0),
      );
    });

    test('a record waits when its patient failed in the same batch', () async {
      final p = await store.registerPatient(draft);
      await store.addRecord(p.id, record);
      respond = (ops) => [
        {
          'idempotencyKey': ops[0]['idempotencyKey'],
          'result': 'REJECTED',
          'entityType': 'patient',
          'replayed': false,
          'error': {'code': 'VALIDATION_FAILED', 'message': 'bad'},
        },
        {
          'idempotencyKey': ops[1]['idempotencyKey'],
          'result': 'REJECTED',
          'entityType': 'clinical_record',
          'replayed': false,
          'error': {'code': 'DEPENDENCY_FAILED', 'message': 'patient failed'},
        },
      ];
      await engine.sync();
      final ops = await db.select(db.outbox).get();
      expect(ops.map((o) => o.status), ['rejected', 'pending']);
    });
  });

  group('conflicts', () {
    Future<LocalPatient> editedConflict() async {
      final p = await store.registerPatient(draft);
      await engine.sync();
      await store.updatePatient(
        p.id,
        const PatientChanges(familyName: 'Mwale'),
      );
      respond = (ops) => [
        {
          'idempotencyKey': ops.single['idempotencyKey'],
          'result': 'CONFLICT',
          'entityType': 'patient',
          'entityId': 'srv-1',
          'version': 2,
          'replayed': false,
          'error': {'code': 'VERSION_CONFLICT', 'message': 'changed'},
          'server': serverPatient(
            id: 'srv-1',
            clientUuid: p.id,
            familyName: 'Phiri',
            version: 2,
          ),
        },
      ];
      await engine.sync();
      return (await patients()).single;
    }

    test('a stale edit becomes a conflict with both versions kept', () async {
      final p = await editedConflict();
      expect(p.syncState, RowSync.conflict);
      expect(p.familyName, 'Mwale', reason: 'local edit is not thrown away');
      final c = (await store.watchConflicts().first).single;
      expect(jsonDecode(c.localChanges), {'familyName': 'Mwale'});
      expect((jsonDecode(c.serverCopy) as Map)['familyName'], 'Phiri');
      expect(c.serverVersion, 2);
    });

    test('keep the server copy', () async {
      await editedConflict();
      final c = (await store.watchConflicts().first).single;
      await store.resolveKeepServer(c.id);
      final p = (await patients()).single;
      expect(p.familyName, 'Phiri');
      expect(p.version, 2);
      expect(p.syncState, RowSync.synced);
      expect(await store.watchConflicts().first, isEmpty);
    });

    test('keep mine re-applies the edit on the new version', () async {
      await editedConflict();
      final c = (await store.watchConflicts().first).single;
      await store.resolveKeepMine(c.id);
      respond = (ops) => [applied(ops.single, 'srv-1', 3)];
      await engine.sync();
      final sent = batches.last.single;
      expect(sent['baseVersion'], 2);
      expect(sent['payload'], {'familyName': 'Mwale'});
      final p = (await patients()).single;
      expect(p.version, 3);
      expect(p.syncState, RowSync.synced);
    });
  });

  group('pull', () {
    test('downloads new patients and records, following pages', () async {
      changes = [
        {
          'patients': [serverPatient(id: 'srv-a')],
          'clinicalRecords': [],
          'cursor': 'c1',
          'hasMore': true,
        },
        {
          'patients': [],
          'clinicalRecords': [
            {
              'id': 'rec-a',
              'patientId': 'srv-a',
              'clientUuid': null,
              'encounterDate': '2026-08-01',
              'psaNgMl': 4.1,
              'freePsaNgMl': null,
              'dreFinding': 'NODULAR',
              'piradsScore': 3,
              'prostateVolumeMl': 40,
              'notes': null,
              'createdAt': '2026-08-01T08:00:00.000Z',
            },
          ],
          'cursor': 'c2',
          'hasMore': false,
        },
      ];
      await engine.sync();
      final p = (await patients()).single;
      expect(p.id, 'srv-a');
      expect(p.syncState, RowSync.synced);
      final rec = (await store.watchRecords(p).first).single;
      expect(rec.dreFinding, 'NODULAR');
      expect(rec.prostateVolumeMl, 40);
      expect(await store.meta(MetaKey.cursor), 'c2');
    });

    test(
      'server copies replace synced rows but never unsent local edits',
      () async {
        final p = await store.registerPatient(draft);
        await engine.sync();
        changes = [
          {
            'patients': [
              serverPatient(
                id: 'srv-1',
                clientUuid: p.id,
                familyName: 'Tembo',
                version: 2,
              ),
            ],
            'clinicalRecords': [],
            'cursor': 'c3',
            'hasMore': false,
          },
        ];
        await engine.sync();
        expect((await patients()).single.familyName, 'Tembo');

        await store.updatePatient(
          p.id,
          const PatientChanges(familyName: 'Local'),
        );
        backend.routes['POST /sync'] = (_) async => const FakeResponse(503, {});
        await store.mergePulled([
          serverPatient(
            id: 'srv-1',
            clientUuid: p.id,
            familyName: 'Server',
            version: 3,
          ),
        ], []);
        expect((await patients()).single.familyName, 'Local');
      },
    );
  });
}
