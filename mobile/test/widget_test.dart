import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/features/auth/presentation/forgot_password_screen.dart';
import 'package:pca_mhealth/shared/widgets/offline_banner.dart';

import 'support/app_harness.dart';
import 'support/fakes.dart';

/// End-to-end flows through the real router, theme and session controller,
/// against a scripted backend.
void main() {
  late FakeBackend backend;
  late InMemoryTokenStore store;

  setUp(() {
    backend = FakeBackend()
      ..on('POST /auth/logout', const FakeResponse(204))
      ..on('POST /auth/change-password', const FakeResponse(204))
      ..on('POST /auth/forgot-password', const FakeResponse(202, {}));
    store = InMemoryTokenStore();
  });

  Future<void> signIn(WidgetTester tester) async {
    await tester.enter('login.email', 'clinician@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
  }

  testWidgets('starts on sign-in with the research-prototype notice', (
    tester,
  ) async {
    await pumpApp(tester, backend: backend, store: store);
    expect(find.text('Sign in'), findsWidgets);
    expect(find.textContaining('Not a medical device'), findsOneWidget);
  });

  testWidgets('validates the form before calling the server', (tester) async {
    await pumpApp(tester, backend: backend, store: store);
    await tester.tapKey('login.submit');
    expect(find.text('Enter your email address.'), findsOneWidget);
    expect(find.text('Enter your password.'), findsOneWidget);

    await tester.enter('login.email', 'not-an-email');
    await tester.tapKey('login.submit');
    expect(find.text('Enter a valid email address.'), findsOneWidget);
    expect(backend.calls, isEmpty);
  });

  final cases = {
    'INVALID_CREDENTIALS': (401, 'Email or password is incorrect.'),
    'ACCOUNT_LOCKED': (423, 'temporarily locked'),
    'RATE_LIMITED': (429, 'Too many attempts'),
  };
  for (final MapEntry(key: code, value: (status, text)) in cases.entries) {
    testWidgets('shows a clear message for $code', (tester) async {
      backend.on('POST /auth/login', FakeResponse.error(status, code));
      await pumpApp(tester, backend: backend, store: store);
      await signIn(tester);
      expect(find.textContaining(text), findsOneWidget);
      expect(store.tokens, isNull);
    });
  }

  testWidgets('explains when the server cannot be reached', (tester) async {
    await pumpApp(tester, backend: backend, store: store);
    backend.isOffline = true;
    await signIn(tester);
    expect(find.textContaining('Cannot reach the server'), findsOneWidget);
  });

  testWidgets('clinician signs in, sees their home and signs out', (
    tester,
  ) async {
    backend
      ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
      ..on('GET /users/me', FakeResponse(200, userJson()));
    await pumpApp(tester, backend: backend, store: store);
    await signIn(tester);

    expect(find.text('Clinician'), findsOneWidget);
    expect(find.text('Welcome, Demo Clinician'), findsOneWidget);
    expect(find.text('Patients'), findsOneWidget);
    expect(find.textContaining('Coming in build phase'), findsWidgets);

    await tester.tap(find.byTooltip('Open navigation menu'));
    await settle(tester);
    await tester.tapKey('home.signOut');

    expect(find.byKey(const Key('login.email')), findsOneWidget);
    expect(store.tokens, isNull);
    expect(backend.calls, contains('POST /auth/logout'));
  });

  testWidgets('each role opens its own home', (tester) async {
    backend
      ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
      ..on('GET /users/me', FakeResponse(200, userJson(roles: ['PATIENT'])));
    await pumpApp(tester, backend: backend, store: store);
    await signIn(tester);
    // Patients get the tabbed patient app (not linked to a record here).
    expect(find.text('Almost ready'), findsOneWidget);
    expect(find.text('Results'), findsOneWidget);
    expect(find.text('Patients'), findsNothing);
  });

  testWidgets('a saved session opens straight to the home screen', (
    tester,
  ) async {
    store.tokens = savedTokens;
    backend.on('GET /users/me', FakeResponse(200, userJson(roles: ['ADMIN'])));
    await pumpApp(tester, backend: backend, store: store);
    expect(find.text('Administrator'), findsOneWidget);
    expect(find.text('Audit log'), findsOneWidget);
  });

  group('forced password change', () {
    setUp(() {
      backend
        ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
        ..on(
          'GET /users/me',
          FakeResponse(200, userJson(mustChangePassword: true)),
        );
    });

    Future<void> open(WidgetTester tester) async {
      await pumpApp(tester, backend: backend, store: store);
      await signIn(tester);
      expect(find.text('Choose a new password'), findsOneWidget);
    }

    Future<void> fill(
      WidgetTester tester, {
      String current = 'a-password-1234',
      required String next,
      String? confirm,
    }) async {
      await tester.enter('change.current', current);
      await tester.enter('change.new', next);
      await tester.enter('change.confirm', confirm ?? next);
      await tester.tapKey('change.submit');
    }

    testWidgets('checks length, reuse and confirmation locally', (
      tester,
    ) async {
      await open(tester);
      await fill(tester, next: 'short');
      expect(find.text('Use at least 12 characters.'), findsOneWidget);

      await fill(tester, next: 'a-password-1234');
      expect(
        find.text('Choose a password different from your current one.'),
        findsOneWidget,
      );

      await fill(tester, next: 'river-stone-lamp', confirm: 'river-stone-lam');
      expect(find.text('The passwords do not match.'), findsOneWidget);
      expect(backend.calls, isNot(contains('POST /auth/change-password')));
    });

    testWidgets('shows the server policy messages on the field', (
      tester,
    ) async {
      backend.routes['POST /auth/change-password'] = (_) async =>
          const FakeResponse(400, {
            'error': {
              'status': 400,
              'code': 'VALIDATION_FAILED',
              'message': 'Request validation failed',
              'details': [
                {
                  'field': 'password',
                  'errors': ['password is too common'],
                },
              ],
            },
          });
      await open(tester);
      await fill(tester, next: 'password123456');
      expect(find.text('password is too common'), findsOneWidget);
      expect(find.text('Please check the highlighted fields.'), findsOneWidget);
    });

    testWidgets('wrong current password is reported', (tester) async {
      backend.on(
        'POST /auth/change-password',
        FakeResponse.error(400, 'INVALID_CURRENT_PASSWORD'),
      );
      await open(tester);
      await fill(tester, next: 'river-stone-lamp');
      expect(find.text('Your current password is incorrect.'), findsOneWidget);
    });

    testWidgets('success continues to the home screen', (tester) async {
      await open(tester);
      await fill(tester, next: 'river-stone-lamp');
      expect(find.text('Welcome, Demo Clinician'), findsOneWidget);
    });
  });

  testWidgets('forgot password never reveals whether the account exists', (
    tester,
  ) async {
    await pumpApp(tester, backend: backend, store: store);
    await tester.tap(find.text('Forgot password?'));
    await settle(tester);
    await tester.enter('forgot.email', 'nobody@example.test');
    await tester.tapKey('forgot.submit');
    expect(find.text(ForgotPasswordScreen.sentMessage), findsOneWidget);
    expect(backend.last('POST /auth/forgot-password').body, {
      'email': 'nobody@example.test',
    });
  });

  testWidgets('offline banner follows connectivity', (tester) async {
    final connectivity = FakeConnectivity();
    await pumpApp(
      tester,
      backend: backend,
      store: store,
      connectivity: connectivity,
    );
    expect(find.text(OfflineBanner.message), findsNothing);
    connectivity.set(false);
    await settle(tester);
    expect(find.text(OfflineBanner.message), findsOneWidget);
    connectivity.set(true);
    await settle(tester);
    expect(find.text(OfflineBanner.message), findsNothing);
  });
}
