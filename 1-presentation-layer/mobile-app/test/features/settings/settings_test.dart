import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/app/theme/tokens.dart';
import 'package:pca_mhealth/features/settings/appearance.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/app_harness.dart';
import '../../support/fakes.dart';

/// Appearance setting: light, dark, or as the phone; kept on the phone.
void main() {
  late FakeBackend backend;
  late InMemoryTokenStore store;

  setUp(() {
    store = InMemoryTokenStore();
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
  });

  Color canvas(WidgetTester tester) =>
      tester.widget<Scaffold>(find.byType(Scaffold).last).backgroundColor ??
      Theme.of(
        tester.element(find.byType(Scaffold).last),
      ).scaffoldBackgroundColor;

  testWidgets('a clinician switches to dark mode from the menu, and it '
      'stays after signing out', (tester) async {
    await pumpApp(tester, backend: backend, store: store);
    await tester.enter('login.email', 'clinician@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
    // The test phone is set to light, so "Same as the phone" is light.
    expect(canvas(tester), AppPalette.light.canvas);

    await tester.tap(find.byTooltip('Open navigation menu'));
    await settle(tester);
    await tester.tapKey('home.settings');
    expect(find.text('Appearance'), findsOneWidget);
    final systemTile = tester.widget<ListTile>(
      find.byKey(const Key('settings.theme.system')),
    );
    expect(systemTile.selected, isTrue);

    await tester.tapKey('settings.theme.dark');
    expect(canvas(tester), AppPalette.dark.canvas);
    expect(
      tester
          .widget<ListTile>(find.byKey(const Key('settings.theme.dark')))
          .selected,
      isTrue,
    );

    // Back home and signed out: still dark (a phone setting, not an account's).
    await tester.pageBack();
    await settle(tester);
    await tester.tap(find.byTooltip('Open navigation menu'));
    await settle(tester);
    await tester.tapKey('home.signOut');
    expect(find.byKey(const Key('login.email')), findsOneWidget);
    expect(canvas(tester), AppPalette.dark.canvas);

    await tester.tapKey('login.email');
    await tester.enter('login.email', 'clinician@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
    await tester.tap(find.byTooltip('Open navigation menu'));
    await settle(tester);
    await tester.tapKey('home.settings');
    await tester.tapKey('settings.theme.light');
    expect(canvas(tester), AppPalette.light.canvas);
  });

  testWidgets('"Same as the phone" follows the phone switching to dark', (
    tester,
  ) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    await pumpApp(tester, backend: backend, store: store);
    expect(canvas(tester), AppPalette.dark.canvas);
  });

  test('the choice is saved on the phone and read back at start', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final first = ProviderContainer(
      overrides: [preferencesProvider.overrideWithValue(prefs)],
    );
    addTearDown(first.dispose);
    expect(first.read(themeModeProvider), ThemeMode.system);
    await first.read(themeModeProvider.notifier).choose(ThemeMode.dark);
    expect(prefs.getString('appearance.themeMode'), 'dark');

    // A new start of the app reads it back.
    final second = ProviderContainer(
      overrides: [preferencesProvider.overrideWithValue(prefs)],
    );
    addTearDown(second.dispose);
    expect(second.read(themeModeProvider), ThemeMode.dark);
  });

  test('an unknown saved value falls back to "Same as the phone"', () async {
    SharedPreferences.setMockInitialValues({'appearance.themeMode': 'purple'});
    final prefs = await SharedPreferences.getInstance();
    final c = ProviderContainer(
      overrides: [preferencesProvider.overrideWithValue(prefs)],
    );
    addTearDown(c.dispose);
    expect(c.read(themeModeProvider), ThemeMode.system);
  });
}
