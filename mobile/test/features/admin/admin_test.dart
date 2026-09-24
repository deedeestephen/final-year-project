import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/app/routes.dart';
import 'package:pca_mhealth/features/auth/application/session_controller.dart';
import 'package:pca_mhealth/features/auth/domain/current_user.dart';

import '../../support/app_harness.dart';
import '../../support/fakes.dart';

Map<String, dynamic> userView(
  String id,
  String email, {
  List<String> roles = const ['CLINICIAN'],
  String status = 'ACTIVE',
  String? facilityId = 'f-1',
}) => {
  'id': id,
  'email': email,
  'displayName': 'SYNTHETIC $id',
  'status': status,
  'roles': roles,
  'facilityId': facilityId,
  'mustChangePassword': false,
  'lockedUntil': null,
  'lastLoginAt': null,
  'createdAt': '2026-09-01T10:00:00.000Z',
};

Map<String, dynamic> roleView(
  String name,
  List<String> permissions, {
  List<String> required = const [],
  List<String> notAllowed = const [],
}) => {
  'name': name,
  'description': '$name description',
  'permissions': permissions,
  'customised': false,
  'userCount': 3,
  'notAllowed': notAllowed,
  'required': required,
};

const catalogue = [
  {'code': 'patient:read', 'description': 'Read patients in own facility'},
  {
    'code': 'clinical:read',
    'description': 'Read clinical records in own facility',
  },
  {'code': 'user:manage', 'description': 'Create, modify and deactivate users'},
  {'code': 'role:manage', 'description': 'Assign roles and edit permissions'},
];

void main() {
  late FakeBackend backend;
  late InMemoryTokenStore store;

  setUp(() {
    store = InMemoryTokenStore();
    backend = FakeBackend()
      ..on('POST /auth/login', FakeResponse(200, loginJson(userJson())))
      ..on('GET /users/me', FakeResponse(200, userJson(roles: ['ADMIN'])))
      ..on(
        'GET /users',
        FakeResponse(200, {
          'items': [
            userView('u-2', 'nurse@example.test'),
            userView('u-3', 'locked@example.test', status: 'LOCKED'),
          ],
          'page': 1,
          'pageSize': 100,
          'total': 2,
        }),
      )
      ..on(
        'GET /users/u-2',
        FakeResponse(200, userView('u-2', 'nurse@example.test')),
      )
      ..on(
        'PATCH /users/u-2',
        FakeResponse(
          200,
          userView(
            'u-2',
            'nurse@example.test',
            roles: ['CLINICIAN', 'PATHOLOGIST'],
          ),
        ),
      )
      ..on(
        'POST /users/u-2/reset-password',
        const FakeResponse(200, {'temporaryPassword': 'Temp-Abc-123456'}),
      )
      ..on(
        'GET /admin/facilities',
        const FakeResponse(200, [
          {
            'id': 'f-1',
            'code': 'SYN-LSK-001',
            'name': 'SYNTHETIC Demo Referral Hospital',
            'province': 'Lusaka',
            'district': 'Lusaka',
          },
        ]),
      )
      ..on(
        'GET /admin/roles',
        FakeResponse(200, [
          roleView('PATHOLOGIST', ['patient:read', 'clinical:read']),
          roleView(
            'ADMIN',
            ['user:manage', 'role:manage'],
            required: ['user:manage', 'role:manage'],
          ),
        ]),
      )
      ..on('GET /admin/permissions', const FakeResponse(200, catalogue))
      ..on(
        'PUT /admin/roles/PATHOLOGIST/permissions',
        FakeResponse(200, roleView('PATHOLOGIST', ['patient:read'])),
      )
      ..on(
        'GET /admin/patient-accounts',
        const FakeResponse(200, {
          'items': [
            {
              'userId': 'p-1',
              'email': 'mwamba@example.test',
              'displayName': 'Mwamba B.',
              'idDocumentType': 'NRC',
              'idNumberMasked': '*******78/1',
              'phoneMasked': '*********4567',
              'linked': null,
              'createdAt': '2026-09-20T10:00:00.000Z',
            },
            {
              'userId': 'p-2',
              'email': 'visitor@example.test',
              'displayName': 'Visitor P.',
              'idDocumentType': 'PASSPORT',
              'idNumberMasked': '*****4567',
              'phoneMasked': null,
              'linked': null,
              'createdAt': '2026-09-20T10:00:00.000Z',
            },
          ],
          'page': 1,
          'pageSize': 100,
          'total': 2,
        }),
      )
      ..on(
        'POST /admin/patient-accounts/p-1/match',
        const FakeResponse(200, {
          'patientId': 'rec-1',
          'mrn': 'SYN-0001',
          'facilityName': 'SYNTHETIC Demo Referral Hospital',
          'linkedToAnotherAccount': false,
        }),
      )
      ..on('POST /admin/patient-accounts/p-1/link', const FakeResponse(200, {}))
      ..on(
        'POST /admin/patient-accounts/p-2/match',
        FakeResponse.error(400, 'NO_NRC'),
      );
  });

  Future<void> signInAsAdmin(WidgetTester tester) async {
    await pumpApp(tester, backend: backend, store: store);
    await tester.enter('login.email', 'admin@demo.pca-mhealth.test');
    await tester.enter('login.password', 'a-password-1234');
    await tester.tapKey('login.submit');
    expect(find.text('Administrator'), findsOneWidget);
  }

  testWidgets('the admin home opens users, roles and patient accounts', (
    tester,
  ) async {
    await signInAsAdmin(tester);
    expect(find.text('Users'), findsOneWidget);
    expect(find.text('Roles & permissions'), findsOneWidget);
    expect(find.text('Patient accounts'), findsOneWidget);
    expect(find.text('Coming in build phase 15'), findsOneWidget);
  });

  testWidgets('users: list with status, change roles and reset a password', (
    tester,
  ) async {
    await signInAsAdmin(tester);
    await tester.tap(find.text('Users'));
    await settle(tester);
    expect(find.text('nurse@example.test'), findsOneWidget);
    expect(find.text('Locked'), findsOneWidget);

    await tester.tapKey('user.nurse@example.test');
    await tester.tapKey('user.role.PATHOLOGIST');
    await tester.tapKey('user.save');
    expect(backend.last('PATCH /users/u-2').body, {
      'roles': ['CLINICIAN', 'PATHOLOGIST'],
    });
    expect(find.textContaining('Saved.'), findsOneWidget);
    // The message bar covers the bottom buttons until it times out.
    await tester.pump(const Duration(seconds: 5));
    await settle(tester);

    await tester.tapKey('user.resetPassword');
    expect(
      tester
          .widget<SelectableText>(find.byKey(const Key('admin.tempPassword')))
          .data,
      'Temp-Abc-123456',
    );
    expect(find.textContaining('shown only once'), findsOneWidget);
    await tester.tapKey('admin.tempPassword.done');
  });

  testWidgets('roles: locked boxes for safety rules, and saving asks first', (
    tester,
  ) async {
    await signInAsAdmin(tester);
    await tester.tap(find.text('Roles & permissions'));
    await settle(tester);
    expect(find.text('2 permissions · 3 accounts'), findsWidgets);

    await tester.tapKey('role.ADMIN');
    final adminBox = tester.widget<CheckboxListTile>(
      find.byKey(const Key('perm.role:manage')),
    );
    expect(adminBox.onChanged, isNull, reason: 'required for ADMIN');
    expect(find.textContaining('Always needed'), findsNWidgets(2));
    await tester.pageBack();
    await settle(tester);

    await tester.tapKey('role.PATHOLOGIST');
    await tester.tapKey('perm.clinical:read');
    await tester.tapKey('role.save');
    expect(find.textContaining('3 accounts with the'), findsOneWidget);
    await tester.tapKey('role.confirmSave');
    expect(backend.last('PUT /admin/roles/PATHOLOGIST/permissions').body, {
      'permissions': ['patient:read'],
    });
    expect(find.text('Permissions saved.'), findsOneWidget);
  });

  testWidgets('patient accounts: match by NRC then link; passports explained', (
    tester,
  ) async {
    await signInAsAdmin(tester);
    await tester.tap(find.text('Patient accounts'));
    await settle(tester);
    expect(find.textContaining('NRC *******78/1'), findsOneWidget);

    await tester.tapKey('account.link.mwamba@example.test');
    expect(
      find.textContaining('record SYN-0001 at SYNTHETIC Demo'),
      findsOneWidget,
    );
    await tester.tapKey('account.confirmLink');
    expect(backend.calls, contains('POST /admin/patient-accounts/p-1/link'));
    expect(find.text('Account linked.'), findsOneWidget);

    await tester.tapKey('account.link.visitor@example.test');
    expect(find.textContaining('uses a passport'), findsOneWidget);
  });

  test('only administrators can open the admin screens', () {
    SignedIn signedIn(List<String> roles) =>
        SignedIn(CurrentUser.fromJson(userJson(roles: roles)));
    expect(resolveRedirect(signedIn(['ADMIN']), Routes.adminRoles), isNull);
    expect(resolveRedirect(signedIn(['ADMIN']), '/admin/users/u-2'), isNull);
    expect(
      resolveRedirect(signedIn(['CLINICIAN']), Routes.adminUsers),
      '/home/clinician',
    );
    expect(
      resolveRedirect(signedIn(['PATIENT']), Routes.adminPatientAccounts),
      '/me/home',
    );
  });
}
