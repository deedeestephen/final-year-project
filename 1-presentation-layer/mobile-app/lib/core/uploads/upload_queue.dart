import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:drift/drift.dart';
import 'package:path/path.dart' as p;
import 'package:uuid/uuid.dart';

import '../db/app_database.dart';
import '../network/api_client.dart';
import '../network/api_exception.dart';

/// What is being uploaded.
enum UploadKind {
  imaging('imaging'),
  slide('slide');

  const UploadKind(this.value);
  final String value;
}

abstract final class UploadStatus {
  static const pending = 'pending';
  static const uploading = 'uploading';

  /// The server refused the file (wrong type, too large, checks failed).
  static const rejected = 'rejected';
}

/// Bytes sent so far for the upload that is running now.
class UploadProgress {
  const UploadProgress(this.uploadId, this.sent, this.total);
  final String uploadId;
  final int sent;
  final int total;
  double get fraction => total <= 0 ? 0 : sent / total;
}

/// Imaging and slide files wait here until they reach the server.
///
/// - The chosen file is copied into the app's private storage straight away,
///   so it survives the app closing and never depends on the Downloads folder.
/// - Each upload has a client id: a retry after a lost connection never
///   creates a duplicate on the server.
/// - Connection problems are retried with the same backoff as sync
///   (and never sooner than the server's Retry-After). A refusal by the
///   server (wrong type, too large, failed checks) is shown and not retried.
/// - The private copy is deleted once the server has the file, and on
///   sign-out.
class UploadQueue {
  UploadQueue({
    required this.db,
    required this.api,
    required this.directory,
    DateTime Function()? now,
    Random? random,
    Uuid? uuid,
  }) : _now = now ?? DateTime.now,
       _random = random ?? Random(),
       _uuid = uuid ?? const Uuid();

  final AppDatabase db;
  final ApiClient api;

  /// Folder for the private copies.
  final Future<Directory> Function() directory;
  final DateTime Function() _now;
  final Random _random;
  final Uuid _uuid;
  static const maxBackoff = Duration(minutes: 15);

  final _progress = StreamController<UploadProgress>.broadcast();
  Future<int>? _running;

  Stream<UploadProgress> get progress => _progress.stream;

  /// Copies the file into app storage and queues it. Returns the upload id.
  Future<String> enqueue({
    required String sourcePath,
    required String fileName,
    required String patientLocalId,
    required String patientServerId,
    required UploadKind kind,
    String? modality,
    String? slideFormat,
    String? stain,
  }) async {
    final id = _uuid.v4();
    final dir = await directory();
    await dir.create(recursive: true);
    final copy = await File(
      sourcePath,
    ).copy(p.join(dir.path, '$id${p.extension(fileName).toLowerCase()}'));
    await db
        .into(db.pendingUploads)
        .insert(
          PendingUploadsCompanion.insert(
            id: id,
            patientLocalId: patientLocalId,
            patientServerId: patientServerId,
            kind: kind.value,
            modality: Value(modality),
            slideFormat: Value(slideFormat),
            stain: Value(stain),
            filePath: copy.path,
            fileName: fileName,
            sizeBytes: await copy.length(),
            createdAt: _now(),
          ),
        );
    return id;
  }

  Stream<List<PendingUpload>> watchForPatient(String patientServerId) =>
      (db.select(db.pendingUploads)
            ..where((u) => u.patientServerId.equals(patientServerId))
            ..orderBy([(u) => OrderingTerm.asc(u.createdAt)]))
          .watch();

  /// Sends every upload that is due, one at a time. Joins a run in progress.
  /// Returns how many reached the server.
  Future<int> process() => _running ??= _process().whenComplete(() {
    _running = null;
  });

  Future<int> _process() async {
    var sent = 0;
    // Anything left "uploading" by a closed app is simply due again.
    await (db.update(
      db.pendingUploads,
    )..where((u) => u.status.equals(UploadStatus.uploading))).write(
      const PendingUploadsCompanion(status: Value(UploadStatus.pending)),
    );
    final due =
        await (db.select(db.pendingUploads)
              ..where(
                (u) =>
                    u.status.equals(UploadStatus.pending) &
                    (u.nextAttemptAt.isNull() |
                        u.nextAttemptAt.isSmallerOrEqualValue(_now())),
              )
              ..orderBy([(u) => OrderingTerm.asc(u.createdAt)]))
            .get();
    for (final upload in due) {
      final outcome = await _send(upload);
      if (outcome == _Outcome.sent) sent += 1;
      if (outcome == _Outcome.offline) break; // no point trying the rest now
    }
    return sent;
  }

  Future<_Outcome> _send(PendingUpload u) async {
    await _setStatus(u.id, UploadStatus.uploading);
    try {
      await api.upload<Map<String, dynamic>>(
        u.kind == UploadKind.imaging.value
            ? '/patients/${u.patientServerId}/imaging'
            : '/patients/${u.patientServerId}/histopathology',
        filePath: u.filePath,
        fileName: u.fileName,
        fields: {
          'modality': ?u.modality,
          'format': ?u.slideFormat,
          'stain': ?u.stain,
          'clientUuid': u.id,
        },
        onProgress: (sentBytes, total) =>
            _progress.add(UploadProgress(u.id, sentBytes, total)),
      );
      await _remove(u);
      return _Outcome.sent;
    } on ApiException catch (e) {
      final retry =
          e.isNetwork ||
          e.status == null ||
          e.status == 408 ||
          e.status == 429 ||
          e.status! >= 500;
      if (!retry) {
        await (db.update(
          db.pendingUploads,
        )..where((x) => x.id.equals(u.id))).write(
          PendingUploadsCompanion(
            status: const Value(UploadStatus.rejected),
            lastError: Value(e.message),
          ),
        );
        return _Outcome.rejected;
      }
      final attempts = u.attempts + 1;
      var wait = backoffFor(attempts);
      final serverWait = e.retryAfter;
      if (serverWait != null && serverWait > wait) wait = serverWait;
      await (db.update(
        db.pendingUploads,
      )..where((x) => x.id.equals(u.id))).write(
        PendingUploadsCompanion(
          status: const Value(UploadStatus.pending),
          attempts: Value(attempts),
          nextAttemptAt: Value(_now().add(wait)),
          lastError: Value(
            e.isNetwork
                ? 'No connection. It will upload when the phone is online.'
                : e.message,
          ),
        ),
      );
      return e.isNetwork ? _Outcome.offline : _Outcome.later;
    } on FileSystemException {
      // The private copy is gone (for example, app storage was cleared).
      await (db.update(
        db.pendingUploads,
      )..where((x) => x.id.equals(u.id))).write(
        const PendingUploadsCompanion(
          status: Value(UploadStatus.rejected),
          lastError: Value(
            'The file is no longer on this phone. Remove it and choose it again.',
          ),
        ),
      );
      return _Outcome.rejected;
    }
  }

  /// Same schedule as sync: 2 s doubling up to 15 minutes, with jitter.
  Duration backoffFor(int attempts) {
    final base = const Duration(seconds: 2) * pow(2, min(attempts - 1, 20));
    final capped = base > maxBackoff ? maxBackoff : base;
    return capped * (0.5 + _random.nextDouble() * 0.5);
  }

  /// Tries a waiting or refused upload again now.
  Future<void> retryNow(String id) async {
    await (db.update(db.pendingUploads)..where((u) => u.id.equals(id))).write(
      const PendingUploadsCompanion(
        status: Value(UploadStatus.pending),
        nextAttemptAt: Value(null),
      ),
    );
  }

  /// Removes an upload and its private copy.
  Future<void> discard(String id) async {
    final u = await (db.select(
      db.pendingUploads,
    )..where((x) => x.id.equals(id))).getSingleOrNull();
    if (u != null) await _remove(u);
  }

  /// Sign-out: every private copy is deleted (the rows go with the database wipe).
  Future<void> deleteAllFiles() async {
    final dir = await directory();
    // Synchronous on purpose: sign-out must finish even if the app is closing.
    if (dir.existsSync()) dir.deleteSync(recursive: true);
  }

  Future<void> dispose() => _progress.close();

  Future<void> _remove(PendingUpload u) async {
    await (db.delete(db.pendingUploads)..where((x) => x.id.equals(u.id))).go();
    final file = File(u.filePath);
    if (await file.exists()) await file.delete();
  }

  Future<void> _setStatus(String id, String status) =>
      (db.update(db.pendingUploads)..where((u) => u.id.equals(id))).write(
        PendingUploadsCompanion(status: Value(status)),
      );
}

enum _Outcome { sent, later, offline, rejected }
