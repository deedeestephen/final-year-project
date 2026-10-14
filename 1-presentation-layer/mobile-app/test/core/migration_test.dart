import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/core/db/app_database.dart';

import '../generated_migrations/schema.dart';
import '../generated_migrations/schema_v1.dart' as v1;
import '../generated_migrations/schema_v2.dart' as v2;
import '../support/test_db.dart';

/// Phones have version 1 (Phase 6) or 2 (Phase 9) of the database. Updating
/// the app must add the upload queue and the new screening-record columns
/// without losing any saved patient or record.
void main() {
  late SchemaVerifier verifier;

  setUpAll(() {
    useHostSqlite();
    verifier = SchemaVerifier(GeneratedHelper());
  });

  for (final from in [1, 2]) {
    test(
      'upgrading from version $from gives exactly the version 3 schema',
      () async {
        final connection = await verifier.startAt(from);
        final db = AppDatabase(connection);
        await verifier.migrateAndValidate(db, 3);
        await db.close();
      },
    );
  }

  test(
    'records saved at version 2 keep their values; the new ones are unknown',
    () async {
      final schema = await verifier.schemaAt(2);
      final old = v2.DatabaseAtV2(schema.newConnection());
      await old.customStatement(
        "INSERT INTO local_clinical_records (id, patient_id, encounter_date, "
        "psa_ng_ml, dre_finding, sync_state, created_at) VALUES "
        "('r-1', 'p-1', '2026-09-01', 6.4, 'NORMAL', 'synced', 0)",
      );
      await old.close();

      final db = AppDatabase(schema.newConnection());
      final record = (await db.select(db.localClinicalRecords).get()).single;
      expect(record.psaNgMl, 6.4);
      expect(record.biopsyHistory, isNull);
      expect(record.familyHistory, isNull);
      expect(record.symptoms, isNull);
      await db.close();
    },
  );

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
