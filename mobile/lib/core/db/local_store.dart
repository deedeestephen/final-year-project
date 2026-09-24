import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import 'app_database.dart';

/// Fields for registering a patient on the device.
class PatientDraft {
  const PatientDraft({
    required this.givenName,
    required this.familyName,
    required this.dateOfBirth,
    required this.regionClass,
    this.district,
    this.phone,
    this.nationalId,
  });

  final String givenName;
  final String familyName;
  final String dateOfBirth;
  final String regionClass;
  final String? district;
  final String? phone;
  final String? nationalId;
}

/// Editable patient fields; null means "unchanged".
class PatientChanges {
  const PatientChanges({
    this.givenName,
    this.familyName,
    this.phone,
    this.district,
    this.regionClass,
  });

  final String? givenName;
  final String? familyName;
  final String? phone;
  final String? district;
  final String? regionClass;

  Map<String, Object> toJson() => _withoutNulls({
    'givenName': givenName,
    'familyName': familyName,
    'phone': phone,
    'district': district,
    'regionClass': regionClass,
  });

  bool get isEmpty => toJson().isEmpty;
}

/// A screening record (PSA, DRE, PI-RADS...) entered on the device.
class RecordDraft {
  const RecordDraft({
    required this.encounterDate,
    required this.dreFinding,
    this.psaNgMl,
    this.freePsaNgMl,
    this.piradsScore,
    this.prostateVolumeMl,
    this.notes,
  });

  final String encounterDate;
  final String dreFinding;
  final double? psaNgMl;
  final double? freePsaNgMl;
  final int? piradsScore;
  final double? prostateVolumeMl;
  final String? notes;
}

class SyncCounts {
  const SyncCounts({this.pending = 0, this.rejected = 0, this.conflicts = 0});
  final int pending;
  final int rejected;
  final int conflicts;

  int get needsAttention => rejected + conflicts;
}

/// Result of one operation from `POST /sync`.
class SyncOpResult {
  const SyncOpResult({
    required this.result,
    this.entityId,
    this.version,
    this.errorCode,
    this.errorMessage,
    this.server,
  });

  factory SyncOpResult.fromJson(Map<String, dynamic> json) {
    final error = json['error'] as Map<String, dynamic>?;
    return SyncOpResult(
      result: json['result'] as String,
      entityId: json['entityId'] as String?,
      version: json['version'] as int?,
      errorCode: error?['code'] as String?,
      errorMessage: error?['message'] as String?,
      server: json['server'] as Map<String, dynamic>?,
    );
  }

  final String result; // APPLIED | CONFLICT | REJECTED
  final String? entityId;
  final int? version;
  final String? errorCode;
  final String? errorMessage;
  final Map<String, dynamic>? server;
}

abstract final class EntityType {
  static const patient = 'patient';
  static const clinicalRecord = 'clinical_record';
}

abstract final class MetaKey {
  static const deviceId = 'deviceId';
  static const owner = 'ownerUserId';
  static const cachedUser = 'cachedUser';
  static const cursor = 'pullCursor';
  static const lastSyncAt = 'lastSyncAt';
}

Map<String, Object> _withoutNulls(Map<String, Object?> map) => {
  for (final e in map.entries)
    if (e.value != null) e.key: e.value!,
};

/// All reads and writes of clinical data on the device. Every change is
/// saved locally first and queued in the outbox, so nothing is lost offline.
class LocalStore {
  LocalStore(this.db, {Uuid? uuid, DateTime Function()? now})
    : _uuid = uuid ?? const Uuid(),
      _now = now ?? DateTime.now;

  final AppDatabase db;
  final Uuid _uuid;
  final DateTime Function() _now;

  // ---------------------------------------------------------------------------
  // Settings, owner and cached profile
  // ---------------------------------------------------------------------------

  Future<String?> meta(String key) async => (await (db.select(
    db.meta,
  )..where((m) => m.key.equals(key))).getSingleOrNull())?.value;

  Future<void> setMeta(String key, String value) => db
      .into(db.meta)
      .insertOnConflictUpdate(MetaCompanion.insert(key: key, value: value));

  /// Stable id of this installation, sent with every sync batch.
  Future<String> deviceId() async {
    final existing = await meta(MetaKey.deviceId);
    if (existing != null) return existing;
    final id = 'device-${_uuid.v4()}';
    await setMeta(MetaKey.deviceId, id);
    return id;
  }

  /// Makes the device ready for [userId]. Another user's data is removed
  /// first, so one account never sees what another left on the phone.
  Future<void> prepareFor(String userId) async {
    final owner = await meta(MetaKey.owner);
    if (owner != null && owner != userId) await wipe();
    await setMeta(MetaKey.owner, userId);
  }

  Future<void> cacheUser(Map<String, dynamic> userJson) =>
      setMeta(MetaKey.cachedUser, jsonEncode(userJson));

  Future<Map<String, dynamic>?> cachedUser() async {
    final value = await meta(MetaKey.cachedUser);
    return value == null ? null : jsonDecode(value) as Map<String, dynamic>;
  }

  /// Removes all clinical data, the queue and the cached profile. The device
  /// id is kept.
  Future<void> wipe() => db.transaction(() async {
    await db.delete(db.localClinicalRecords).go();
    await db.delete(db.localPatients).go();
    await db.delete(db.outbox).go();
    await db.delete(db.syncConflicts).go();
    await (db.delete(
      db.meta,
    )..where((m) => m.key.isNotValue(MetaKey.deviceId))).go();
  });

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  Stream<List<LocalPatient>> watchPatients({String query = ''}) {
    final q = query.trim().toLowerCase();
    final select = db.select(db.localPatients)
      ..orderBy([
        (p) => OrderingTerm.asc(p.familyName),
        (p) => OrderingTerm.asc(p.givenName),
      ]);
    if (q.isNotEmpty) {
      final like = '%$q%';
      select.where(
        (p) =>
            p.givenName.lower().like(like) |
            p.familyName.lower().like(like) |
            p.mrn.lower().like(like),
      );
    }
    return select.watch();
  }

  Stream<LocalPatient?> watchPatient(String id) => (db.select(
    db.localPatients,
  )..where((p) => p.id.equals(id))).watchSingleOrNull();

  Future<LocalPatient?> patient(String id) => (db.select(
    db.localPatients,
  )..where((p) => p.id.equals(id))).getSingleOrNull();

  Stream<List<LocalClinicalRecord>> watchRecords(LocalPatient patient) {
    final serverId = patient.serverId;
    return (db.select(db.localClinicalRecords)
          ..where(
            (r) =>
                r.patientId.equals(patient.id) |
                (serverId == null
                    ? const Constant(false)
                    : r.patientServerId.equals(serverId)),
          )
          ..orderBy([
            (r) => OrderingTerm.desc(r.encounterDate),
            (r) => OrderingTerm.desc(r.createdAt),
          ]))
        .watch();
  }

  Stream<SyncCounts> watchCounts() => db
      .customSelect(
        "SELECT "
        "(SELECT count(*) FROM outbox WHERE status != 'rejected') AS pending, "
        "(SELECT count(*) FROM outbox WHERE status = 'rejected') AS rejected, "
        "(SELECT count(*) FROM sync_conflicts) AS conflicts",
        readsFrom: {db.outbox, db.syncConflicts},
      )
      .watchSingle()
      .map(
        (row) => SyncCounts(
          pending: row.read<int>('pending'),
          rejected: row.read<int>('rejected'),
          conflicts: row.read<int>('conflicts'),
        ),
      );

  Future<SyncCounts> counts() => watchCounts().first;

  Stream<List<OutboxData>> watchRejected() =>
      (db.select(db.outbox)..where((o) => o.status.equals('rejected'))).watch();

  Stream<List<SyncConflict>> watchConflicts() =>
      db.select(db.syncConflicts).watch();

  // ---------------------------------------------------------------------------
  // Local changes (each one also queued for the server)
  // ---------------------------------------------------------------------------

  Future<LocalPatient> registerPatient(PatientDraft d) {
    final id = _uuid.v4();
    final now = _now();
    return db.transaction(() async {
      final nationalId = d.nationalId?.trim();
      await db
          .into(db.localPatients)
          .insert(
            LocalPatientsCompanion.insert(
              id: id,
              givenName: d.givenName.trim(),
              familyName: d.familyName.trim(),
              dateOfBirth: d.dateOfBirth,
              regionClass: d.regionClass,
              district: Value(_blankToNull(d.district)),
              phone: Value(_blankToNull(d.phone)),
              nationalIdMasked: Value(
                nationalId == null || nationalId.isEmpty
                    ? null
                    : _mask(nationalId),
              ),
              syncState: RowSync.pending,
              updatedAt: now,
            ),
          );
      await _enqueue(
        entityType: EntityType.patient,
        operation: 'CREATE',
        entityLocalId: id,
        payload: _withoutNulls({
          'clientUuid': id,
          'givenName': d.givenName.trim(),
          'familyName': d.familyName.trim(),
          'dateOfBirth': d.dateOfBirth,
          'regionClass': d.regionClass,
          'district': _blankToNull(d.district),
          'phone': _blankToNull(d.phone),
          'nationalId': nationalId == null || nationalId.isEmpty
              ? null
              : nationalId,
        }),
      );
      return (await patient(id))!;
    });
  }

  /// Edits a patient the server already has. Several edits before a sync
  /// are merged into one update, so they do not conflict with each other.
  Future<void> updatePatient(String id, PatientChanges changes) {
    if (changes.isEmpty) return Future.value();
    return db.transaction(() async {
      final p = await patient(id);
      if (p == null) throw StateError('Unknown patient $id');
      if (p.serverId == null) {
        throw StateError('Patient must be synced before it can be edited');
      }
      await (db.update(db.localPatients)..where((x) => x.id.equals(id))).write(
        LocalPatientsCompanion(
          givenName: Value.absentIfNull(changes.givenName?.trim()),
          familyName: Value.absentIfNull(changes.familyName?.trim()),
          phone: Value.absentIfNull(changes.phone?.trim()),
          district: Value.absentIfNull(changes.district?.trim()),
          regionClass: Value.absentIfNull(changes.regionClass),
          syncState: const Value(RowSync.pending),
          updatedAt: Value(_now()),
        ),
      );
      final queued =
          await (db.select(db.outbox)..where(
                (o) =>
                    o.entityLocalId.equals(id) &
                    o.operation.equals('UPDATE') &
                    o.status.equals('pending'),
              ))
              .getSingleOrNull();
      if (queued != null) {
        final merged = {
          ...jsonDecode(queued.payload) as Map<String, dynamic>,
          ...changes.toJson(),
        };
        await (db.update(db.outbox)..where((o) => o.seq.equals(queued.seq)))
            .write(OutboxCompanion(payload: Value(jsonEncode(merged))));
      } else {
        await _enqueue(
          entityType: EntityType.patient,
          operation: 'UPDATE',
          entityLocalId: id,
          baseVersion: p.version,
          payload: changes.toJson(),
        );
      }
    });
  }

  Future<LocalClinicalRecord> addRecord(String patientId, RecordDraft d) {
    final id = _uuid.v4();
    return db.transaction(() async {
      final p = await patient(patientId);
      if (p == null) throw StateError('Unknown patient $patientId');
      final notes = _blankToNull(d.notes);
      await db
          .into(db.localClinicalRecords)
          .insert(
            LocalClinicalRecordsCompanion.insert(
              id: id,
              patientId: p.id,
              patientServerId: Value(p.serverId),
              encounterDate: d.encounterDate,
              psaNgMl: Value(d.psaNgMl),
              freePsaNgMl: Value(d.freePsaNgMl),
              dreFinding: d.dreFinding,
              piradsScore: Value(d.piradsScore),
              prostateVolumeMl: Value(d.prostateVolumeMl),
              notes: Value(notes),
              syncState: RowSync.pending,
              createdAt: _now(),
            ),
          );
      await _enqueue(
        entityType: EntityType.clinicalRecord,
        operation: 'CREATE',
        entityLocalId: id,
        patientLocalId: p.id,
        payload: _withoutNulls({
          'clientUuid': id,
          'encounterDate': d.encounterDate,
          'dreFinding': d.dreFinding,
          'psaNgMl': d.psaNgMl,
          'freePsaNgMl': d.freePsaNgMl,
          'piradsScore': d.piradsScore,
          'prostateVolumeMl': d.prostateVolumeMl,
          'notes': notes,
        }),
      );
      return (await (db.select(
        db.localClinicalRecords,
      )..where((r) => r.id.equals(id))).getSingle());
    });
  }

  Future<void> _enqueue({
    required String entityType,
    required String operation,
    required String entityLocalId,
    required Map<String, Object> payload,
    String? patientLocalId,
    int? baseVersion,
  }) => db
      .into(db.outbox)
      .insert(
        OutboxCompanion.insert(
          idempotencyKey: _uuid.v4(),
          entityType: entityType,
          operation: operation,
          entityLocalId: entityLocalId,
          patientLocalId: Value(patientLocalId),
          baseVersion: Value(baseVersion),
          payload: jsonEncode(payload),
          createdAt: _now().toUtc(),
        ),
      );

  // ---------------------------------------------------------------------------
  // User decisions on rejected changes and conflicts
  // ---------------------------------------------------------------------------

  /// Drops a change the server refused. A refused registration also removes
  /// the local patient and anything queued for it.
  Future<void> discardRejected(int seq) => db.transaction(() async {
    final op = await (db.select(
      db.outbox,
    )..where((o) => o.seq.equals(seq))).getSingleOrNull();
    if (op == null) return;
    await (db.delete(db.outbox)..where((o) => o.seq.equals(seq))).go();
    if (op.operation != 'CREATE') {
      await _settle(op.entityType, op.entityLocalId);
      return;
    }
    if (op.entityType == EntityType.clinicalRecord) {
      await (db.delete(
        db.localClinicalRecords,
      )..where((r) => r.id.equals(op.entityLocalId))).go();
    } else {
      await (db.delete(db.outbox)..where(
            (o) =>
                o.entityLocalId.equals(op.entityLocalId) |
                o.patientLocalId.equals(op.entityLocalId),
          ))
          .go();
      await (db.delete(
        db.localClinicalRecords,
      )..where((r) => r.patientId.equals(op.entityLocalId))).go();
      await (db.delete(
        db.localPatients,
      )..where((p) => p.id.equals(op.entityLocalId))).go();
    }
  });

  /// Conflict: accept the server's copy and drop the local edit.
  Future<void> resolveKeepServer(int conflictId) => db.transaction(() async {
    final c = await _conflict(conflictId);
    final server = jsonDecode(c.serverCopy) as Map<String, dynamic>;
    await (db.update(db.localPatients)
          ..where((p) => p.id.equals(c.patientLocalId)))
        .write(_patientFromServer(server));
    await (db.delete(
      db.syncConflicts,
    )..where((x) => x.id.equals(conflictId))).go();
    await _settle(EntityType.patient, c.patientLocalId);
  });

  /// Conflict: re-apply the local edit on top of the server's newer version.
  Future<void> resolveKeepMine(int conflictId) => db.transaction(() async {
    final c = await _conflict(conflictId);
    await (db.update(
      db.localPatients,
    )..where((p) => p.id.equals(c.patientLocalId))).write(
      LocalPatientsCompanion(
        version: Value(c.serverVersion),
        syncState: const Value(RowSync.pending),
      ),
    );
    await _enqueue(
      entityType: EntityType.patient,
      operation: 'UPDATE',
      entityLocalId: c.patientLocalId,
      baseVersion: c.serverVersion,
      payload: (jsonDecode(c.localChanges) as Map<String, dynamic>).cast(),
    );
    await (db.delete(
      db.syncConflicts,
    )..where((x) => x.id.equals(conflictId))).go();
  });

  Future<SyncConflict> _conflict(int id) =>
      (db.select(db.syncConflicts)..where((x) => x.id.equals(id))).getSingle();

  // ---------------------------------------------------------------------------
  // Used by the sync engine
  // ---------------------------------------------------------------------------

  /// Operations left in "sending" by an interrupted sync go back to the queue.
  Future<void> recoverInterrupted() =>
      (db.update(db.outbox)..where((o) => o.status.equals('sending'))).write(
        const OutboxCompanion(status: Value('pending')),
      );

  /// The oldest queued operations, marked as being sent.
  Future<List<OutboxData>> takeBatch(int limit) => db.transaction(() async {
    final ops =
        await (db.select(db.outbox)
              ..where((o) => o.status.equals('pending'))
              ..orderBy([(o) => OrderingTerm.asc(o.seq)])
              ..limit(limit))
            .get();
    if (ops.isNotEmpty) {
      await (db.update(db.outbox)
            ..where((o) => o.seq.isIn(ops.map((o) => o.seq))))
          .write(const OutboxCompanion(status: Value('sending')));
    }
    return ops;
  });

  /// A batch that could not be delivered goes back to the queue.
  Future<void> releaseBatch(Iterable<int> seqs) => db.customUpdate(
    "UPDATE outbox SET status = 'pending', attempts = attempts + 1 "
    "WHERE status = 'sending' AND seq IN (${seqs.map((_) => '?').join(',')})",
    variables: [for (final s in seqs) Variable.withInt(s)],
    updates: {db.outbox},
  );

  /// Server references for an operation: the patient's server id when known,
  /// otherwise the device's clientUuid (the server accepts either).
  Future<({String? entityId, String? patientId})> references(
    OutboxData op,
  ) async {
    if (op.entityType == EntityType.patient) {
      final p = await patient(op.entityLocalId);
      return (entityId: p?.serverId ?? op.entityLocalId, patientId: null);
    }
    final p = op.patientLocalId == null
        ? null
        : await patient(op.patientLocalId!);
    return (entityId: null, patientId: p?.serverId ?? op.patientLocalId);
  }

  Future<void> applyResult(
    OutboxData op,
    SyncOpResult r,
  ) => db.transaction(() async {
    if (r.result == 'REJECTED' && r.errorCode == 'DEPENDENCY_FAILED') {
      // The patient failed in the same batch; retry once it is fixed.
      await (db.update(db.outbox)..where((o) => o.seq.equals(op.seq))).write(
        const OutboxCompanion(status: Value('pending')),
      );
      return;
    }
    if (r.result == 'REJECTED') {
      await (db.update(db.outbox)..where((o) => o.seq.equals(op.seq))).write(
        OutboxCompanion(
          status: const Value('rejected'),
          lastErrorCode: Value(r.errorCode),
          lastErrorMessage: Value(r.errorMessage),
        ),
      );
      await _setState(op.entityType, op.entityLocalId, RowSync.rejected);
      return;
    }

    await (db.delete(db.outbox)..where((o) => o.seq.equals(op.seq))).go();
    if (r.result == 'CONFLICT') {
      await db
          .into(db.syncConflicts)
          .insert(
            SyncConflictsCompanion.insert(
              patientLocalId: op.entityLocalId,
              localChanges: op.payload,
              serverCopy: jsonEncode(r.server ?? const {}),
              serverVersion: r.version ?? 0,
              createdAt: _now(),
            ),
          );
      await _setState(op.entityType, op.entityLocalId, RowSync.conflict);
      return;
    }

    // APPLIED
    if (op.entityType == EntityType.patient) {
      await (db.update(
        db.localPatients,
      )..where((p) => p.id.equals(op.entityLocalId))).write(
        LocalPatientsCompanion(
          serverId: Value.absentIfNull(r.entityId),
          version: Value.absentIfNull(r.version),
        ),
      );
      if (r.entityId != null) {
        await (db.update(
          db.localClinicalRecords,
        )..where((x) => x.patientId.equals(op.entityLocalId))).write(
          LocalClinicalRecordsCompanion(patientServerId: Value(r.entityId)),
        );
      }
    } else {
      await (db.update(
        db.localClinicalRecords,
      )..where((x) => x.id.equals(op.entityLocalId))).write(
        LocalClinicalRecordsCompanion(serverId: Value.absentIfNull(r.entityId)),
      );
    }
    await _settle(op.entityType, op.entityLocalId);
  });

  /// Marks a row synced once nothing else is queued or unresolved for it.
  Future<void> _settle(String entityType, String localId) async {
    final queued = await (db.select(
      db.outbox,
    )..where((o) => o.entityLocalId.equals(localId))).get();
    if (queued.any((o) => o.status == 'rejected')) {
      await _setState(entityType, localId, RowSync.rejected);
      return;
    }
    final conflicts = entityType == EntityType.patient
        ? await (db.select(
            db.syncConflicts,
          )..where((c) => c.patientLocalId.equals(localId))).get()
        : const <SyncConflict>[];
    await _setState(
      entityType,
      localId,
      conflicts.isNotEmpty
          ? RowSync.conflict
          : queued.isNotEmpty
          ? RowSync.pending
          : RowSync.synced,
    );
  }

  Future<void> _setState(String entityType, String localId, String state) =>
      entityType == EntityType.patient
      ? (db.update(db.localPatients)..where((p) => p.id.equals(localId))).write(
          LocalPatientsCompanion(syncState: Value(state)),
        )
      : (db.update(db.localClinicalRecords)..where((r) => r.id.equals(localId)))
            .write(LocalClinicalRecordsCompanion(syncState: Value(state)));

  /// Merges server changes. Rows with local changes waiting to be sent keep
  /// the local values; the next push reports any real conflict.
  Future<void> mergePulled(
    List<Map<String, dynamic>> patients,
    List<Map<String, dynamic>> records,
  ) => db.transaction(() async {
    for (final s in patients) {
      final serverId = s['id'] as String;
      final clientUuid = s['clientUuid'] as String?;
      final local =
          await (db.select(db.localPatients)..where(
                (p) =>
                    p.serverId.equals(serverId) |
                    p.id.equals(clientUuid ?? serverId),
              ))
              .getSingleOrNull();
      if (local != null && local.syncState != RowSync.synced) {
        if (local.serverId == null) {
          await (db.update(db.localPatients)
                ..where((p) => p.id.equals(local.id)))
              .write(LocalPatientsCompanion(serverId: Value(serverId)));
        }
        continue;
      }
      final id = local?.id ?? clientUuid ?? serverId;
      await db
          .into(db.localPatients)
          .insertOnConflictUpdate(
            _patientFromServer(
              s,
            ).copyWith(id: Value(id), syncState: const Value(RowSync.synced)),
          );
      await (db.update(
        db.localClinicalRecords,
      )..where((r) => r.patientId.equals(id))).write(
        LocalClinicalRecordsCompanion(patientServerId: Value(serverId)),
      );
    }

    for (final s in records) {
      final serverId = s['id'] as String;
      final clientUuid = s['clientUuid'] as String?;
      final local =
          await (db.select(db.localClinicalRecords)..where(
                (r) =>
                    r.serverId.equals(serverId) |
                    r.id.equals(clientUuid ?? serverId),
              ))
              .getSingleOrNull();
      if (local != null && local.syncState != RowSync.synced) {
        if (local.serverId == null) {
          await (db.update(db.localClinicalRecords)
                ..where((r) => r.id.equals(local.id)))
              .write(LocalClinicalRecordsCompanion(serverId: Value(serverId)));
        }
        continue;
      }
      final patientServerId = s['patientId'] as String;
      final owner = await (db.select(
        db.localPatients,
      )..where((p) => p.serverId.equals(patientServerId))).getSingleOrNull();
      await db
          .into(db.localClinicalRecords)
          .insertOnConflictUpdate(
            LocalClinicalRecordsCompanion.insert(
              id: local?.id ?? clientUuid ?? serverId,
              serverId: Value(serverId),
              patientId: owner?.id ?? patientServerId,
              patientServerId: Value(patientServerId),
              encounterDate: s['encounterDate'] as String,
              psaNgMl: Value((s['psaNgMl'] as num?)?.toDouble()),
              freePsaNgMl: Value((s['freePsaNgMl'] as num?)?.toDouble()),
              dreFinding: s['dreFinding'] as String,
              piradsScore: Value(s['piradsScore'] as int?),
              prostateVolumeMl: Value(
                (s['prostateVolumeMl'] as num?)?.toDouble(),
              ),
              notes: Value(s['notes'] as String?),
              syncState: RowSync.synced,
              createdAt: DateTime.parse(s['createdAt'] as String),
            ),
          );
    }
  });

  LocalPatientsCompanion _patientFromServer(Map<String, dynamic> s) =>
      LocalPatientsCompanion(
        serverId: Value(s['id'] as String),
        mrn: Value(s['mrn'] as String?),
        givenName: Value(s['givenName'] as String),
        familyName: Value(s['familyName'] as String),
        dateOfBirth: Value(s['dateOfBirth'] as String),
        regionClass: Value(s['regionClass'] as String),
        district: Value(s['district'] as String?),
        phone: Value(s['phone'] as String?),
        nationalIdMasked: Value(s['nationalIdMasked'] as String?),
        version: Value(s['version'] as int),
        updatedAt: Value(
          DateTime.tryParse(s['updatedAt'] as String? ?? '') ?? _now(),
        ),
      );

  static String? _blankToNull(String? v) {
    final t = v?.trim();
    return t == null || t.isEmpty ? null : t;
  }

  static String _mask(String nationalId) {
    final keep = nationalId.length <= 4
        ? nationalId
        : nationalId.substring(nationalId.length - 4);
    return '${'*' * (nationalId.length - keep.length)}$keep';
  }
}
