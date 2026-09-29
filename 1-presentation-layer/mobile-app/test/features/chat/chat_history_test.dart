import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/features/chat/presentation/chat_screen.dart';

import '../../support/app_harness.dart';
import '../../support/fakes.dart';

/// Owner request 2026-09-29: start new chats and go back to earlier ones.

Map<String, dynamic> _answer(String id, String question, String text) => {
  'question': {
    'id': 'q-$id',
    'role': 'user',
    'text': question,
    'at': '2026-09-29T08:00:00.000Z',
  },
  'answer': {
    'id': 'a-$id',
    'role': 'assistant',
    'text': text,
    'at': '2026-09-29T08:00:01.000Z',
    'sources': [
      {'name': 'NHS: PSA testing', 'url': ''},
    ],
    'safety': 'OK',
    'mode': 'EXTRACTIVE',
    'disclaimer': 'This is general information, not medical advice.',
  },
};

const _earlier = {
  'id': 'c-9',
  'language': 'en',
  'audience': 'patient',
  'createdAt': '2026-09-28T08:00:00.000Z',
  'updatedAt': '2026-09-28T08:00:01.000Z',
  'messageCount': 2,
  'preview': 'What happens during a DRE?',
};

Map<String, dynamic> _earlierChat() => {
  ..._earlier,
  'messages': [
    {
      'id': 'q-9',
      'role': 'user',
      'text': 'What happens during a DRE?',
      'at': '2026-09-28T08:00:00.000Z',
    },
    {
      'id': 'a-9',
      'role': 'assistant',
      'text': 'The clinician gently feels the prostate.',
      'at': '2026-09-28T08:00:01.000Z',
      'sources': [
        {'name': 'NHS: DRE', 'url': ''},
      ],
      'safety': 'OK',
      'mode': 'EXTRACTIVE',
    },
  ],
};

FakeResponse _page(List<Map<String, dynamic>> items) => FakeResponse(200, {
  'items': items,
  'page': 1,
  'pageSize': 50,
  'total': items.length,
});

FakeBackend _backend() => FakeBackend()
  ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
  ..on('GET /users/me', FakeResponse(200, userJson(roles: ['PATIENT'])))
  ..on('GET /patients/me', const FakeResponse(200, null))
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
  ..on(
    'POST /chat/conversations/c-1/messages',
    FakeResponse(
      200,
      _answer('1', 'What does a PSA test measure?', 'PSA is a protein.'),
    ),
  );

void main() {
  late FakeBackend backend;

  Future<void> openChat(WidgetTester tester) async {
    await pumpApp(tester, backend: backend, store: InMemoryTokenStore());
    await tester.enter('login.email', 'patient@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
    await tester.tapKey('home.chat');
  }

  setUp(() => backend = _backend());

  testWidgets('an earlier chat can be opened from Past chats and continued', (
    tester,
  ) async {
    backend
      ..on('GET /chat/conversations', _page([_earlier]))
      ..on('GET /chat/conversations/c-9', FakeResponse(200, _earlierChat()))
      ..on(
        'POST /chat/conversations/c-9/messages',
        FakeResponse(
          200,
          _answer('2', 'Does it hurt?', 'It may feel uncomfortable.'),
        ),
      );
    await openChat(tester);
    await tester.tapKey('chat.history');
    expect(find.text('Your chats'), findsOneWidget);
    expect(find.text('What happens during a DRE?'), findsWidgets);
    await tester.tap(find.byKey(const Key('chat.past.c-9')));
    await settle(tester);

    expect(
      find.text('The clinician gently feels the prostate.'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('chat.welcome')), findsNothing);

    await tester.enter('chat.input', 'Does it hurt?');
    await tester.tapKey('chat.send');
    // The question goes into the opened chat; no new chat is started.
    expect(backend.calls, contains('POST /chat/conversations/c-9/messages'));
    expect(backend.calls, isNot(contains('POST /chat/conversations')));
    expect(find.text('It may feel uncomfortable.'), findsOneWidget);
  });

  testWidgets('the empty chat offers to continue a recent chat', (
    tester,
  ) async {
    backend
      ..on('GET /chat/conversations', _page([_earlier]))
      ..on('GET /chat/conversations/c-9', FakeResponse(200, _earlierChat()));
    await openChat(tester);
    expect(find.text('Continue a chat'), findsOneWidget);
    await tester.tapKey('chat.recent.c-9');
    expect(
      find.text('The clinician gently feels the prostate.'),
      findsOneWidget,
    );
  });

  testWidgets(
    'New chat starts an empty chat; the next question starts a new conversation',
    (tester) async {
      await openChat(tester);
      final newChat = tester.widget<IconButton>(
        find.byKey(const Key('chat.newChat')),
      );
      expect(newChat.onPressed, isNull, reason: 'nothing to leave yet');

      await tester.tapKey('chat.suggestion.0');
      expect(find.byKey(const Key('chat.message.1')), findsOneWidget);
      await tester.tapKey('chat.newChat');
      expect(find.byKey(const Key('chat.message.0')), findsNothing);
      expect(find.byKey(const Key('chat.welcome')), findsOneWidget);
      // Nothing was deleted: the chat stays in Past chats.
      expect(backend.calls, isNot(contains('DELETE /chat/conversations/c-1')));

      await tester.tapKey('chat.suggestion.1');
      expect(
        backend.calls.where((c) => c == 'POST /chat/conversations'),
        hasLength(2),
      );
    },
  );

  testWidgets(
    'Past chats can also start a new chat, and says when there are none',
    (tester) async {
      backend.on('GET /chat/conversations', _page([]));
      await openChat(tester);
      await tester.tapKey('chat.suggestion.0');
      await tester.tapKey('chat.history');
      expect(find.textContaining('No earlier chats yet'), findsOneWidget);
      await tester.tapKey('chat.history.new');
      expect(find.byKey(const Key('chat.welcome')), findsOneWidget);
      expect(find.byKey(const Key('chat.message.0')), findsNothing);
    },
  );

  testWidgets('says when past chats cannot be loaded', (tester) async {
    // No route scripted for GET /chat/conversations: the server says 404.
    await openChat(tester);
    await tester.tapKey('chat.history');
    expect(find.byKey(const Key('chat.history.error')), findsOneWidget);
    expect(find.text('Continue a chat'), findsNothing);
  });

  test('short dates for the list', () {
    final now = DateTime(2026, 9, 29, 20);
    expect(chatWhen(DateTime(2026, 9, 29, 8, 5), now: now), '08:05');
    expect(chatWhen(DateTime(2026, 9, 28, 23), now: now), 'Yesterday');
    expect(chatWhen(DateTime(2026, 9, 1), now: now), '1 Sep');
  });
}
