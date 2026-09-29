import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/features/settings/appearance.dart';

import '../support/app_harness.dart';
import '../support/fakes.dart';

/// NFR-11 (WCAG 2.1 AA): Flutter's accessibility guidelines on the main
/// screens, in light and dark mode, and a check that the screens still lay
/// out with very large text (200%, the WCAG "resize text" criterion).
class _Dark extends ThemeModeController {
  @override
  ThemeMode build() => ThemeMode.dark;
}

class _Light extends ThemeModeController {
  @override
  ThemeMode build() => ThemeMode.light;
}

Map<String, dynamic> _patientView() => {
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

FakeBackend _backend(List<String> roles) => FakeBackend()
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
  );

/// Screens to check: the role to sign in as (none: stay signed out) and how
/// to get there after signing in.
final Map<String, (List<String>?, Future<void> Function(WidgetTester)?)>
_screens = {
  'sign-in': (null, null),
  'clinician home': (['CLINICIAN'], null),
  'pathologist home': (['PATHOLOGIST'], null),
  'patient home': (['PATIENT'], null),
  'patients list': (
    ['CLINICIAN'],
    (t) async {
      await t.tap(find.text('Patients').last);
      await settle(t);
    },
  ),
  'settings': (
    ['CLINICIAN'],
    (t) async {
      await t.tap(find.byTooltip('Open navigation menu'));
      await settle(t);
      await t.tap(find.byKey(const Key('home.settings')));
      await settle(t);
    },
  ),
};

Future<void> _open(
  WidgetTester tester,
  String name, {
  required bool dark,
  double textScale = 1,
}) async {
  final (roles, then) = _screens[name]!;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  final List<Override> theme = [
    themeModeProvider.overrideWith(dark ? _Dark.new : _Light.new),
  ];
  await pumpApp(
    tester,
    backend: _backend(roles ?? ['CLINICIAN']),
    store: InMemoryTokenStore(),
    overrides: theme,
  );
  if (roles != null) {
    await tester.enter('login.email', 'someone@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
  }
  if (then != null) await then(tester);
}

void main() {
  for (final dark in [false, true]) {
    final mode = dark ? 'dark' : 'light';
    for (final name in _screens.keys) {
      testWidgets('$name ($mode): tap targets, labels and text contrast', (
        tester,
      ) async {
        final handle = tester.ensureSemantics();
        await _open(tester, name, dark: dark);
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        handle.dispose();
      });
    }
  }

  for (final name in _screens.keys) {
    testWidgets('$name lays out with 200% text', (tester) async {
      await _open(tester, name, dark: false, textScale: 2);
      // A layout overflow is reported as an exception.
      expect(tester.takeException(), isNull);
    });
  }
}
