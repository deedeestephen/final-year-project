import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/core/db/app_database.dart';
import 'package:pca_mhealth/core/db/local_store.dart';
import 'package:pca_mhealth/core/network/api_client.dart';
import 'package:pca_mhealth/core/network/api_exception.dart';
import 'package:pca_mhealth/features/auth/presentation/register_account_screen.dart';
import 'package:pca_mhealth/features/patient/data/patient_repository.dart';
import 'package:pca_mhealth/features/patient/presentation/learn_screen.dart';
import 'package:pca_mhealth/features/patient/presentation/my_home_screen.dart';
import 'package:pca_mhealth/features/patient/presentation/my_results_screen.dart';
import 'package:pca_mhealth/features/patient/presentation/profile_screens.dart';

import '../../support/app_harness.dart';
import '../../support/fakes.dart';
import '../../support/test_db.dart';

Map<String, dynamic> patientView() => {
  'id': 'p-1',
  'mrn': 'SYN-0001',
  'givenName': 'SYNTHETIC',
  'familyName': 'Patient 001',
  'ageYears': 68,
  'regionClass': 'URBAN',
  'version': 1,
  'facilityId': 'f-1',
  'nationalIdMasked': '*******78/1',
  'phone': null,
  'dateOfBirth': '1958-03-14',
  'district': 'Lusaka',
  'accountUserId': 'u-1',
  'isSynthetic': true,
  'clientUuid': null,
  'createdAt': '2026-09-01T10:00:00.000Z',
  'updatedAt': '2026-09-01T10:00:00.000Z',
};

Map<String, dynamic> recordView(String id, String date, double psa) => {
  'id': id,
  'patientId': 'p-1',
  'facilityId': 'f-1',
  'recordedById': 'c-1',
  'encounterDate': date,
  'psaNgMl': psa,
  'freePsaNgMl': 1.1,
  'freeToTotalPsaRatio': 0.2,
  'dreFinding': 'ENLARGED_SMOOTH',
  'piradsScore': 3,
  'prostateVolumeMl': 42.0,
  'psaDensity': 0.13,
  'biopsyHistory': 'UNKNOWN',
  'familyHistory': null,
  'symptoms': null,
  'notes': null,
  'version': 1,
  'clientUuid': null,
  'createdAt': '${date}T08:00:00.000Z',
};

Map<String, dynamic> message(String id, {bool read = false}) => {
  'id': id,
  'type': 'clinical_record.created',
  'title': 'New screening record',
  'body': 'A new screening record was added. Open My results to see it.',
  'readAt': read ? '2026-09-02T10:00:00.000Z' : null,
  'createdAt': '2026-09-02T09:00:00.000Z',
};

void main() {
  late FakeBackend backend;
  late InMemoryTokenStore store;
  late AppDatabase db;

  setUp(() {
    db = memoryDatabase();
    store = InMemoryTokenStore();
    backend = FakeBackend()
      ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
      ..on('GET /users/me', FakeResponse(200, userJson(roles: ['PATIENT'])))
      ..on('POST /auth/logout', const FakeResponse(204))
      ..on('GET /patients/me', FakeResponse(200, patientView()))
      ..on(
        'GET /patients/me/clinical-records',
        FakeResponse(200, [
          recordView('r-2', '2026-09-01', 6.8),
          recordView('r-1', '2025-08-10', 5.2),
        ]),
      )
      ..on(
        'GET /notifications',
        FakeResponse(200, {
          'items': [message('n-2'), message('n-1'), message('n-0', read: true)],
          'unreadCount': 2,
          'page': 1,
          'pageSize': 50,
          'total': 3,
        }),
      )
      ..on(
        'GET /patients/me/consents',
        const FakeResponse(200, [
          {
            'id': 'c-ai',
            'patientId': 'p-1',
            'type': 'AI_ANALYSIS',
            'status': 'GRANTED',
            'method': 'DIGITAL',
            'consentTextVersion': 'v1',
            'grantedAt': '2026-08-01T09:00:00.000Z',
            'withdrawnAt': null,
            'version': 1,
          },
        ]),
      )
      ..on(
        'POST /notifications/n-2/read',
        FakeResponse(200, message('n-2', read: true)),
      )
      ..on(
        'POST /notifications/read-all',
        const FakeResponse(200, {'updated': 1}),
      )
      ..on(
        'POST /patients/me/consents/c-ai/withdraw',
        const FakeResponse(200, {}),
      );
  });

  Future<void> signInAsPatient(WidgetTester tester) async {
    await pumpApp(tester, backend: backend, store: store, database: db);
    await tester.enter('login.email', 'patient@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
  }

  Future<void> openTab(WidgetTester tester, String label) async {
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text(label),
      ),
    );
    await settle(tester);
  }

  testWidgets('home shows the latest visit and unread messages', (
    tester,
  ) async {
    await signInAsPatient(tester);
    expect(find.text('Hello, Demo Clinician'), findsOneWidget);
    expect(find.text('Latest screening: 2026-09-01'), findsOneWidget);
    expect(find.text('2 unread messages'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Ask a question (assistant)'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Symptom check'), findsOneWidget);
    expect(find.text('Coming in build phase 13'), findsWidgets);
  });

  testWidgets(
    'results show the values and the clinician note, and nothing that interprets them',
    (tester) async {
      await signInAsPatient(tester);
      await openTab(tester, 'Results');
      expect(find.text(MyResultsScreen.note), findsOneWidget);
      expect(find.text('Visit on 2026-09-01'), findsOneWidget);
      expect(find.text('6.8 ng/mL'), findsOneWidget);
      expect(find.text('Enlarged, smooth'), findsNWidgets(2));
      expect(find.text('3'), findsNWidgets(2));
      for (final word in [
        'risk',
        'High',
        'high',
        'Low',
        'abnormal',
        'cancer',
      ]) {
        expect(find.textContaining(word), findsNothing, reason: word);
      }
    },
  );

  testWidgets('messages: tap marks one read, and all can be marked read', (
    tester,
  ) async {
    await signInAsPatient(tester);
    await openTab(tester, 'Messages');
    expect(find.text('New screening record'), findsNWidgets(3));
    await tester.tap(find.byKey(const Key('message.n-2')));
    await settle(tester);
    expect(backend.calls, contains('POST /notifications/n-2/read'));
    await tester.tapKey('messages.readAll');
    expect(backend.calls, contains('POST /notifications/read-all'));
  });

  testWidgets(
    'learn: articles open offline; Bemba and Nyanja wait for verified translations',
    (tester) async {
      await signInAsPatient(tester);
      await openTab(tester, 'Learn');
      expect(find.text(LearnScreen.pendingTranslation), findsOneWidget);
      final bemba = tester.widget<ChoiceChip>(
        find.byKey(const Key('learn.lang.bem')),
      );
      final nyanja = tester.widget<ChoiceChip>(
        find.byKey(const Key('learn.lang.nya')),
      );
      expect(bemba.onSelected, isNull);
      expect(nyanja.onSelected, isNull);

      await tester.tap(find.text('What is a PSA test?'));
      await settle(tester);
      expect(find.text('Why the level can be raised'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.textContaining('cancer.gov'),
        300,
        scrollable: find.byType(Scrollable).last,
      );
      expect(find.text('Sources'), findsOneWidget);
      expect(
        find.textContaining('Draft for review by a qualified clinician'),
        findsOneWidget,
      );
    },
  );

  testWidgets('"When to get help quickly" opens the urgent-care article', (
    tester,
  ) async {
    await signInAsPatient(tester);
    await tester.tapKey('home.getHelp');
    // The library is read from the app's assets (real I/O): wait for it.
    final heading = find.text('Go to a clinic or hospital straight away if');
    for (var i = 0; i < 40 && heading.evaluate().isEmpty; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 50)),
      );
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(
      find.text('Go to a clinic or hospital straight away if'),
      findsOneWidget,
    );
  });

  testWidgets('consent withdrawal asks first and explains what it means', (
    tester,
  ) async {
    await signInAsPatient(tester);
    await openTab(tester, 'Profile');
    expect(find.text('SYNTHETIC Patient 001'), findsOneWidget);
    await tester.tapKey('profile.consents');
    expect(find.text('AI-assisted analysis of your results'), findsOneWidget);

    await tester.tapKey('consent.withdraw.c-ai');
    expect(
      find.textContaining('Your clinician will still look after you.'),
      findsOneWidget,
    );
    await tester.tap(find.text('Cancel'));
    await settle(tester);
    expect(
      backend.calls,
      isNot(contains('POST /patients/me/consents/c-ai/withdraw')),
    );

    await tester.tapKey('consent.withdraw.c-ai');
    await tester.tapKey('consent.confirmWithdraw');
    expect(backend.calls, contains('POST /patients/me/consents/c-ai/withdraw'));
    expect(find.text('Consent withdrawn.'), findsOneWidget);
  });

  testWidgets('reports and password change are reachable from Profile', (
    tester,
  ) async {
    backend.on('POST /auth/change-password', const FakeResponse(204));
    await signInAsPatient(tester);
    await openTab(tester, 'Profile');
    await tester.tapKey('profile.reports');
    expect(find.text(MyReportsScreen.empty), findsOneWidget);
    await tester.pageBack();
    await settle(tester);

    await tester.tapKey('profile.password');
    expect(find.text('Change password'), findsWidgets);
    expect(
      find.text('Sign out'),
      findsNothing,
      reason: 'not the forced change',
    );
    await tester.enter('change.current', 'a-password-1234');
    await tester.enter('change.new', 'a-new-password-5678');
    await tester.enter('change.confirm', 'a-new-password-5678');
    await tester.tapKey('change.submit');
    expect(find.text('Password changed.'), findsOneWidget);
    expect(find.text('My consents'), findsOneWidget, reason: 'back on Profile');
  });

  testWidgets('an account not linked to a clinic record explains what to do', (
    tester,
  ) async {
    backend.on('GET /patients/me', FakeResponse.error(404, 'NOT_FOUND'));
    await signInAsPatient(tester);
    expect(find.textContaining(NotLinkedCard.text), findsOneWidget);
    expect(find.text('clinician@demo.pca-mhealth.test'), findsOneWidget);
    await openTab(tester, 'Results');
    expect(
      find.text(
        'Your results will appear here once your clinic links your account.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('sign-out from Profile removes the saved patient data', (
    tester,
  ) async {
    await signInAsPatient(tester);
    final local = LocalStore(db);
    expect(await local.meta('patient.profile'), isNotNull);
    await openTab(tester, 'Profile');
    await tester.tapKey('profile.signOut');
    expect(find.byKey(const Key('login.email')), findsOneWidget);
    expect(await local.meta('patient.profile'), isNull);
  });

  group('create an account', () {
    Future<void> open(WidgetTester tester) async {
      await pumpApp(tester, backend: backend, store: store, database: db);
      await tester.tapKey('login.createAccount');
    }

    testWidgets('checks the form', (tester) async {
      await open(tester);
      await tester.tapKey('account.submit');
      expect(find.text('Enter your name.'), findsOneWidget);
      expect(find.text('Enter your email address.'), findsOneWidget);
      expect(find.text('Use at least 12 characters.'), findsOneWidget);
      await tester.enter('account.password', 'a-long-password-1');
      await tester.enter('account.confirm', 'a-long-password-2');
      await tester.tapKey('account.submit');
      expect(find.text('The passwords do not match.'), findsOneWidget);
      expect(backend.calls, isNot(contains('POST /auth/register')));
    });

    Future<void> fill(WidgetTester tester) async {
      await tester.enter('account.name', 'Mwamba B.');
      await tester.enter('account.email', 'new.patient@example.test');
      await tester.enter('account.password', 'a-long-password-1');
      await tester.enter('account.confirm', 'a-long-password-1');
      await tester.tapKey('account.submit');
    }

    testWidgets('creates the account and points to sign-in', (tester) async {
      backend.on('POST /auth/register', const FakeResponse(201, {'id': 'x'}));
      await open(tester);
      await fill(tester);
      expect(find.text(RegisterAccountScreen.done), findsOneWidget);
      expect(backend.last('POST /auth/register').body, {
        'displayName': 'Mwamba B.',
        'email': 'new.patient@example.test',
        'password': 'a-long-password-1',
      });
      await tester.tapKey('register.toSignIn');
      expect(find.byKey(const Key('login.email')), findsOneWidget);
    });

    testWidgets('a taken email gets a neutral message', (tester) async {
      backend.on('POST /auth/register', FakeResponse.error(409, 'CONFLICT'));
      await open(tester);
      await fill(tester);
      expect(
        find.textContaining('This email cannot be used for a new account.'),
        findsOneWidget,
      );
    });
  });

  group('PatientRepository offline copy', () {
    late PatientRepository repo;

    setUp(() {
      store.tokens = savedTokens;
      repo = PatientRepository(
        ApiClient(
          baseUrl: 'http://t/api/v1',
          tokenStore: store,
          adapter: backend.adapter,
        ),
        LocalStore(db),
        now: () => DateTime(2026, 9, 24, 9, 30),
      );
    });

    test('offline returns the last saved copy, marked as offline', () async {
      final online = await repo.records();
      expect(online.offline, isFalse);
      expect(online.value, hasLength(2));

      backend.isOffline = true;
      final offline = await repo.records();
      expect(offline.offline, isTrue);
      expect(offline.value.first.psaNgMl, 6.8);
      expect(offline.fetchedAt, DateTime(2026, 9, 24, 9, 30));
    });

    test('offline with nothing saved yet is an error', () async {
      backend.isOffline = true;
      await expectLater(
        repo.inbox(),
        throwsA(
          isA<ApiException>().having((e) => e.isNetwork, 'network', true),
        ),
      );
    });

    test('a not-linked account is not an error', () async {
      backend.on('GET /patients/me', FakeResponse.error(404, 'NOT_FOUND'));
      expect((await repo.profile()).value, isNull);
    });

    test('server errors are not hidden behind the saved copy', () async {
      await repo.consents();
      backend.on(
        'GET /patients/me/consents',
        FakeResponse.error(500, 'INTERNAL_ERROR'),
      );
      await expectLater(repo.consents(), throwsA(isA<ApiException>()));
    });
  });
}
