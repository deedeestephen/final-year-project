/// Roles defined by the backend RBAC catalogue.
enum UserRole {
  patient('PATIENT', 'Patient'),
  clinician('CLINICIAN', 'Clinician'),
  pathologist('PATHOLOGIST', 'Pathologist / Radiologist'),
  admin('ADMIN', 'Administrator');

  const UserRole(this.apiName, this.label);
  final String apiName;
  final String label;

  static UserRole? fromApi(String value) {
    for (final role in values) {
      if (role.apiName == value) return role;
    }
    return null;
  }
}

/// The signed-in user, from `GET /users/me` or the login response.
class CurrentUser {
  const CurrentUser({
    required this.id,
    required this.email,
    required this.displayName,
    required this.roles,
    required this.mustChangePassword,
    this.facilityId,
  });

  final String id;
  final String email;
  final String displayName;
  final Set<UserRole> roles;
  final bool mustChangePassword;
  final String? facilityId;

  /// The role whose home screen opens first when a user has several.
  UserRole get primaryRole {
    for (final role in const [
      UserRole.clinician,
      UserRole.pathologist,
      UserRole.admin,
      UserRole.patient,
    ]) {
      if (roles.contains(role)) return role;
    }
    return UserRole.patient;
  }

  /// Clinical staff keep patient data on the device and sync it.
  bool get canSync =>
      roles.contains(UserRole.clinician) ||
      roles.contains(UserRole.pathologist);

  /// Only clinicians register patients and add screening records.
  bool get canEditPatients => roles.contains(UserRole.clinician);

  CurrentUser copyWith({bool? mustChangePassword}) => CurrentUser(
    id: id,
    email: email,
    displayName: displayName,
    roles: roles,
    mustChangePassword: mustChangePassword ?? this.mustChangePassword,
    facilityId: facilityId,
  );

  factory CurrentUser.fromJson(Map<String, dynamic> json) => CurrentUser(
    id: json['id'] as String,
    email: json['email'] as String,
    displayName: json['displayName'] as String,
    roles: {
      for (final r in (json['roles'] as List).cast<String>())
        if (UserRole.fromApi(r) case final role?) role,
    },
    mustChangePassword: json['mustChangePassword'] as bool? ?? false,
    facilityId: json['facilityId'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'displayName': displayName,
    'roles': [for (final r in roles) r.apiName],
    'mustChangePassword': mustChangePassword,
    'facilityId': facilityId,
  };
}
