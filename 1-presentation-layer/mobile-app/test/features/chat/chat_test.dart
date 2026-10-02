import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:pca_mhealth/features/chat/application/voice_input.dart';
import 'package:pca_mhealth/features/chat/presentation/chat_composer.dart';
import 'package:pca_mhealth/shared/widgets/assistant_avatar.dart';

import '../../support/app_harness.dart';
import '../../support/audio_fakes.dart';
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
  late FakeSpeech speech;
  late FakeReadAloud reader;

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
    VoiceAvailability voice = VoiceAvailability.ready,
  }) async {
    backend = backendFor(roles);
    store = InMemoryTokenStore();
    speech = FakeSpeech(availability: voice);
    reader = FakeReadAloud();
    await pumpApp(
      tester,
      backend: backend,
      store: store,
      connectivity: connectivity,
      speech: speech,
      reader: reader,
    );
    await tester.enter('login.email', 'someone@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
    if (roles.contains('PATIENT')) {
      await tester.tapKey('home.chat');
    } else {
      // The floating bot button on the clinician's home.
      await tester.tapKey('assistant.fab');
    }
  }

  testWidgets('a patient asks a question and gets a quoted answer with its '
      'source, status and disclaimer', (tester) async {
    await openChat(tester);
    expect(find.text(AssistantAvatar.name), findsOneWidget);
    expect(find.byKey(const Key('chat.welcome')), findsOneWidget);
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

  testWidgets('the header subtitle is short and read out in full', (
    tester,
  ) async {
    await openChat(tester);
    expect(find.text('Reviewed answers'), findsOneWidget);
    expect(
      find.bySemanticsLabel('Answers come from reviewed health information'),
      findsOneWidget,
    );
  });

  testWidgets('clinicians open "Ask the assistant" with reference questions', (
    tester,
  ) async {
    await openChat(tester, roles: ['CLINICIAN']);
    expect(find.text('Reviewed cards'), findsOneWidget);
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

  group('voice messages (ADR-012)', () {
    testWidgets('speak, see the words appear, finish, then send', (
      tester,
    ) async {
      await openChat(tester);
      await tester.tapKey('chat.mic');
      expect(speech.listening, isTrue);
      expect(find.byKey(const Key('chat.voice.recording')), findsOneWidget);
      expect(find.text('Listening… speak now'), findsOneWidget);

      speech.hear('What does a PSA');
      await tester.pump();
      expect(find.text('What does a PSA'), findsOneWidget);
      speech.hear('What does a PSA test measure');
      await tester.pump();

      // Nothing is sent while listening.
      final send = tester.widget<IconButton>(
        find.byKey(const Key('chat.send')),
      );
      expect(send.onPressed, isNull);

      await tester.tapKey('chat.voice.done');
      expect(find.byKey(const Key('chat.voice.recording')), findsNothing);
      await tester.tapKey('chat.send');
      expect(backend.last('POST /chat/conversations/c-1/messages').body, {
        'text': 'What does a PSA test measure',
      });
    });

    testWidgets('listening stops by itself after a pause', (tester) async {
      await openChat(tester);
      await tester.tapKey('chat.mic');
      speech.hear('Does it hurt');
      speech.finish();
      await settle(tester);
      expect(find.byKey(const Key('chat.voice.recording')), findsNothing);
      expect(find.text('Does it hurt'), findsOneWidget);
    });

    testWidgets('cancel throws the words away and keeps what was typed', (
      tester,
    ) async {
      await openChat(tester);
      await tester.enter('chat.input', 'About the DRE:');
      await tester.tapKey('chat.mic');
      speech.hear('does it hurt');
      await tester.pump();
      expect(find.text('About the DRE: does it hurt'), findsOneWidget);
      await tester.tapKey('chat.voice.cancel');
      expect(speech.cancelled, isTrue);
      expect(find.text('About the DRE:'), findsOneWidget);
      expect(backend.calls, isNot(contains('POST /chat/conversations')));
    });

    testWidgets('says when nothing was heard', (tester) async {
      await openChat(tester);
      await tester.tapKey('chat.mic');
      speech.finish();
      await settle(tester);
      expect(find.text(ChatComposer.heardNothing), findsOneWidget);
    });

    testWidgets('explains how to allow the microphone', (tester) async {
      await openChat(tester, voice: VoiceAvailability.noPermission);
      await tester.tapKey('chat.mic');
      expect(find.text(ChatComposer.noPermission), findsOneWidget);
      expect(speech.listening, isFalse);
      // The microphone stays, so it can be tried again after allowing it.
      expect(find.byKey(const Key('chat.mic')), findsOneWidget);
    });

    testWidgets(
      'hides the microphone when the phone cannot turn speech into text',
      (tester) async {
        await openChat(tester, voice: VoiceAvailability.unavailable);
        await tester.tapKey('chat.mic');
        expect(find.text(ChatComposer.unavailable), findsOneWidget);
        expect(find.byKey(const Key('chat.mic')), findsNothing);
      },
    );

    testWidgets('the microphone waits while offline', (tester) async {
      await openChat(tester, connectivity: FakeConnectivity(online: false));
      final mic = tester.widget<IconButton>(find.byKey(const Key('chat.mic')));
      expect(mic.onPressed, isNull);
    });

    testWidgets('the intro says what happens to the voice', (tester) async {
      await openChat(tester);
      expect(
        find.textContaining('the app only receives the text'),
        findsOneWidget,
      );
    });
  });

  group('the assistant is easy to find and to hear', () {
    testWidgets('the bot button on the patient home opens the chat', (
      tester,
    ) async {
      backend = backendFor(['PATIENT']);
      await pumpApp(tester, backend: backend, store: InMemoryTokenStore());
      await tester.enter('login.email', 'someone@demo.pca-mhealth.test');
      await tester.enter('login.password', 'a-password-1234');
      await tester.tapKey('login.submit');
      expect(find.byType(AssistantAvatar), findsWidgets);
      await tester.tapKey('assistant.fab');
      expect(find.text(AssistantAvatar.name), findsOneWidget);
      expect(find.bySemanticsLabel(AssistantAvatar.name), findsOneWidget);
    });

    testWidgets('an answer can be read aloud, and stopped', (tester) async {
      await openChat(tester);
      await tester.tapKey('chat.suggestion.0');
      await tester.tapKey('chat.listen.a-1');
      expect(reader.spoken, [
        'PSA (prostate-specific antigen) is a protein made by the prostate.',
      ]);
      expect(find.text('Stop reading'), findsOneWidget);
      reader.finishPart();
      await settle(tester);
      // The disclaimer is read too; the sources are not.
      expect(reader.spoken.last, startsWith('This is general information'));
      await tester.tapKey('chat.listen.a-1');
      expect(find.text('Listen'), findsOneWidget);
      expect(reader.speaking, isFalse);
    });

    testWidgets('a safety label is read before the fixed text', (tester) async {
      await openChat(tester);
      backend.on(
        'POST /chat/conversations/c-1/messages',
        FakeResponse(
          200,
          _answer(safety: 'URGENT_CARE', text: 'Go now.', sources: []),
        ),
      );
      await tester.enter('chat.input', 'question');
      await tester.tapKey('chat.send');
      await tester.tapKey('chat.listen.a-1');
      expect(reader.spoken, ['Urgent']);
      reader.finishPart();
      await settle(tester);
      expect(reader.spoken, ['Urgent', 'Go now.']);
    });
  });
}
