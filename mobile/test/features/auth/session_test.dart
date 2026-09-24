import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/core/db/local_store.dart';
import 'package:pca_mhealth/core/network/api_exception.dart';
import 'package:pca_mhealth/core/providers.dart';
import 'package:pca_mhealth/features/auth/application/session_controller.dart';
import 'package:pca_mhealth/features/auth/domain/current_user.dart';

import '../../support/app_harness.dart';
import '../../support/fakes.dart';

void main() {
  late FakeBackend backend;
  late InMemoryTokenStore store;
  late ProviderContainer container;

  setUp(() {
    backend = FakeBackend();
    store = InMemoryTokenStore();
    container = ProviderContainer(
      overrides: testOverrides(backend: backend, store: store),
    );
    addTearDown(container.dispose);
  });

  SessionController controller() =>
      container.read(sessionControllerProvider.notifier);

  Future<SessionState> settled() async {
    container.read(sessionControllerProvider);
    for (var i = 0; i < 50; i++) {
      final s = container.read(sessionControllerProvider);
      if (s is! SessionRestoring) return s;
      await Future<void>.delayed(Duration.zero);
    }
    return container.read(sessionControllerProvider);
  }

  group('CurrentUser', () {
    test('parses /users/me and ignores unknown roles', () {
      final user = CurrentUser.fromJson(
        userJson(roles: ['PATIENT', 'SUPERUSER', 'CLINICIAN']),
      );
      expect(user.roles, {UserRole.patient, UserRole.clinician});
      expect(user.facilityId, 'f-1');
      expect(user.mustChangePassword, isFalse);
    });

    test('home role priority is clinician, pathologist, admin, patient', () {
      CurrentUser withRoles(List<String> roles) =>
          CurrentUser.fromJson(userJson(roles: roles));
      expect(
        withRoles(['PATIENT', 'CLINICIAN']).primaryRole,
        UserRole.clinician,
      );
      expect(
        withRoles(['ADMIN', 'PATHOLOGIST']).primaryRole,
        UserRole.pathologist,
      );
      expect(withRoles(['PATIENT', 'ADMIN']).primaryRole, UserRole.admin);
      expect(withRoles(['PATIENT']).primaryRole, UserRole.patient);
      expect(withRoles([]).primaryRole, UserRole.patient);
    });
  });

  group('AuthRepository', () {
    test('login stores both tokens and loads the full profile', () async {
      backend
        ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
        ..on('GET /users/me', FakeResponse(200, userJson()));
      final user = await container
          .read(authRepositoryProvider)
          .login('  clinician@demo.pca-mhealth.test ', 'secret-password');

      expect(user.displayName, 'Demo Clinician');
      expect(store.tokens?.accessToken, 'access-new');
      expect(store.tokens?.refreshToken, 'refresh-new');
      expect(backend.last('POST /auth/login').body, {
        'email': 'clinician@demo.pca-mhealth.test',
        'password': 'secret-password',
      });
      expect(
        backend.last('GET /users/me').headers['Authorization'],
        'Bearer access-new',
      );
    });

    test('failed login stores nothing', () async {
      backend.on(
        'POST /auth/login',
        FakeResponse.error(401, 'INVALID_CREDENTIALS'),
      );
      await expectLater(
        container.read(authRepositoryProvider).login('a@b.co', 'x'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'INVALID_CREDENTIALS',
          ),
        ),
      );
      expect(store.tokens, isNull);
    });

    test('restore without saved tokens makes no request', () async {
      expect(await container.read(authRepositoryProvider).restore(), isNull);
      expect(backend.calls, isEmpty);
    });

    test('logout revokes on the server and clears the device', () async {
      store.tokens = savedTokens;
      backend.on('POST /auth/logout', const FakeResponse(204));
      await container.read(authRepositoryProvider).logout();
      expect(backend.calls, ['POST /auth/logout']);
      expect(store.tokens, isNull);
    });

    test('logout still clears the device when offline', () async {
      store.tokens = savedTokens;
      backend.isOffline = true;
      await container.read(authRepositoryProvider).logout();
      expect(store.tokens, isNull);
    });

    test('change and forgot password send the expected bodies', () async {
      store.tokens = savedTokens;
      backend
        ..on('POST /auth/change-password', const FakeResponse(204))
        ..on('POST /auth/forgot-password', const FakeResponse(202, {}));
      final repo = container.read(authRepositoryProvider);
      await repo.changePassword('old-password-1', 'new-password-12');
      await repo.forgotPassword(' a@b.co ');
      expect(backend.last('POST /auth/change-password').body, {
        'currentPassword': 'old-password-1',
        'newPassword': 'new-password-12',
      });
      expect(backend.last('POST /auth/forgot-password').body, {
        'email': 'a@b.co',
      });
    });
  });

  group('SessionController', () {
    test('restores a saved session', () async {
      store.tokens = savedTokens;
      backend.on('GET /users/me', FakeResponse(200, userJson()));
      final state = await settled();
      expect(state, isA<SignedIn>());
    });

    test('starts signed out when nothing is saved', () async {
      final state = await settled();
      expect(state, isA<SignedOut>());
      expect((state as SignedOut).reason, isNull);
    });

    test('explains when start-up restore fails offline', () async {
      store.tokens = savedTokens;
      backend.isOffline = true;
      final state = await settled();
      expect((state as SignedOut).reason, contains('offline'));
      expect(
        store.tokens,
        isNotNull,
        reason: 'offline must not end the session',
      );
    });

    test('a refused refresh signs out with a session-ended message', () async {
      store.tokens = savedTokens;
      backend
        ..on('GET /users/me', FakeResponse.error(401, 'INVALID_TOKEN'))
        ..on('POST /auth/refresh', FakeResponse.error(401, 'INVALID_TOKEN'));
      final state = await settled();
      expect((state as SignedOut).reason, contains('session has ended'));
      expect(store.tokens, isNull);
    });

    test('sign in, change password, sign out', () async {
      await settled();
      backend
        ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
        ..on(
          'GET /users/me',
          FakeResponse(200, userJson(mustChangePassword: true)),
        )
        ..on('POST /auth/change-password', const FakeResponse(204))
        ..on('POST /auth/logout', const FakeResponse(204));

      await controller().signIn('clinician@demo.pca-mhealth.test', 'pw');
      var state = container.read(sessionControllerProvider) as SignedIn;
      expect(state.user.mustChangePassword, isTrue);

      await controller().changePassword('pw', 'a-new-password-1');
      state = container.read(sessionControllerProvider) as SignedIn;
      expect(state.user.mustChangePassword, isFalse);

      await controller().signOut();
      expect(container.read(sessionControllerProvider), isA<SignedOut>());
      expect(store.tokens, isNull);
    });

    test('a failed sign-in throws and stays signed out', () async {
      await settled();
      backend.on('POST /auth/login', FakeResponse.error(423, 'ACCOUNT_LOCKED'));
      await expectLater(
        controller().signIn('a@b.co', 'pw'),
        throwsA(isA<ApiException>()),
      );
      expect(container.read(sessionControllerProvider), isA<SignedOut>());
    });
  });

  group('session and the device database', () {
    test('an offline start continues with the saved profile', () async {
      // First run online: signs in and caches the profile.
      await settled();
      backend
        ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
        ..on('GET /users/me', FakeResponse(200, userJson()));
      await controller().signIn('clinician@demo.pca-mhealth.test', 'pw');

      // Next start: no network, but tokens and profile are on the device.
      final restarted = ProviderContainer(
        overrides: testOverrides(
          backend: backend,
          store: store,
          database: container.read(appDatabaseProvider),
        ),
      );
      addTearDown(restarted.dispose);
      backend.isOffline = true;
      restarted.read(sessionControllerProvider);
      for (
        var i = 0;
        i < 50 && restarted.read(sessionControllerProvider) is SessionRestoring;
        i++
      ) {
        await Future<void>.delayed(Duration.zero);
      }
      final state = restarted.read(sessionControllerProvider);
      expect(state, isA<SignedIn>());
      expect((state as SignedIn).user.displayName, 'Demo Clinician');
    });

    test('signing in as someone else clears the previous user data', () async {
      await settled();
      final local = container.read(localStoreProvider);
      await local.prepareFor('someone-else');
      await local.registerPatient(
        const PatientDraft(
          givenName: 'SYNTHETIC',
          familyName: 'Left behind',
          dateOfBirth: '1950-01-01',
          regionClass: 'URBAN',
        ),
      );
      backend
        ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
        ..on('GET /users/me', FakeResponse(200, userJson()));
      await controller().signIn('clinician@demo.pca-mhealth.test', 'pw');
      expect(await local.watchPatients().first, isEmpty);
      expect(await local.meta(MetaKey.owner), 'u-1');
    });

    test('signing out removes clinical data and the cached profile', () async {
      await settled();
      backend
        ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
        ..on('GET /users/me', FakeResponse(200, userJson()))
        ..on('POST /auth/logout', const FakeResponse(204));
      await controller().signIn('clinician@demo.pca-mhealth.test', 'pw');
      final local = container.read(localStoreProvider);
      await local.registerPatient(
        const PatientDraft(
          givenName: 'SYNTHETIC',
          familyName: 'Temp',
          dateOfBirth: '1950-01-01',
          regionClass: 'URBAN',
        ),
      );
      await controller().signOut();
      expect(await local.watchPatients().first, isEmpty);
      expect(await local.cachedUser(), isNull);
    });
  });
}
