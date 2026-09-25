import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/core/db/app_database.dart';
import 'package:pca_mhealth/features/patients/presentation/form_widgets.dart';

import '../../support/app_harness.dart';
import '../../support/fakes.dart';
import '../../support/test_db.dart';

/// Clinician flows through the real app: local database, sync engine and
/// router, against a scripted backend.
void main() {
  late FakeBackend backend;
  late InMemoryTokenStore store;
  late AppDatabase db;
  late List<Map<String, dynamic>> Function(List<Map<String, dynamic>> ops)
  respond;
  var ids = 0;

  setUp(() {
    db = memoryDatabase();
    store = InMemoryTokenStore();
    ids = 0;
    respond = (ops) => [
      for (final op in ops)
        {
          'idempotencyKey': op['idempotencyKey'],
          'result': 'APPLIED',
          'entityType': op['entityType'],
          'entityId': 'srv-${++ids}',
          'version': 1,
          'replayed': false,
        },
    ];
    backend = FakeBackend()
      ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
      ..on('GET /users/me', FakeResponse(200, userJson()))
      ..on('POST /auth/logout', const FakeResponse(204))
      ..on(
        'GET /sync/changes',
        const FakeResponse(200, {
          'patients': [],
          'clinicalRecords': [],
          'cursor': 'c1',
          'hasMore': false,
        }),
      );
    backend.routes['POST /sync'] = (r) async {
      final ops = ((r.body as Map)['operations'] as List)
          .cast<Map<String, dynamic>>();
      return FakeResponse(200, {
        'results': respond(ops),
        'serverTime': '2026-09-24T09:00:00Z',
      });
    };
  });

  Future<void> openPatients(WidgetTester tester) async {
    await pumpApp(tester, backend: backend, store: store, database: db);
    await tester.enter('login.email', 'clinician@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
    await tester.tap(find.text('Patients'));
    await settle(tester);
    expect(find.text('No patients on this device yet.'), findsOneWidget);
  }

  Future<void> choose(WidgetTester tester, String key, String option) async {
    await tester.ensureVisible(find.byKey(Key(key)));
    await tester.tap(find.byKey(Key(key)));
    await settle(tester);
    await tester.tap(find.text(option).last);
    await settle(tester);
  }

  Future<void> registerPatient(WidgetTester tester) async {
    await tester.tapKey('patients.register');
    await tester.enter('register.given', 'SYNTHETIC');
    await tester.enter('register.family', 'Banda');
    await tester.enter('register.dob', '1960-05-01');
    await choose(tester, 'register.region', 'Rural');
    await tester.enter('register.phone', '+260971234567');
    await tester.tapKey('register.save');
    // Let the "saved" snackbar time out, as it does on a phone.
    await tester.pump(const Duration(seconds: 5));
    await settle(tester);
  }

  testWidgets('the registration form checks fields before saving', (
    tester,
  ) async {
    await openPatients(tester);
    await tester.tapKey('patients.register');
    expect(find.text(SyntheticDataNotice.text), findsOneWidget);

    await tester.tapKey('register.save');
    expect(find.text('Enter the first name.'), findsOneWidget);
    expect(find.text('Enter the surname.'), findsOneWidget);
    expect(find.text('Use the format YYYY-MM-DD.'), findsOneWidget);
    expect(find.text('Choose the area type.'), findsOneWidget);

    await tester.enter('register.given', '<b>x</b>');
    await tester.enter('register.dob', '2999-01-01');
    await tester.enter('register.phone', 'call me');
    await tester.enter('register.nrc', '!!');
    await tester.tapKey('register.save');
    expect(
      find.text('Remove special characters such as < and >.'),
      findsOneWidget,
    );
    expect(
      find.text('The date must be between 1900 and today.'),
      findsOneWidget,
    );
    expect(
      find.text('Enter a phone number, e.g. +260971234567.'),
      findsOneWidget,
    );
    expect(
      find.text('Enter the NRC number, e.g. 123456/78/1.'),
      findsOneWidget,
    );

    await tester.enter('register.dob', '2023-02-30');
    await tester.tapKey('register.save');
    expect(find.text('This date does not exist.'), findsOneWidget);
    expect(await db.select(db.localPatients).get(), isEmpty);
  });

  testWidgets('offline: a patient is saved on the device and waits to sync', (
    tester,
  ) async {
    await openPatients(tester);
    backend.isOffline = true;
    await registerPatient(tester);

    expect(find.text('SYNTHETIC Banda'), findsOneWidget);
    expect(find.text('Saved on device'), findsWidgets);
    expect(find.text('Assigned after sync'), findsOneWidget);
    expect(
      find.text('Details can be edited after this patient has synced.'),
      findsOneWidget,
    );

    await tester.tap(find.byKey(const Key('sync.open')));
    await settle(tester);
    expect(find.text('1 change waiting to be sent.'), findsOneWidget);
    expect(find.textContaining('Could not reach the server'), findsOneWidget);

    // Back online: "Sync now" sends it.
    backend.isOffline = false;
    await tester.tapKey('sync.now');
    expect(find.text('Everything saved here has been sent.'), findsOneWidget);
    final saved = (await db.select(db.localPatients).get()).single;
    expect(saved.serverId, 'srv-1');
    expect(saved.syncState, RowSync.synced);
  });

  testWidgets('online: a new patient syncs straight away', (tester) async {
    await openPatients(tester);
    await registerPatient(tester);
    expect(find.text('Synced'), findsWidgets);
    expect(find.byKey(const Key('patient.edit')), findsOneWidget);
  });

  testWidgets('screening record: checks values and shows the saved record', (
    tester,
  ) async {
    await openPatients(tester);
    await registerPatient(tester);
    await tester.tapKey('patient.addRecord');

    await tester.enter('record.psa', '4.5');
    await tester.enter('record.freePsa', '6');
    await tester.enter('record.volume', '0.5');
    await tester.tapKey('record.save');
    expect(
      find.text('Free PSA cannot be higher than total PSA.'),
      findsOneWidget,
    );
    expect(find.text('Choose the DRE finding.'), findsOneWidget);
    expect(find.text('Enter a value from 1 to 500.'), findsOneWidget);

    await tester.enter('record.freePsa', '1.2');
    await tester.enter('record.volume', '42');
    await choose(tester, 'record.dre', 'Nodular');
    await choose(tester, 'record.pirads', '4: high');
    await tester.tapKey('record.save');

    expect(find.text('4.5 ng/mL'), findsOneWidget);
    expect(find.text('Nodular'), findsOneWidget);
    expect(find.text('4'), findsOneWidget);
    final record = (await db.select(db.localClinicalRecords).get()).single;
    expect(record.psaNgMl, 4.5);
    expect(record.piradsScore, 4);
    expect(record.syncState, RowSync.synced);
  });

  testWidgets('a change the server refuses can be discarded', (tester) async {
    respond = (ops) => [
      {
        'idempotencyKey': ops.single['idempotencyKey'],
        'result': 'REJECTED',
        'entityType': 'patient',
        'replayed': false,
        'error': {
          'code': 'DUPLICATE_PATIENT',
          'message': 'A patient with this national ID is already registered',
        },
      },
    ];
    await openPatients(tester);
    await registerPatient(tester);
    expect(find.text('Needs attention'), findsWidgets);

    await tester.tap(find.byKey(const Key('sync.open')));
    await settle(tester);
    expect(find.text('New patient: SYNTHETIC Banda'), findsOneWidget);
    expect(
      find.text('A patient with this national ID is already registered'),
      findsOneWidget,
    );
    await tester.tap(find.textContaining('Discard').first);
    await settle(tester);
    await tester.tap(find.widgetWithText(TextButton, 'Discard'));
    await settle(tester);
    expect(await db.select(db.localPatients).get(), isEmpty);
    expect(find.text('Everything saved here has been sent.'), findsOneWidget);
  });

  testWidgets('an edit that clashes shows both versions to choose from', (
    tester,
  ) async {
    await openPatients(tester);
    await registerPatient(tester);
    respond = (ops) => [
      {
        'idempotencyKey': ops.single['idempotencyKey'],
        'result': 'CONFLICT',
        'entityType': 'patient',
        'entityId': 'srv-1',
        'version': 2,
        'replayed': false,
        'error': {'code': 'VERSION_CONFLICT', 'message': 'changed'},
        'server': {
          'id': 'srv-1',
          'mrn': 'PCA-2026-000001',
          'givenName': 'SYNTHETIC',
          'familyName': 'Phiri',
          'dateOfBirth': '1960-05-01',
          'regionClass': 'RURAL',
          'district': null,
          'phone': '+260971234567',
          'nationalIdMasked': null,
          'version': 2,
          'updatedAt': '2026-09-24T09:00:00.000Z',
        },
      },
    ];
    await tester.tapKey('patient.edit');
    await tester.enter('edit.family', 'Mwale');
    await tester.tapKey('edit.save');
    expect(find.text('Needs attention'), findsWidgets);

    await tester.tap(find.byKey(const Key('sync.open')));
    await settle(tester);
    expect(find.text('Changed by someone else'), findsOneWidget);
    expect(find.text('Mwale'), findsOneWidget);
    expect(find.text('Phiri'), findsWidgets);
    await tester.tap(find.text('Keep server version'));
    await settle(tester);
    expect(find.text('Changed by someone else'), findsNothing);
    final p = (await db.select(db.localPatients).get()).single;
    expect(p.familyName, 'Phiri');
    expect(p.version, 2);
  });

  testWidgets('signing out warns about changes that are not sent yet', (
    tester,
  ) async {
    await openPatients(tester);
    backend.isOffline = true;
    await registerPatient(tester);
    await tester.pageBack();
    await settle(tester);
    await tester.pageBack();
    await settle(tester);

    await tester.tap(find.byTooltip('Open navigation menu'));
    await settle(tester);
    await tester.tapKey('home.signOut');
    expect(find.text('Unsent changes'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await settle(tester);
    expect(find.text('Welcome, Demo Clinician'), findsOneWidget);
    expect(await db.select(db.localPatients).get(), hasLength(1));
  });

  testWidgets('pathologists can view but not register patients', (
    tester,
  ) async {
    backend.on(
      'GET /users/me',
      FakeResponse(200, userJson(roles: ['PATHOLOGIST'])),
    );
    await pumpApp(tester, backend: backend, store: store, database: db);
    await tester.enter('login.email', 'pathologist@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
    await tester.tap(find.text('Patients'));
    await settle(tester);
    expect(find.byKey(const Key('patients.register')), findsNothing);
  });
}
