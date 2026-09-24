import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';

/// A staff or patient account as the administrator sees it.
class AdminUser {
  const AdminUser({
    required this.id,
    required this.email,
    required this.displayName,
    required this.status,
    required this.roles,
    required this.mustChangePassword,
    this.facilityId,
    this.lastLoginAt,
  });

  factory AdminUser.fromJson(Map<String, dynamic> j) => AdminUser(
    id: j['id'] as String,
    email: j['email'] as String,
    displayName: j['displayName'] as String,
    status: j['status'] as String,
    roles: (j['roles'] as List).cast<String>(),
    mustChangePassword: j['mustChangePassword'] as bool? ?? false,
    facilityId: j['facilityId'] as String?,
    lastLoginAt: j['lastLoginAt'] == null
        ? null
        : DateTime.parse(j['lastLoginAt'] as String),
  );

  final String id;
  final String email;
  final String displayName;
  final String status; // ACTIVE | LOCKED | DISABLED
  final List<String> roles;
  final bool mustChangePassword;
  final String? facilityId;
  final DateTime? lastLoginAt;
}

class RoleInfo {
  const RoleInfo({
    required this.name,
    required this.description,
    required this.permissions,
    required this.customised,
    required this.userCount,
    required this.notAllowed,
    required this.required,
  });

  factory RoleInfo.fromJson(Map<String, dynamic> j) => RoleInfo(
    name: j['name'] as String,
    description: j['description'] as String,
    permissions: (j['permissions'] as List).cast<String>(),
    customised: j['customised'] as bool,
    userCount: j['userCount'] as int,
    notAllowed: (j['notAllowed'] as List).cast<String>(),
    required: (j['required'] as List).cast<String>(),
  );

  final String name;
  final String description;
  final List<String> permissions;
  final bool customised;
  final int userCount;
  final List<String> notAllowed;
  final List<String> required;
}

class PermissionInfo {
  const PermissionInfo(this.code, this.description);
  final String code;
  final String description;
}

class Facility {
  const Facility({required this.id, required this.name, required this.code});
  final String id;
  final String name;
  final String code;
}

class PatientAccount {
  const PatientAccount({
    required this.userId,
    required this.email,
    required this.displayName,
    this.idDocumentType,
    this.idNumberMasked,
    this.phoneMasked,
    this.linkedMrn,
    this.linkedFacility,
  });

  factory PatientAccount.fromJson(Map<String, dynamic> j) {
    final linked = j['linked'] as Map<String, dynamic>?;
    return PatientAccount(
      userId: j['userId'] as String,
      email: j['email'] as String,
      displayName: j['displayName'] as String,
      idDocumentType: j['idDocumentType'] as String?,
      idNumberMasked: j['idNumberMasked'] as String?,
      phoneMasked: j['phoneMasked'] as String?,
      linkedMrn: linked?['mrn'] as String?,
      linkedFacility: linked?['facilityName'] as String?,
    );
  }

  final String userId;
  final String email;
  final String displayName;
  final String? idDocumentType;
  final String? idNumberMasked;
  final String? phoneMasked;
  final String? linkedMrn;
  final String? linkedFacility;

  bool get isLinked => linkedMrn != null;
}

class RecordMatch {
  const RecordMatch({
    required this.mrn,
    required this.facilityName,
    required this.linkedToAnotherAccount,
  });
  final String mrn;
  final String facilityName;
  final bool linkedToAnotherAccount;
}

/// Administration API (`/users`, `/admin/...`). Every rule is enforced by the
/// server; the screens only make the rules visible.
class AdminRepository {
  AdminRepository(this._api);

  final ApiClient _api;

  Future<List<AdminUser>> users({String? q, String? role}) async {
    final body = await _api.get<Map<String, dynamic>>(
      '/users',
      query: {
        'pageSize': 100,
        if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
        'role': ?role,
      },
    );
    return [
      for (final u in (body['items'] as List).cast<Map<String, dynamic>>())
        AdminUser.fromJson(u),
    ];
  }

  Future<AdminUser> user(String id) async =>
      AdminUser.fromJson(await _api.get<Map<String, dynamic>>('/users/$id'));

  /// Returns the one-time temporary password.
  Future<String> createUser({
    required String email,
    required String displayName,
    required List<String> roles,
    String? facilityId,
  }) async {
    final body = await _api.post<Map<String, dynamic>>(
      '/users',
      data: {
        'email': email.trim(),
        'displayName': displayName.trim(),
        'roles': roles,
        'facilityId': ?facilityId,
      },
    );
    return body['temporaryPassword'] as String;
  }

  Future<AdminUser> updateUser(String id, Map<String, Object> changes) async =>
      AdminUser.fromJson(
        await _api.patch<Map<String, dynamic>>('/users/$id', data: changes),
      );

  Future<String> resetPassword(String id) async {
    final body = await _api.post<Map<String, dynamic>>(
      '/users/$id/reset-password',
    );
    return body['temporaryPassword'] as String;
  }

  Future<List<RoleInfo>> roles() async => [
    for (final r in (await _api.get<List<dynamic>>(
      '/admin/roles',
    )).cast<Map<String, dynamic>>())
      RoleInfo.fromJson(r),
  ];

  Future<List<PermissionInfo>> permissions() async => [
    for (final p in (await _api.get<List<dynamic>>(
      '/admin/permissions',
    )).cast<Map<String, dynamic>>())
      PermissionInfo(p['code'] as String, p['description'] as String),
  ];

  Future<RoleInfo> setRolePermissions(String role, List<String> codes) async =>
      RoleInfo.fromJson(
        await _api.put<Map<String, dynamic>>(
          '/admin/roles/$role/permissions',
          data: {'permissions': codes},
        ),
      );

  Future<RoleInfo> resetRole(String role) async => RoleInfo.fromJson(
    await _api.post<Map<String, dynamic>>('/admin/roles/$role/reset'),
  );

  Future<List<Facility>> facilities() async => [
    for (final f in (await _api.get<List<dynamic>>(
      '/admin/facilities',
    )).cast<Map<String, dynamic>>())
      Facility(
        id: f['id'] as String,
        name: f['name'] as String,
        code: f['code'] as String,
      ),
  ];

  Future<List<PatientAccount>> patientAccounts(String status) async {
    final body = await _api.get<Map<String, dynamic>>(
      '/admin/patient-accounts',
      query: {'status': status, 'pageSize': 100},
    );
    return [
      for (final a in (body['items'] as List).cast<Map<String, dynamic>>())
        PatientAccount.fromJson(a),
    ];
  }

  Future<RecordMatch> match(String userId) async {
    final body = await _api.post<Map<String, dynamic>>(
      '/admin/patient-accounts/$userId/match',
    );
    return RecordMatch(
      mrn: body['mrn'] as String,
      facilityName: body['facilityName'] as String,
      linkedToAnotherAccount: body['linkedToAnotherAccount'] as bool,
    );
  }

  Future<void> link(String userId) =>
      _api.post<Map<String, dynamic>>('/admin/patient-accounts/$userId/link');

  Future<void> unlink(String userId) =>
      _api.post<Map<String, dynamic>>('/admin/patient-accounts/$userId/unlink');
}

final adminRepositoryProvider = Provider<AdminRepository>(
  (ref) => AdminRepository(ref.watch(apiClientProvider)),
);

Duration? _noRetry(int retryCount, Object error) => null;

final facilitiesProvider = FutureProvider<List<Facility>>(
  (ref) => ref.watch(adminRepositoryProvider).facilities(),
  retry: _noRetry,
);

final rolesProvider = FutureProvider<List<RoleInfo>>(
  (ref) => ref.watch(adminRepositoryProvider).roles(),
  retry: _noRetry,
);

final permissionCatalogueProvider = FutureProvider<List<PermissionInfo>>(
  (ref) => ref.watch(adminRepositoryProvider).permissions(),
  retry: _noRetry,
);
