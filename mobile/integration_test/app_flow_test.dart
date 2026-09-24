import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:pca_mhealth/app/app.dart';
import 'package:pca_mhealth/core/config/app_env.dart';
import 'package:pca_mhealth/core/db/app_database.dart';
import 'package:pca_mhealth/core/db/local_store.dart';
import 'package:pca_mhealth/core/db/open_database.dart';
import 'package:pca_mhealth/core/providers.dart';
import 'package:pca_mhealth/core/storage/token_store.dart';

/// End-to-end on a real Android device or emulator, against the running
/// backend: real SQLCipher database, real secure storage, real network.
///
///   cd backend && npm run e2e:user      (prints a throwaway synthetic clinician)
///   cd mobile && flutter test integration_test -d DEVICE_ID \
///     --dart-define=API_BASE_URL=http://10.0.2.2:3000 \
///     --dart-define=E2E_EMAIL=... --dart-define=E2E_PASSWORD=...
///
/// Everything it creates is SYNTHETIC.
const _email = String.fromEnvironment('E2E_EMAIL');
const _password = String.fromEnvironment('E2E_PASSWORD');

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  Future<void> waitFor(
    WidgetTester tester,
    Finder finder, {
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 200));
      if (finder.evaluate().isNotEmpty) return;
    }
    throw TestFailure('Timed out waiting for $finder');
  }

  Future<void> tapKey(WidgetTester tester, String key) async {
    final f = find.byKey(Key(key));
    await tester.ensureVisible(f);
    await tester.pump();
    await tester.tap(f);
    await tester.pump(const Duration(milliseconds: 300));
  }

  Future<void> enter(WidgetTester tester, String key, String text) async {
    final f = find.byKey(Key(key));
    await tester.ensureVisible(f);
    await tester.enterText(f, text);
    await tester.pump();
  }

  testWidgets(
    'clinician registers a patient and a PSA record that reach the server',
    (tester) async {
      expect(_email, isNotEmpty, reason: 'pass --dart-define=E2E_EMAIL=...');

      // Real encrypted database, started clean.
      final AppDatabase db = await openAppDatabase();
      final cipher = await db.customSelect('PRAGMA cipher_version;').get();
      expect(
        cipher,
        isNotEmpty,
        reason: 'SQLCipher must be in use on the device',
      );
      final store = LocalStore(db);
      await store.wipe();
      await SecureTokenStore().clear();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [appDatabaseProvider.overrideWithValue(db)],
          child: const PcaApp(),
        ),
      );
      await waitFor(tester, find.byKey(const Key('login.email')));

      await enter(tester, 'login.email', _email);
      await enter(tester, 'login.password', _password);
      await tapKey(tester, 'login.submit');
      await waitFor(tester, find.text('Welcome, SYNTHETIC E2E Clinician'));

      await tester.tap(find.text('Patients').first);
      await waitFor(tester, find.byKey(const Key('patients.register')));
      await tapKey(tester, 'patients.register');
      await waitFor(tester, find.byKey(const Key('register.given')));

      final surname = 'E2E${DateTime.now().millisecondsSinceEpoch % 1000000}';
      await enter(tester, 'register.given', 'SYNTHETIC');
      await enter(tester, 'register.family', surname);
      await enter(tester, 'register.dob', '1961-07-15');
      await tapKey(tester, 'register.region');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Peri-urban').last);
      await tester.pumpAndSettle();
      await enter(tester, 'register.district', 'Chongwe');
      FocusManager.instance.primaryFocus?.unfocus();
      await tapKey(tester, 'register.save');

      // Saved locally, then synced automatically.
      await waitFor(tester, find.text('SYNTHETIC $surname'));
      await waitFor(tester, find.byKey(const Key('patient.edit')));
      final synced = await waitForServerId(db, surname);
      // The server's record number arrives with the pull after the push, and
      // editing becomes available once the server has the patient.
      await waitFor(tester, find.textContaining('PCA-'));
      await tester.pump(const Duration(seconds: 1));
      final edit = tester.widget<ButtonStyleButton>(
        find.byKey(const Key('patient.edit')),
      );
      expect(edit.onPressed, isNotNull);

      await tester.pump(const Duration(seconds: 5)); // snackbar away
      await tapKey(tester, 'patient.addRecord');
      await waitFor(tester, find.byKey(const Key('record.psa')));
      await enter(tester, 'record.psa', '6.8');
      await enter(tester, 'record.freePsa', '1.1');
      await tapKey(tester, 'record.dre');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Enlarged, smooth').last);
      await tester.pumpAndSettle();
      FocusManager.instance.primaryFocus?.unfocus();
      await tapKey(tester, 'record.save');
      await waitFor(tester, find.text('6.8 ng/mL'));
      await waitFor(tester, find.text('Synced'));
      // Hold the final screen briefly (screenshots for the docs).
      await tester.pump(const Duration(seconds: 6));

      // Check with the server itself.
      final api = Dio(BaseOptions(baseUrl: AppEnv.apiRoot));
      final login = await api.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': _email, 'password': _password},
      );
      final auth = Options(
        headers: {'Authorization': 'Bearer ${login.data!['accessToken']}'},
      );
      final patient = await api.get<Map<String, dynamic>>(
        '/patients/$synced',
        options: auth,
      );
      expect(patient.data!['familyName'], surname);
      expect(patient.data!['district'], 'Chongwe');

      List<dynamic> records = const [];
      for (var i = 0; i < 50 && records.isEmpty; i++) {
        await tester.pump(const Duration(milliseconds: 200));
        records = (await api.get<List<dynamic>>(
          '/patients/$synced/clinical-records',
          options: auth,
        )).data!;
      }
      expect(records, hasLength(1));
      expect((records.single as Map)['psaNgMl'], 6.8);
      expect((records.single as Map)['dreFinding'], 'ENLARGED_SMOOTH');

      // Leave the device clean.
      await store.wipe();
    },
  );
}

Future<String> waitForServerId(AppDatabase db, String surname) async {
  for (var i = 0; i < 150; i++) {
    final row = await (db.select(
      db.localPatients,
    )..where((p) => p.familyName.equals(surname))).getSingleOrNull();
    if (row?.serverId != null && row!.syncState == RowSync.synced) {
      return row.serverId!;
    }
    await Future<void>.delayed(const Duration(milliseconds: 200));
  }
  throw TestFailure('Patient $surname did not sync');
}
