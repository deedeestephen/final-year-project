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
    expect(resolveRedirect(signedIn(['PATIENT']), Routes.login), '/me/home');
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
    expect(resolveRedirect(patient, '/home/admin'), '/me/home');
    expect(resolveRedirect(patient, '/home/clinician'), '/me/home');
    expect(resolveRedirect(patient, '/me/home'), isNull);
  });

  test('multi-role users may switch between their own homes', () {
    final s = signedIn(['PATIENT', 'CLINICIAN']);
    expect(resolveRedirect(s, Routes.login), '/home/clinician');
    expect(resolveRedirect(s, '/me/home'), isNull);
    expect(resolveRedirect(s, '/home/admin'), '/home/clinician');
  });

  test('clinicians reach patients, forms and sync', () {
    final s = signedIn(['CLINICIAN']);
    for (final path in [
      Routes.patients,
      Routes.newPatient,
      Routes.patient('p-1'),
      Routes.editPatient('p-1'),
      Routes.newRecord('p-1'),
      Routes.sync,
    ]) {
      expect(resolveRedirect(s, path), isNull, reason: path);
    }
  });

  test('pathologists can view patients but not change them', () {
    final s = signedIn(['PATHOLOGIST']);
    expect(resolveRedirect(s, Routes.patients), isNull);
    expect(resolveRedirect(s, Routes.patient('p-1')), isNull);
    expect(resolveRedirect(s, Routes.sync), isNull);
    expect(resolveRedirect(s, Routes.newPatient), '/home/pathologist');
    expect(resolveRedirect(s, Routes.newRecord('p-1')), '/home/pathologist');
    expect(resolveRedirect(s, Routes.editPatient('p-1')), '/home/pathologist');
  });

  test('patients and administrators have no clinical data on the device', () {
    expect(resolveRedirect(signedIn(['PATIENT']), Routes.patients), '/me/home');
    expect(resolveRedirect(signedIn(['ADMIN']), Routes.sync), '/home/admin');
  });

  test('the patient app is only for patient accounts', () {
    final patient = signedIn(['PATIENT']);
    for (final path in [
      Routes.myHome,
      Routes.myResults,
      Routes.learn,
      Routes.article('psa-test'),
      Routes.messages,
      Routes.profile,
      Routes.myConsents,
      Routes.myPassword,
    ]) {
      expect(resolveRedirect(patient, path), isNull, reason: path);
    }
    expect(
      resolveRedirect(signedIn(['CLINICIAN']), Routes.myResults),
      '/home/clinician',
    );
    expect(
      resolveRedirect(signedIn(['ADMIN']), Routes.messages),
      '/home/admin',
    );
    expect(resolveRedirect(const SignedOut(), Routes.myHome), Routes.login);
  });

  test('anyone signed out can open the create-account page', () {
    expect(resolveRedirect(const SignedOut(), Routes.register), isNull);
    expect(resolveRedirect(signedIn(['PATIENT']), Routes.register), '/me/home');
  });

  test('consent capture is for clinicians; images and AI for both clinical '
      'roles', () {
    final clinician = signedIn(['CLINICIAN']);
    final pathologist = signedIn(['PATHOLOGIST']);
    for (final path in [
      Routes.consents('p-1'),
      Routes.imaging('p-1'),
      Routes.uploadImaging('p-1'),
      Routes.analyses('p-1'),
      Routes.aiResults,
      Routes.aiJob('job-1'),
    ]) {
      expect(resolveRedirect(clinician, path), isNull, reason: path);
    }
    expect(
      resolveRedirect(pathologist, Routes.consents('p-1')),
      '/home/pathologist',
    );
    for (final path in [
      Routes.imaging('p-1'),
      Routes.analyses('p-1'),
      Routes.aiResults,
      Routes.aiJob('job-1'),
    ]) {
      expect(resolveRedirect(pathologist, path), isNull, reason: path);
    }
    expect(
      resolveRedirect(signedIn(['PATIENT']), Routes.aiResults),
      '/me/home',
    );
  });

  test('only pathologists open the review queue', () {
    final pathologist = signedIn(['PATHOLOGIST']);
    expect(resolveRedirect(pathologist, Routes.review), isNull);
    expect(resolveRedirect(pathologist, Routes.reviewSlide('s-1')), isNull);
    expect(
      resolveRedirect(signedIn(['CLINICIAN']), Routes.review),
      '/home/clinician',
    );
    expect(
      resolveRedirect(signedIn(['ADMIN']), Routes.reviewSlide('s-1')),
      '/home/admin',
    );
  });
}
