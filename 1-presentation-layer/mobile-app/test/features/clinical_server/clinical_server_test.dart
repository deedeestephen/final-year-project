import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/core/db/app_database.dart';
import 'package:pca_mhealth/features/clinical_server/application/clinical_server_providers.dart';

import '../../support/app_harness.dart';
import '../../support/fakes.dart';
import '../../support/test_db.dart';

/// Phase 9 screens through the real app (router, local database, sync and
/// upload queue) against a scripted backend. All data is synthetic.
void main() {
  late FakeBackend backend;
  late InMemoryTokenStore store;
  late AppDatabase db;
  late List<Map<String, dynamic>> consents;
  late Directory scratch;

  const patientPath = '/patients/srv-p1';

  Map<String, dynamic> consentJson(String type, {String status = 'GRANTED'}) =>
      {
        'id': 'c-$type',
        'type': type,
        'status': status,
        'method': 'WRITTEN',
        'grantedAt': '2026-09-20T08:00:00Z',
        'withdrawnAt': status == 'WITHDRAWN' ? '2026-09-21T08:00:00Z' : null,
      };

  Map<String, dynamic> mockJob({String status = 'SUCCEEDED'}) => {
    'id': 'job-1',
    'patientId': 'srv-p1',
    'patientMrn': 'MRN-SYN-0001',
    'status': status,
    'error': null,
    'createdAt': '2026-09-24T09:00:00Z',
    'finishedAt': status == 'SUCCEEDED' ? '2026-09-24T09:00:05Z' : null,
    'report': status != 'SUCCEEDED'
        ? null
        : {
            'provenance': 'DEVELOPMENT_MOCK',
            'isMock': true,
            'disclaimer': 'DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT.',
            'modelVersions': {'clinical': 'mock-0.1.0'},
            'outputs': {
              'pcaProbability': 0.42,
              'probabilityInterval': [0.3, 0.55],
              'gleasonGradeGroup': null,
              'modulesUsed': ['clinical'],
              'modulesSkipped': [
                {'module': 'mri', 'reason': 'No MRI study for this patient.'},
              ],
            },
            'explanations': [
              {
                'id': null,
                'kind': 'GRADCAM',
                'module': 'mri',
                'available': false,
                'hasImage': false,
                'unavailableReason':
                    'No heatmap: the MRI model did not run for this patient.',
                'values': null,
              },
            ],
          },
  };

  setUp(() {
    db = memoryDatabase();
    store = InMemoryTokenStore();
    consents = [];
    scratch = Directory.systemTemp.createTempSync('pca-picked-');
    addTearDown(() {
      if (scratch.existsSync()) scratch.deleteSync(recursive: true);
    });
    backend = FakeBackend()
      ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
      ..on('GET /users/me', FakeResponse(200, userJson()))
      ..on('POST /auth/logout', const FakeResponse(204))
      // One patient and one screening record already on the server.
      ..on(
        'GET /sync/changes',
        const FakeResponse(200, {
          'patients': [
            {
              'id': 'srv-p1',
              'clientUuid': 'p-1',
              'mrn': 'MRN-SYN-0001',
              'givenName': 'SYNTHETIC',
              'familyName': 'Phiri',
              'dateOfBirth': '1958-03-02',
              'regionClass': 'RURAL',
              'district': null,
              'phone': null,
              'nationalIdMasked': null,
              'version': 1,
              'updatedAt': '2026-09-20T08:00:00Z',
            },
          ],
          'clinicalRecords': [
            {
              'id': 'srv-r1',
              'clientUuid': 'r-1',
              'patientId': 'srv-p1',
              'encounterDate': '2026-09-20',
              'psaNgMl': 6.4,
              'freePsaNgMl': null,
              'dreFinding': 'NORMAL',
              'piradsScore': null,
              'prostateVolumeMl': null,
              'notes': null,
              'createdAt': '2026-09-20T08:00:00Z',
            },
          ],
          'cursor': 'c1',
          'hasMore': false,
        }),
      )
      ..on('GET $patientPath/imaging', const FakeResponse(200, []))
      ..on('GET $patientPath/histopathology', const FakeResponse(200, []))
      ..on('GET $patientPath/ai-jobs', const FakeResponse(200, []));
    backend.routes['GET $patientPath/consents'] = (_) async =>
        FakeResponse(200, consents);
  });

  /// Lets real file operations (copying into the queue, reading for the
  /// upload) run until [done]; they do not advance in widget tests' fake
  /// time, and each step needs a real turn of the event loop.
  Future<void> realIo(WidgetTester tester, bool Function() done) async {
    for (var i = 0; i < 40 && !done(); i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 50)),
      );
      await tester.pump(const Duration(milliseconds: 50));
    }
    await settle(tester);
  }

  Future<void> signIn(
    WidgetTester tester, {
    FakeConnectivity? connectivity,
    PickedFile? picked,
  }) async {
    await pumpApp(
      tester,
      backend: backend,
      store: store,
      database: db,
      connectivity: connectivity,
      overrides: [filePickerProvider.overrideWithValue(() async => picked)],
    );
    await tester.enter('login.email', 'clinician@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
  }

  Future<void> openPatient(WidgetTester tester) async {
    await tester.tap(find.text('Patients'));
    await settle(tester);
    await tester.tap(find.textContaining('Phiri').first);
    await settle(tester);
  }

  testWidgets('a clinician records consent and can withdraw it', (
    tester,
  ) async {
    backend.routes['POST $patientPath/consents'] = (r) async {
      final c = consentJson((r.body as Map)['type'] as String);
      consents.add(c);
      return FakeResponse(201, c);
    };
    backend.routes['POST $patientPath/consents/c-AI_ANALYSIS/withdraw'] =
        (_) async {
          final c = consentJson('AI_ANALYSIS', status: 'WITHDRAWN');
          consents
            ..clear()
            ..add(c);
          return FakeResponse(200, c);
        };

    await signIn(tester);
    await openPatient(tester);
    await tester.tapKey('patient.consents');
    await tester.tapKey('consent.add');
    await tester.tapKey('consent.save');

    expect(backend.last('POST $patientPath/consents').body, {
      'type': 'AI_ANALYSIS',
      'method': 'WRITTEN',
      'consentTextVersion': 'v1',
    });
    expect(find.byKey(const Key('consent.withdraw.AI_ANALYSIS')), findsOne);

    await tester.tapKey('consent.withdraw.AI_ANALYSIS');
    await tester.tapKey('consent.confirmWithdraw');
    expect(
      backend.calls,
      contains('POST $patientPath/consents/c-AI_ANALYSIS/withdraw'),
    );
    expect(find.byKey(const Key('consent.withdraw.AI_ANALYSIS')), findsNothing);
  });

  testWidgets('an image picked while offline waits on the phone, then '
      'uploads once online', (tester) async {
    final file = File('${scratch.path}/synthetic-mri.dcm')
      ..writeAsBytesSync(List.filled(2048, 7));
    final connectivity = FakeConnectivity();
    var received = 0; // uploads that reached the server
    backend.routes['POST $patientPath/imaging'] = (r) async {
      received++;
      return const FakeResponse(201, {
        'id': 'img-1',
        'modality': 'MRI',
        'mimeType': 'application/dicom',
        'sizeBytes': 2048,
        'createdAt': '2026-09-24T09:00:00Z',
      });
    };

    await signIn(
      tester,
      connectivity: connectivity,
      picked: PickedFile(file.path, 'synthetic-mri.dcm'),
    );
    await openPatient(tester);
    await tester.tapKey('patient.imaging');

    // The phone loses its connection before saving.
    backend.isOffline = true;
    connectivity.set(false);
    await tester.tapKey('imaging.add');
    await tester.tapKey('upload.pick');
    expect(find.text('synthetic-mri.dcm'), findsOneWidget);
    const waiting = 'Saved on this phone, will upload when online';
    await tester.tapKey('upload.save');
    await realIo(tester, () => find.text(waiting).evaluate().isNotEmpty);

    expect(find.text(waiting), findsOneWidget);
    expect(received, 0);

    // Back online: the user taps "Try now" and the file goes up once.
    backend
      ..isOffline = false
      ..on(
        'GET $patientPath/imaging',
        const FakeResponse(200, [
          {
            'id': 'img-1',
            'modality': 'MRI',
            'mimeType': 'application/dicom',
            'sizeBytes': 2048,
            'createdAt': '2026-09-24T09:00:00Z',
          },
        ]),
      );
    connectivity.set(true);
    await settle(tester);
    await tester.tap(find.text('Try now'));
    await realIo(
      tester,
      () =>
          received > 0 &&
          find.byKey(const Key('imaging.study.img-1')).evaluate().isNotEmpty,
    );

    final upload = backend.last('POST $patientPath/imaging').body as Map;
    expect((upload['fields'] as Map)['modality'], 'MRI');
    expect(upload['files'], ['synthetic-mri.dcm']);
    expect(received, 1);
    expect(find.text(waiting), findsNothing);
    expect(find.byKey(const Key('imaging.study.img-1')), findsOneWidget);
    expect(
      await tester.runAsync(() => db.select(db.pendingUploads).get()),
      isEmpty,
    );
  });

  testWidgets('AI analysis explains why it cannot be requested yet', (
    tester,
  ) async {
    final connectivity = FakeConnectivity();
    await signIn(tester, connectivity: connectivity);
    await openPatient(tester);
    await tester.tapKey('patient.ai');

    Text reason() =>
        tester.widget<Text>(find.byKey(const Key('ai.disabledReason')));
    FilledButton requestButton() => tester.widget<FilledButton>(
      find.ancestor(
        of: find.text('Request AI analysis'),
        matching: find.byWidgetPredicate((w) => w is FilledButton),
      ),
    );

    expect(reason().data, contains('has not consented to AI analysis'));
    expect(requestButton().onPressed, isNull);

    connectivity.set(false);
    await settle(tester);
    expect(reason().data, contains('offline'));
    expect(requestButton().onPressed, isNull);
  });

  testWidgets('with consent a clinician requests an analysis and reads the '
      'labelled mock report', (tester) async {
    consents.add(consentJson('AI_ANALYSIS'));
    var requested = false;
    backend.routes['POST $patientPath/ai-jobs'] = (_) async {
      requested = true;
      return FakeResponse(202, mockJob(status: 'QUEUED'));
    };
    backend.routes['GET $patientPath/ai-jobs'] = (_) async =>
        FakeResponse(200, requested ? [mockJob()] : []);
    backend.on('GET /ai-jobs/job-1', FakeResponse(200, mockJob()));

    await signIn(tester);
    await openPatient(tester);
    await tester.tapKey('patient.ai');
    expect(find.byKey(const Key('ai.disabledReason')), findsNothing);

    await tester.tapKey('ai.request');
    expect(backend.calls, contains('POST $patientPath/ai-jobs'));
    await tester.tapKey('ai.job.job-1');

    expect(find.byKey(const Key('ai.report.banner')), findsOneWidget);
    expect(find.textContaining('DEVELOPMENT MOCK DATA'), findsWidgets);
    expect(find.text('42%'), findsOneWidget);
    expect(
      find.textContaining('No MRI study for this patient.'),
      findsOneWidget,
    );
    await tester.reveal('ai.report.evaluation');
    expect(
      find.text('No heatmap: the MRI model did not run for this patient.'),
      findsOneWidget,
    );
    expect(
      find.text('Accuracy figures: Evaluation data not yet available.'),
      findsOneWidget,
    );
    // No image is fetched when there is none.
    expect(
      backend.calls.where((c) => c.startsWith('GET /explanations/')),
      isEmpty,
    );
  });

  testWidgets('a pathologist reviews a slide from the queue', (tester) async {
    final pathologist = userJson(roles: ['PATHOLOGIST']);
    var reviewed = false;
    Map<String, dynamic> slide() => {
      'id': 'slide-1',
      'patientId': 'srv-p1',
      'format': 'SVS',
      'stain': 'H&E',
      'biopsyDate': '2026-09-10',
      'gleasonPrimary': reviewed ? 4 : null,
      'gleasonSecondary': reviewed ? 3 : null,
      'isupGradeGroup': reviewed ? 3 : null,
      'reviewedAt': reviewed ? '2026-09-24T10:00:00Z' : null,
      'createdAt': '2026-09-23T10:00:00Z',
    };
    backend
      ..on('POST /auth/login', FakeResponse(200, loginJson(pathologist)))
      ..on('GET /users/me', FakeResponse(200, pathologist));
    backend.routes['GET /histopathology/review-queue'] = (_) async =>
        FakeResponse(200, reviewed ? [] : [slide()]);
    backend.routes['GET /histopathology/slide-1'] = (_) async =>
        FakeResponse(200, slide());
    backend.routes['POST /histopathology/slide-1/review'] = (_) async {
      reviewed = true;
      return FakeResponse(200, slide());
    };

    await signIn(tester);
    await tester.tap(find.text('Review queue'));
    await settle(tester);
    await tester.tapKey('review.slide.slide-1');

    await tester.tapKey('review.save');
    expect(find.text('Choose the primary pattern.'), findsOneWidget);

    for (final (key, option) in [
      ('review.primary', 'Pattern 4'),
      ('review.secondary', 'Pattern 3'),
    ]) {
      await tester.tapKey(key);
      await tester.tap(find.text(option).last);
      await settle(tester);
    }
    await tester.tapKey('review.save');

    expect(backend.last('POST /histopathology/slide-1/review').body, {
      'gleasonPrimary': 4,
      'gleasonSecondary': 3,
    });
    expect(find.byKey(const Key('review.result')), findsOneWidget);
    expect(find.text('4 + 3 = 7'), findsOneWidget);
    expect(find.text('3'), findsWidgets);
  });
}
