import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/shared/audio/read_aloud.dart';

import '../../support/app_harness.dart';
import '../../support/audio_fakes.dart';
import '../../support/fakes.dart';

/// ADR-012: articles can be listened to, for people who cannot read.
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
  );

void main() {
  late FakeReadAloud reader;

  Future<void> openLearn(WidgetTester tester) async {
    reader = FakeReadAloud();
    await pumpApp(
      tester,
      backend: _backend(),
      store: InMemoryTokenStore(),
      reader: reader,
    );
    await tester.enter('login.email', 'patient@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('Learn'),
      ),
    );
    // The library is read from the app's assets (real I/O): wait for it.
    final listen = find.byKey(const Key('learn.listen.psa-test'));
    for (var i = 0; i < 40 && listen.evaluate().isEmpty; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 50)),
      );
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(listen, findsOneWidget);
  }

  testWidgets('Listen on a card opens the article and reads it part by part, '
      'in order', (tester) async {
    final semantics = tester.ensureSemantics();
    await openLearn(tester);
    expect(
      find.text('Tap Listen to hear any article read aloud.'),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('Listen to What is a PSA test?'), findsOne);
    await tester.tapKey('learn.listen.psa-test');

    expect(reader.spoken, hasLength(1));
    expect(
      reader.spoken.single,
      startsWith('What is a PSA test? A blood test'),
    );
    expect(find.text('Part 1 of 5'), findsOneWidget);
    expect(find.text('Pause'), findsOneWidget);

    reader.finishPart();
    await settle(tester);
    expect(reader.spoken.last, startsWith('What PSA is. '));
    expect(find.text('Part 2 of 5'), findsOneWidget);

    for (var i = 0; i < 3; i++) {
      reader.finishPart();
      await settle(tester);
    }
    // The closing advice is read last; the sources are not read.
    expect(reader.spoken.last, startsWith('This is general information'));
    expect(reader.spoken.any((t) => t.contains('https://')), isFalse);
    reader.finishPart();
    await settle(tester);
    expect(find.text('Listen to this article'), findsOneWidget);
    expect(find.byKey(const Key('article.progress')), findsNothing);
    semantics.dispose();
  });

  testWidgets('pause keeps the place; resume reads that part again', (
    tester,
  ) async {
    await openLearn(tester);
    await tester.tapKey('learn.listen.psa-test');
    reader.finishPart();
    await settle(tester);

    await tester.tapKey('article.listen');
    expect(reader.speaking, isFalse);
    expect(find.text('Resume'), findsOneWidget);
    expect(find.text('Part 2 of 5'), findsOneWidget);

    final before = reader.spoken.length;
    await tester.tapKey('article.listen');
    expect(reader.spoken, hasLength(before + 1));
    expect(reader.spoken.last, startsWith('What PSA is. '));
  });

  testWidgets('a slower voice, and stop', (tester) async {
    await openLearn(tester);
    await tester.tapKey('learn.listen.psa-test');
    expect(reader.rates.last, normalReadingRate);
    await tester.tapKey('article.slow');
    expect(reader.rates.last, slowReadingRate);

    await tester.tapKey('article.stop');
    expect(reader.speaking, isFalse);
    expect(find.text('Listen to this article'), findsOneWidget);
    expect(find.byKey(const Key('article.stop')), findsNothing);

    // The slower voice is kept for the next article.
    await tester.tapKey('article.listen');
    expect(reader.rates.last, slowReadingRate);
  });

  testWidgets('leaving the article stops the voice', (tester) async {
    await openLearn(tester);
    await tester.tapKey('learn.listen.psa-test');
    expect(reader.speaking, isTrue);
    await tester.pageBack();
    await settle(tester);
    expect(reader.speaking, isFalse);
    final container = ProviderScope.containerOf(
      tester.element(find.byType(NavigationBar)),
    );
    expect(container.read(readAloudControllerProvider).id, isNull);
  });

  testWidgets('changing tab stops the voice', (tester) async {
    await openLearn(tester);
    await tester.tapKey('learn.listen.psa-test');
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('Home'),
      ),
    );
    await settle(tester);
    expect(reader.speaking, isFalse);
  });

  testWidgets('articles can also be opened and listened to from the top', (
    tester,
  ) async {
    await openLearn(tester);
    await tester.tap(find.text('What is a PSA test?'));
    await settle(tester);
    expect(reader.spoken, isEmpty);
    await tester.tapKey('article.listen');
    expect(reader.spoken, hasLength(1));
  });
}
