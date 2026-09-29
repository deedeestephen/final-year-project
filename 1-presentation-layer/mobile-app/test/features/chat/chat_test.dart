import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/app_harness.dart';
import '../../support/fakes.dart';

Map<String, dynamic> _answer({
  String safety = 'OK',
  String? model,
  String text =
      'PSA (prostate-specific antigen) is a protein made by the prostate.',
  List<Map<String, String>> sources = const [
    {
      'name': 'NHS: PSA testing',
      'url': 'https://www.nhs.uk/conditions/prostate-cancer/psa-testing/',
    },
  ],
}) => {
  'question': {
    'id': 'q-1',
    'role': 'user',
    'text': 'What does a PSA test measure?',
    'at': '2026-09-29T08:00:00.000Z',
  },
  'answer': {
    'id': 'a-1',
    'role': 'assistant',
    'text': text,
    'at': '2026-09-29T08:00:01.000Z',
    'sources': sources,
    'safety': safety,
    'mode': model != null
        ? 'GENERATED'
        : safety == 'OK'
        ? 'EXTRACTIVE'
        : 'FIXED',
    'model': ?model,
    'disclaimer':
        'This is general information, not medical advice. Speak to your clinician about your own health.',
    if (safety == 'OK')
      'reviewStatus':
          'Draft for review by a qualified clinician before use with patients.',
  },
};

Map<String, dynamic> _patientView() => {
  'id': 'p-1',
  'mrn': 'SYN-0001',
  'givenName': 'SYNTHETIC',
  'familyName': 'Patient 001',
  'ageYears': 68,
  'regionClass': 'URBAN',
  'version': 1,
  'facilityId': 'f-1',
  'nationalIdMasked': null,
  'phone': null,
  'dateOfBirth': '1958-03-14',
  'district': null,
  'accountUserId': 'u-1',
  'isSynthetic': true,
  'clientUuid': null,
  'createdAt': '2026-09-01T10:00:00.000Z',
  'updatedAt': '2026-09-01T10:00:00.000Z',
};

void main() {
  late FakeBackend backend;
  late InMemoryTokenStore store;

  FakeBackend backendFor(List<String> roles) => FakeBackend()
    ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
    ..on('GET /users/me', FakeResponse(200, userJson(roles: roles)))
    ..on('GET /patients/me', FakeResponse(200, _patientView()))
    ..on('GET /patients/me/clinical-records', const FakeResponse(200, []))
    ..on(
      'GET /notifications',
      const FakeResponse(200, {
        'items': [],
        'unreadCount': 0,
        'page': 1,
        'pageSize': 50,
        'total': 0,
      }),
    )
    ..on('POST /chat/conversations', const FakeResponse(201, {'id': 'c-1'}))
    ..on('POST /chat/conversations/c-1/messages', FakeResponse(200, _answer()))
    ..on('DELETE /chat/conversations/c-1', const FakeResponse(204));

  Future<void> openChat(
    WidgetTester tester, {
    List<String> roles = const ['PATIENT'],
    FakeConnectivity? connectivity,
  }) async {
    backend = backendFor(roles);
    store = InMemoryTokenStore();
    await pumpApp(
      tester,
      backend: backend,
      store: store,
      connectivity: connectivity,
    );
    await tester.enter('login.email', 'someone@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
    if (roles.contains('PATIENT')) {
      await tester.tapKey('home.chat');
    } else {
      await tester.tap(find.text('Ask the assistant'));
      await settle(tester);
    }
  }

  testWidgets('a patient asks a question and gets a quoted answer with its '
      'source, status and disclaimer', (tester) async {
    await openChat(tester);
    expect(find.text('Ask a question'), findsWidgets);
    expect(
      find.textContaining('never tells you what your results mean'),
      findsOneWidget,
    );
    await tester.tapKey('chat.suggestion.0');

    expect(backend.calls, contains('POST /chat/conversations'));
    expect(backend.last('POST /chat/conversations/c-1/messages').body, {
      'text': 'What does a PSA test measure?',
    });
    expect(
      find.textContaining('a protein made by the prostate'),
      findsOneWidget,
    );
    expect(find.text('Source'), findsOneWidget);
    expect(find.textContaining('NHS: PSA testing'), findsOneWidget);
    expect(
      find.textContaining('Content status: Draft for review'),
      findsOneWidget,
    );
    expect(find.textContaining('not medical advice'), findsOneWidget);
  });

  testWidgets('typed questions are sent, and the conversation is reused', (
    tester,
  ) async {
    await openChat(tester);
    await tester.enter('chat.input', 'What does a PSA test measure?');
    await tester.tapKey('chat.send');
    await tester.enter('chat.input', 'And the DRE?');
    await tester.tapKey('chat.send');
    expect(
      backend.calls.where((c) => c == 'POST /chat/conversations'),
      hasLength(1),
    );
    expect(
      backend.calls.where((c) => c == 'POST /chat/conversations/c-1/messages'),
      hasLength(2),
    );
  });

  testWidgets(
    'urgent care, declined and "no reviewed information" are labelled '
    'in words',
    (tester) async {
      await openChat(tester);
      for (final (safety, label) in [
        ('URGENT_CARE', 'Urgent'),
        ('DECLINED', 'I cannot help with that'),
        ('NO_SOURCE', 'No reviewed information'),
      ]) {
        backend.on(
          'POST /chat/conversations/c-1/messages',
          FakeResponse(
            200,
            _answer(
              safety: safety,
              text: 'Fixed text for $safety.',
              sources: [],
            ),
          ),
        );
        await tester.enter('chat.input', 'question');
        await tester.tapKey('chat.send');
        expect(find.text(label), findsOneWidget);
        expect(find.text('Fixed text for $safety.'), findsOneWidget);
      }
    },
  );

  testWidgets('says when the server limits questions, and keeps the question', (
    tester,
  ) async {
    await openChat(tester);
    backend.on(
      'POST /chat/conversations/c-1/messages',
      const FakeResponse(
        429,
        {
          'error': {
            'status': 429,
            'code': 'RATE_LIMITED',
            'message': 'Too many questions',
            'requestId': 'req-1',
          },
        },
        {'retry-after': '600'},
      ),
    );
    await tester.enter('chat.input', 'One more question');
    await tester.tapKey('chat.send');
    expect(find.byKey(const Key('chat.error')), findsOneWidget);
    expect(find.textContaining('try again in 10 minutes'), findsOneWidget);
    expect(find.text('One more question'), findsOneWidget);
  });

  testWidgets('the assistant needs the internet', (tester) async {
    await openChat(tester, connectivity: FakeConnectivity(online: false));
    expect(find.byKey(const Key('chat.offline')), findsOneWidget);
    final send = tester.widget<IconButton>(find.byKey(const Key('chat.send')));
    expect(send.onPressed, isNull);
  });

  testWidgets('a conversation can be started again or deleted', (tester) async {
    await openChat(tester);
    await tester.tapKey('chat.suggestion.0');
    expect(find.byKey(const Key('chat.message.1')), findsOneWidget);

    await tester.tap(find.byKey(const Key('chat.menu')));
    await settle(tester);
    await tester.tap(find.byKey(const Key('chat.delete')));
    await settle(tester);
    await tester.tapKey('chat.delete.confirm');
    expect(backend.calls, contains('DELETE /chat/conversations/c-1'));
    expect(find.byKey(const Key('chat.message.0')), findsNothing);
    expect(find.byKey(const Key('chat.suggestion.0')), findsOneWidget);
  });

  testWidgets('clinicians open "Ask the assistant" with reference questions', (
    tester,
  ) async {
    await openChat(tester, roles: ['CLINICIAN']);
    expect(find.text('Ask the assistant'), findsWidgets);
    expect(find.text('What does PI-RADS 4 mean?'), findsOneWidget);
    expect(
      find.textContaining('do not replace clinical judgement'),
      findsOneWidget,
    );
  });

  testWidgets('answers written by Claude say so, and still show the sources', (
    tester,
  ) async {
    await openChat(tester);
    backend.on(
      'POST /chat/conversations/c-1/messages',
      FakeResponse(
        200,
        _answer(
          model: 'claude-haiku-4-5-20251001',
          text: 'PSA is a protein your prostate makes.',
        ),
      ),
    );
    await tester.tapKey('chat.suggestion.0');
    expect(
      find.text('Written by AI (Claude) from the sources below'),
      findsOneWidget,
    );
    expect(find.text('PSA is a protein your prostate makes.'), findsOneWidget);
    expect(find.textContaining('NHS: PSA testing'), findsOneWidget);
  });

  testWidgets('quoted answers carry no AI label', (tester) async {
    await openChat(tester);
    await tester.tapKey('chat.suggestion.0');
    expect(find.textContaining('Written by AI'), findsNothing);
    expect(find.textContaining('Do not type your name'), findsOneWidget);
  });
}
