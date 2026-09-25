import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/core/db/app_database.dart';

import '../generated_migrations/schema.dart';
import '../generated_migrations/schema_v1.dart' as v1;
import '../support/test_db.dart';

/// Phones already have version 1 of the database (Phase 6). Updating the app
/// must add the upload queue without losing any saved patient or record.
void main() {
  late SchemaVerifier verifier;

  setUpAll(() {
    useHostSqlite();
    verifier = SchemaVerifier(GeneratedHelper());
  });

  test('upgrading from version 1 gives exactly the version 2 schema', () async {
    final connection = await verifier.startAt(1);
    final db = AppDatabase(connection);
    await verifier.migrateAndValidate(db, 2);
    await db.close();
  });

  test('patients saved before the upgrade are still there afterwards', () async {
    final schema = await verifier.schemaAt(1);
    final old = v1.DatabaseAtV1(schema.newConnection());
    await old.customStatement(
      "INSERT INTO local_patients (id, given_name, family_name, date_of_birth, "
      "region_class, version, sync_state, updated_at) VALUES "
      "('p-1', 'SYNTHETIC', 'Before', '1960-01-01', 'RURAL', 0, 'pending', 0)",
    );
    await old.close();

    final db = AppDatabase(schema.newConnection());
    final patients = await db.select(db.localPatients).get();
    expect(patients.single.familyName, 'Before');
    // The new table works straight away.
    await db
        .into(db.pendingUploads)
        .insert(
          PendingUploadsCompanion.insert(
            id: 'u-1',
            patientLocalId: 'p-1',
            patientServerId: 's-1',
            kind: 'imaging',
            filePath: '/tmp/a.dcm',
            fileName: 'a.dcm',
            sizeBytes: 10,
            createdAt: DateTime(2026),
          ),
        );
    expect(await db.select(db.pendingUploads).get(), hasLength(1));
    await db.close();
  });
}
