// The phone screens in the operations manual, drawn by the app's own code
// with its real fonts and synthetic data. Not part of the test suite.
//
// docs/report/tools/report.py (step "app") runs it, after writing
// tool/report/out/chat.json: the AI service's real answer to the question,
// and the backend's real small-talk replies and disclaimer. So the chat
// screens show what the system says, not text made up for the picture.
//   flutter test --update-goldens tool/report/app_screens_test.dart
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/features/settings/appearance.dart';

import '../../test/support/app_harness.dart';
import '../../test/support/audio_fakes.dart';
import '../../test/support/fakes.dart';

class _Dark extends ThemeModeController {
  @override
  ThemeMode build() => ThemeMode.dark;
}

class _Light extends ThemeModeController {
  @override
  ThemeMode build() => ThemeMode.light;
}

/// The fonts the app ships with, and the icon font from its package.
Future<void> _loadFonts() async {
  final config = File('.dart_tool/package_config.json');
  final packages = (jsonDecode(config.readAsStringSync())['packages'] as List)
      .cast<Map<String, dynamic>>();
  final root =
      packages.firstWhere(
            (p) => p['name'] == 'material_symbols_icons',
          )['rootUri']
          as String;
  final symbols = config.absolute.uri
      .resolve(root.endsWith('/') ? root : '$root/')
      .resolve('lib/fonts/MaterialSymbolsRounded.ttf')
      .toFilePath();
  for (final (family, path) in [
    ('PlusJakartaSans', 'assets/fonts/PlusJakartaSans-Variable.ttf'),
    ('Inter', 'assets/fonts/Inter-Variable.ttf'),
    ('JetBrainsMono', 'assets/fonts/JetBrainsMono-Variable.ttf'),
    ('packages/material_symbols_icons/MaterialSymbolsRounded', symbols),
  ]) {
    final bytes = File(path).readAsBytesSync();
    await (FontLoader(
      family,
    )..addFont(Future.value(ByteData.sublistView(bytes)))).load();
  }
}

Map<String, dynamic> _readChat() {
  final file = File('tool/report/out/chat.json');
  if (!file.existsSync()) {
    throw StateError(
      'tool/report/out/chat.json is missing. Run: '
      r'docs\report\tools\report.ps1 app',
    );
  }
  return jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
}

late final Map<String, dynamic> _chat;

/// Answers as the server does: the knowledge base's answer to the question,
/// and the small-talk replies, each with the disclaimer.
FakeBackend _backend(List<String> roles) {
  final backend = FakeBackend()
    ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
    ..on('GET /users/me', FakeResponse(200, userJson(roles: roles)))
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
      'GET /chat/conversations',
      FakeResponse(200, {
        'items': [
          for (final (i, q) in [
            'What does a PSA test measure?',
            'What happens during a DRE?',
            'Hello! How are you?',
            'When should I get help quickly?',
          ].indexed)
            {
              'id': 'c-${i + 2}',
              'language': 'en',
              'audience': 'patient',
              'createdAt': '2026-09-2${8 - (i ~/ 2)}T08:00:00.000Z',
              'updatedAt': '2026-09-2${9 - i}T0${2 + i}:15:00.000Z',
              'messageCount': 2 + 2 * i,
              'preview': q,
            },
        ],
        'page': 1,
        'pageSize': 50,
        'total': 4,
      }),
    );
  final answer = _chat['answer'] as Map<String, dynamic>;
  final casual = {
    for (final turn in (_chat['casual'] as List).cast<Map<String, dynamic>>())
      turn['question'] as String: turn['reply'] as String,
  };
  var n = 0;
  backend.routes['POST /chat/conversations/c-1/messages'] = (request) async {
    final text = (request.body as Map<String, dynamic>)['text'] as String;
    n++;
    final reply = text == _chat['question']
        ? {
            'text': answer['text'],
            'sources': answer['sources'],
            'mode': answer['mode'],
            'reviewStatus': answer['reviewStatus'],
          }
        : {'text': casual[text], 'sources': [], 'mode': 'FIXED'};
    return FakeResponse(200, {
      'question': {
        'id': 'q-$n',
        'role': 'user',
        'text': text,
        'at': '2026-09-29T20:0$n:00.000Z',
      },
      'answer': {
        'id': 'a-$n',
        'role': 'assistant',
        'at': '2026-09-29T20:0$n:01.000Z',
        'safety': 'OK',
        'disclaimer': _chat['disclaimer'],
        ...reply,
      },
    });
  };
  return backend;
}

Future<void> _ask(WidgetTester t, String text) async {
  await t.enter('chat.input', text);
  await t.tapKey('chat.send');
}

Future<void> _learn(WidgetTester t) async {
  await t.tap(
    find.descendant(
      of: find.byType(NavigationBar),
      matching: find.text('Learn'),
    ),
  );
  final listen = find.byKey(const Key('learn.listen.psa-test'));
  for (var i = 0; i < 40 && listen.evaluate().isEmpty; i++) {
    await t.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 50)),
    );
    await t.pump(const Duration(milliseconds: 50));
  }
}

typedef _Then = Future<void> Function(WidgetTester tester, FakeSpeech speech);

/// Name (as in docs/report/img), who is signed in, dark mode, what to do.
final _screens = <String, (List<String>?, bool, _Then?)>{
  'app-signin': (null, false, null),
  'app-chat-empty': (['PATIENT'], false, (t, _) => t.tapKey('assistant.fab')),
  'app-chat-answer': (
    ['PATIENT'],
    false,
    (t, _) async {
      await t.tapKey('assistant.fab');
      await _ask(t, _chat['question'] as String);
    },
  ),
  'app-chat-casual': (
    ['PATIENT'],
    false,
    (t, _) async {
      await t.tapKey('assistant.fab');
      for (final turn in _chat['casual'] as List) {
        await _ask(t, turn['question'] as String);
      }
    },
  ),
  'app-chat-history': (
    ['PATIENT'],
    false,
    (t, _) async {
      await t.tapKey('assistant.fab');
      await t.tapKey('chat.history');
    },
  ),
  // The phone's speech service is a stand-in here: it "hears" these words.
  'app-chat-recording': (
    ['PATIENT'],
    true,
    (t, speech) async {
      await t.tapKey('assistant.fab');
      await t.tapKey('chat.mic');
      speech.hear('Does a DRE hurt', level: 0.8);
      await t.pump(const Duration(milliseconds: 200));
    },
  ),
  'app-learn': (['PATIENT'], true, (t, _) => _learn(t)),
  'app-clinician': (['CLINICIAN'], true, null),
};

void main() {
  _chat = _readChat();
  setUpAll(_loadFonts);
  for (final MapEntry(key: name, value: (roles, dark, then))
      in _screens.entries) {
    testWidgets(name, (tester) async {
      tester.view.padding = const FakeViewPadding(top: 24 * 2.625);
      addTearDown(tester.view.resetPadding);
      final speech = FakeSpeech();
      await pumpApp(
        tester,
        backend: _backend(roles ?? ['PATIENT']),
        store: InMemoryTokenStore(),
        speech: speech,
        reader: FakeReadAloud(),
        overrides: [
          themeModeProvider.overrideWith(dark ? _Dark.new : _Light.new),
        ],
      );
      if (roles != null) {
        await tester.enter('login.email', 'someone@demo.pca-mhealth.test');
        await tester.enter('login.password', 'a-password-1234');
        await tester.tapKey('login.submit');
      }
      if (then != null) await then(tester, speech);
      await tester.pump(const Duration(milliseconds: 400));
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('out/$name.png'),
      );
    });
  }
}
