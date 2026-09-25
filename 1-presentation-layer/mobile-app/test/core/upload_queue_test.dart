import 'dart:io';
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/core/db/app_database.dart';
import 'package:pca_mhealth/core/network/api_client.dart';
import 'package:pca_mhealth/core/storage/token_store.dart';
import 'package:pca_mhealth/core/uploads/upload_queue.dart';

import '../support/fakes.dart';
import '../support/test_db.dart';

void main() {
  late AppDatabase db;
  late Directory temp;
  late Directory uploads;
  late FakeHttpAdapter server;
  late UploadQueue queue;
  late File source;
  var now = DateTime(2026, 9, 25, 10);
  FakeResponse Function(RecordedRequest) respond = (_) =>
      const FakeResponse(201, {'id': 'study-1', 'status': 'VALIDATED'});

  setUp(() async {
    db = memoryDatabase();
    temp = await Directory.systemTemp.createTemp('pca-upload-test-');
    uploads = Directory('${temp.path}/uploads');
    source = await File(
      '${temp.path}/synthetic-mri.dcm',
    ).writeAsBytes(List.filled(300, 7));
    server = FakeHttpAdapter((r) async => respond(r));
    final store = InMemoryTokenStore();
    await store.save(
      const StoredTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    queue = UploadQueue(
      db: db,
      api: ApiClient(
        baseUrl: 'http://test/api/v1',
        tokenStore: store,
        adapter: server,
      ),
      directory: () async => uploads,
      now: () => now,
      random: Random(1),
    );
  });

  tearDown(() async {
    await queue.dispose();
    await db.close();
    await temp.delete(recursive: true);
  });

  Future<String> enqueueMri() => queue.enqueue(
    sourcePath: source.path,
    fileName: 'synthetic-mri.dcm',
    patientLocalId: 'local-1',
    patientServerId: 'server-1',
    kind: UploadKind.imaging,
    modality: 'MRI',
  );

  Future<List<PendingUpload>> rows() => db.select(db.pendingUploads).get();

  test('keeps a private copy, sends fields and file, then cleans up', () async {
    final id = await enqueueMri();
    final queued = (await rows()).single;
    expect(queued.filePath, startsWith(uploads.path));
    expect(queued.sizeBytes, 300);
    // The original may be deleted by the user; the copy is what gets sent.
    await source.delete();

    expect(await queue.process(), 1);
    final sent = server.requests.single;
    expect(sent.method, 'POST');
    expect(sent.path, '/patients/server-1/imaging');
    expect(sent.body, {
      'fields': {'modality': 'MRI', 'clientUuid': id},
      'files': ['synthetic-mri.dcm'],
      'bytes': greaterThan(300),
    });
    expect(await rows(), isEmpty);
    expect(await File(queued.filePath).exists(), isFalse);
  });

  test(
    'offline: waits with backoff and uploads when due, with the same id',
    () async {
      respond = (r) => offline(r);
      final id = await enqueueMri();
      expect(await queue.process(), 0);
      var row = (await rows()).single;
      expect(row.status, UploadStatus.pending);
      expect(row.attempts, 1);
      expect(row.lastError, contains('No connection'));
      expect(row.nextAttemptAt!.isAfter(now), isTrue);

      // Not due yet: nothing is sent.
      respond = (_) => const FakeResponse(201, {'id': 'study-1'});
      expect(await queue.process(), 0);

      now = now.add(const Duration(minutes: 1));
      expect(await queue.process(), 1);
      expect(
        (server.requests.last.body as Map)['fields'],
        containsPair('clientUuid', id),
      );
      expect(await rows(), isEmpty);
    },
  );

  test('never retries sooner than the server asks', () async {
    respond = (_) => const FakeResponse(
      429,
      {
        'error': {'code': 'RATE_LIMITED', 'message': 'Too many requests'},
      },
      {'retry-after': '600'},
    );
    await enqueueMri();
    await queue.process();
    final row = (await rows()).single;
    expect(
      row.nextAttemptAt!.difference(now),
      greaterThanOrEqualTo(const Duration(seconds: 600)),
    );
  });

  test(
    'a file the server refuses is kept with the reason, not retried',
    () async {
      respond = (_) => const FakeResponse(422, {
        'error': {
          'code': 'UPLOAD_REJECTED',
          'message': 'This DICOM file is modality CT, not MRI',
        },
      });
      final id = await enqueueMri();
      await queue.process();
      var row = (await rows()).single;
      expect(row.status, UploadStatus.rejected);
      expect(row.lastError, 'This DICOM file is modality CT, not MRI');
      expect(await queue.process(), 0);
      expect(server.requests, hasLength(1));

      // The user can remove it; the private copy goes too.
      await queue.discard(id);
      expect(await rows(), isEmpty);
      expect(await File(row.filePath).exists(), isFalse);
    },
  );

  test(
    'a missing private copy is reported instead of stopping the queue',
    () async {
      await enqueueMri();
      await File((await rows()).single.filePath).delete();
      expect(await queue.process(), 0);
      final row = (await rows()).single;
      expect(row.status, UploadStatus.rejected);
      expect(row.lastError, contains('no longer on this phone'));
    },
  );

  test('sign-out deletes every private copy', () async {
    await enqueueMri();
    expect(await uploads.exists(), isTrue);
    await queue.deleteAllFiles();
    expect(await uploads.exists(), isFalse);
  });
}
