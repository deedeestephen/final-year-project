import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/app/routes.dart';
import 'package:pca_mhealth/features/auth/application/session_controller.dart';
import 'package:pca_mhealth/features/auth/domain/current_user.dart';

import '../support/app_harness.dart';

void main() {
  SignedIn signedIn(List<String> roles, {bool mustChange = false}) => SignedIn(
    CurrentUser.fromJson(
      userJson(roles: roles, mustChangePassword: mustChange),
    ),
  );

  test('restoring holds everything on the splash screen', () {
    const s = SessionRestoring();
    expect(resolveRedirect(s, Routes.splash), isNull);
    expect(resolveRedirect(s, Routes.login), Routes.splash);
    expect(resolveRedirect(s, '/home/clinician'), Routes.splash);
  });

  test('signed out may only see login and forgot-password', () {
    const s = SignedOut();
    expect(resolveRedirect(s, Routes.login), isNull);
    expect(resolveRedirect(s, Routes.forgotPassword), isNull);
    expect(resolveRedirect(s, Routes.splash), Routes.login);
    expect(resolveRedirect(s, Routes.changePassword), Routes.login);
    expect(resolveRedirect(s, '/home/admin'), Routes.login);
  });

  test('a forced password change blocks every other route', () {
    final s = signedIn(['CLINICIAN'], mustChange: true);
    expect(resolveRedirect(s, Routes.changePassword), isNull);
    expect(resolveRedirect(s, '/home/clinician'), Routes.changePassword);
    expect(resolveRedirect(s, Routes.login), Routes.changePassword);
  });

  test('each role lands on its own home', () {
    expect(
      resolveRedirect(signedIn(['PATIENT']), Routes.login),
      '/home/patient',
    );
    expect(
      resolveRedirect(signedIn(['CLINICIAN']), Routes.splash),
      '/home/clinician',
    );
    expect(
      resolveRedirect(signedIn(['PATHOLOGIST']), Routes.login),
      '/home/pathologist',
    );
    expect(resolveRedirect(signedIn(['ADMIN']), Routes.login), '/home/admin');
  });

  test("a user cannot open another role's home", () {
    final patient = signedIn(['PATIENT']);
    expect(resolveRedirect(patient, '/home/admin'), '/home/patient');
    expect(resolveRedirect(patient, '/home/clinician'), '/home/patient');
    expect(resolveRedirect(patient, '/home/patient'), isNull);
  });

  test('multi-role users may switch between their own homes', () {
    final s = signedIn(['PATIENT', 'CLINICIAN']);
    expect(resolveRedirect(s, Routes.login), '/home/clinician');
    expect(resolveRedirect(s, '/home/patient'), isNull);
    expect(resolveRedirect(s, '/home/admin'), '/home/clinician');
  });
}
