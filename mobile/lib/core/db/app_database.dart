import 'package:drift/drift.dart';

part 'app_database.g.dart';

/// Sync state of a local row, shown to the user with [SyncStatusBadge].
abstract final class RowSync {
  static const pending =
      'pending'; // saved on the device, not yet on the server
  static const synced = 'synced';
  static const conflict = 'conflict'; // someone else changed it; user decides
  static const rejected =
      'rejected'; // the server refused it; user must fix or discard
}

/// Patients on this device. `id` is the device's clientUuid for patients
/// registered here, or the server id for patients downloaded from the server.
class LocalPatients extends Table {
  TextColumn get id => text()();
  TextColumn get serverId => text().nullable().unique()();
  TextColumn get mrn => text().nullable()();
  TextColumn get givenName => text()();
  TextColumn get familyName => text()();
  TextColumn get dateOfBirth => text()(); // YYYY-MM-DD
  TextColumn get regionClass => text()();
  TextColumn get district => text().nullable()();
  TextColumn get phone => text().nullable()();
  TextColumn get nationalIdMasked => text().nullable()();

  /// Server version this row is based on; 0 until the server has it.
  IntColumn get version => integer().withDefault(const Constant(0))();
  TextColumn get syncState => text()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

class LocalClinicalRecords extends Table {
  TextColumn get id => text()();
  TextColumn get serverId => text().nullable().unique()();

  /// Local patient id, and the patient's server id once known.
  TextColumn get patientId => text()();
  TextColumn get patientServerId => text().nullable()();
  TextColumn get encounterDate => text()();
  RealColumn get psaNgMl => real().nullable()();
  RealColumn get freePsaNgMl => real().nullable()();
  TextColumn get dreFinding => text()();
  IntColumn get piradsScore => integer().nullable()();
  RealColumn get prostateVolumeMl => real().nullable()();
  TextColumn get notes => text().nullable()();
  TextColumn get syncState => text()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Operations waiting to be sent, in order (FR-03).
class Outbox extends Table {
  IntColumn get seq => integer().autoIncrement()();
  TextColumn get idempotencyKey => text().unique()();
  TextColumn get entityType => text()(); // patient | clinical_record
  TextColumn get operation => text()(); // CREATE | UPDATE
  TextColumn get entityLocalId => text()();
  TextColumn get patientLocalId => text().nullable()();
  IntColumn get baseVersion => integer().nullable()();
  TextColumn get payload => text()(); // JSON body for the API
  DateTimeColumn get createdAt => dateTime()();

  /// pending | sending | rejected
  TextColumn get status => text().withDefault(const Constant('pending'))();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastErrorCode => text().nullable()();
  TextColumn get lastErrorMessage => text().nullable()();
}

/// A patient edit that clashed with a newer server version.
class SyncConflicts extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get patientLocalId => text()();
  TextColumn get localChanges =>
      text()(); // JSON of the fields the user changed
  TextColumn get serverCopy => text()(); // JSON PatientView from the server
  IntColumn get serverVersion => integer()();
  DateTimeColumn get createdAt => dateTime()();
}

/// Small key/value settings: device id, owner, pull cursor, cached profile.
class Meta extends Table {
  TextColumn get key => text()();
  TextColumn get value => text()();

  @override
  Set<Column> get primaryKey => {key};
}

@DriftDatabase(
  tables: [LocalPatients, LocalClinicalRecords, Outbox, SyncConflicts, Meta],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  @override
  int get schemaVersion => 1;
}
