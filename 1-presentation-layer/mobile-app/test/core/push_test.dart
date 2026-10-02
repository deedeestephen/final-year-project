import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/core/push/push_messaging.dart';
import 'package:pca_mhealth/core/push/push_providers.dart';
import 'package:pca_mhealth/features/patient/presentation/messages_screen.dart';

import '../support/app_harness.dart';
import '../support/fakes.dart';
import '../support/push_fakes.dart';

/// ADR-014: push notifications for patients, with the phone's push service
/// played by a fake.
void main() {
  late FakeBackend backend;
  late InMemoryTokenStore store;
  late FakePushMessaging push;

  const record = PushNotice(
    type: 'clinical_record.created',
    notificationId: 'n-9',
  );

  setUp(() {
    store = InMemoryTokenStore();
    push = FakePushMessaging();
    backend = FakeBackend()
      ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
      ..on('GET /users/me', FakeResponse(200, userJson(roles: ['PATIENT'])))
      ..on('POST /auth/logout', const FakeResponse(204))
      // Not linked to a clinic record: the simplest patient home.
      ..on('GET /patients/me', FakeResponse.error(404, 'NOT_FOUND'))
      ..on(
        'GET /notifications',
        const FakeResponse(200, {
          'items': <Object>[],
          'unreadCount': 0,
          'page': 1,
          'pageSize': 50,
          'total': 0,
        }),
      )
      ..on(
        'POST /notifications/devices',
        const FakeResponse(201, {'id': 'd-1'}),
      )
      ..on('DELETE /notifications/devices/d-1', const FakeResponse(204));
  });

  Future<void> start(WidgetTester tester, {bool withPush = true}) => pumpApp(
    tester,
    backend: backend,
    store: store,
    overrides: [if (withPush) pushMessagingProvider.overrideWithValue(push)],
  );

  Future<void> signIn(WidgetTester tester, {bool withPush = true}) async {
    await start(tester, withPush: withPush);
    await tester.enter('login.email', 'patient@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
  }

  Future<void> signOut(WidgetTester tester) async {
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('Profile'),
      ),
    );
    await settle(tester);
    await tester.tapKey('profile.signOut');
  }

  int count(String route) => backend.calls.where((c) => c == route).length;

  testWidgets(
    "a patient's phone is registered after sign-in, and removed before sign-out",
    (tester) async {
      await signIn(tester);
      expect(push.permissionAsks, 1);
      expect(backend.last('POST /notifications/devices').body, {
        'token': push.address,
        'platform': 'android',
      });

      final dropped = push.deletedTokens;
      await signOut(tester);
      expect(find.byKey(const Key('login.email')), findsOneWidget);
      // The server is told while the session is still valid, then the phone
      // drops its push address.
      expect(
        backend.calls.indexOf('DELETE /notifications/devices/d-1'),
        lessThan(backend.calls.indexOf('POST /auth/logout')),
      );
      expect(push.deletedTokens, dropped + 1);
    },
  );

  testWidgets(
    'a start without a session drops the push address (a sign-out made offline)',
    (tester) async {
      await start(tester);
      expect(find.byKey(const Key('login.email')), findsOneWidget);
      expect(push.deletedTokens, 1);
      expect(count('POST /notifications/devices'), 0);
    },
  );

  testWidgets('a renewed push address is registered again', (tester) async {
    await signIn(tester);
    push.renew('phone-token-2');
    await settle(tester);
    expect(count('POST /notifications/devices'), 2);
    expect(
      (backend.last('POST /notifications/devices').body! as Map)['token'],
      'phone-token-2',
    );
  });

  testWidgets(
    'a push while the app is open updates the messages; a tapped one opens them',
    (tester) async {
      await signIn(tester);
      final before = count('GET /notifications');
      push.arrive(record);
      await settle(tester);
      expect(count('GET /notifications'), greaterThan(before));
      expect(find.byType(MessagesScreen), findsNothing);

      push.tapPush(record);
      await settle(tester);
      expect(find.byType(MessagesScreen), findsOneWidget);
    },
  );

  testWidgets('a push that started the app opens the messages', (tester) async {
    store.tokens = savedTokens;
    push.initial = record;
    await start(tester);
    expect(find.byType(MessagesScreen), findsOneWidget);
    expect(count('POST /notifications/devices'), 1);
  });

  testWidgets('nothing is registered when notifications are not allowed', (
    tester,
  ) async {
    push.allow = false;
    await signIn(tester);
    expect(push.permissionAsks, 1);
    expect(count('POST /notifications/devices'), 0);
  });

  testWidgets(
    'clinicians are not registered: their notifications stay in the app',
    (tester) async {
      backend.on('GET /users/me', FakeResponse(200, userJson()));
      await signIn(tester);
      expect(push.permissionAsks, 0);
      expect(count('POST /notifications/devices'), 0);
    },
  );

  testWidgets('a failed registration never stops the app', (tester) async {
    backend.on(
      'POST /notifications/devices',
      FakeResponse.error(500, 'INTERNAL'),
    );
    await signIn(tester);
    expect(find.byKey(const Key('login.email')), findsNothing);
    final dropped = push.deletedTokens;
    await signOut(tester);
    // No device id was given, so there is nothing to delete on the server;
    // the phone still drops its push address.
    expect(count('DELETE /notifications/devices/d-1'), 0);
    expect(push.deletedTokens, dropped + 1);
  });

  testWidgets('an expired session drops the push address', (tester) async {
    store.tokens = savedTokens;
    backend
      ..on('GET /users/me', FakeResponse.error(401, 'INVALID_TOKEN'))
      ..on('POST /auth/refresh', FakeResponse.error(401, 'INVALID_TOKEN'));
    await start(tester);
    expect(find.textContaining('session has ended'), findsOneWidget);
    expect(push.deletedTokens, 1);
  });

  testWidgets('without the Firebase settings there is no push at all', (
    tester,
  ) async {
    await signIn(tester, withPush: false);
    expect(count('POST /notifications/devices'), 0);
    await signOut(tester);
    expect(find.byKey(const Key('login.email')), findsOneWidget);
  });
}
