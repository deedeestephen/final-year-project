import '../features/auth/application/session_controller.dart';
import '../features/auth/domain/current_user.dart';

/// Route paths.
abstract final class Routes {
  static const splash = '/';
  static const login = '/login';
  static const register = '/register';
  static const forgotPassword = '/forgot-password';
  static const changePassword = '/change-password';
  static const patients = '/patients';
  static const newPatient = '/patients/new';
  static const sync = '/sync';

  // Patient app (bottom tabs).
  static const me = '/me';
  static const myHome = '/me/home';
  static const myResults = '/me/results';
  static const learn = '/me/learn';
  static const messages = '/me/messages';
  static const profile = '/me/profile';
  static const myConsents = '/me/profile/consents';
  static const myReports = '/me/profile/reports';
  static const myPassword = '/me/profile/password';

  static String home(UserRole role) =>
      role == UserRole.patient ? myHome : '/home/${role.name}';
  static String patient(String id) => '/patients/$id';
  static String editPatient(String id) => '/patients/$id/edit';
  static String newRecord(String id) => '/patients/$id/records/new';
  static String article(String id) => '/me/learn/$id';
}

const _publicRoutes = {Routes.login, Routes.register, Routes.forgotPassword};

/// Routes that change clinical data.
bool _isEditRoute(String location) =>
    location == Routes.newPatient ||
    location.endsWith('/edit') ||
    location.endsWith('/records/new');

bool _isClinicalRoute(String location) =>
    location == Routes.sync ||
    location == Routes.patients ||
    location.startsWith('${Routes.patients}/');

bool _isPatientAppRoute(String location) =>
    location.startsWith('${Routes.me}/');

/// Navigation rules as a pure function (unit-tested). Returns where to go, or
/// null to stay. UI gating is convenience only; the API enforces access.
String? resolveRedirect(SessionState session, String location) {
  switch (session) {
    case SessionRestoring():
      return location == Routes.splash ? null : Routes.splash;
    case SignedOut():
      return _publicRoutes.contains(location) ? null : Routes.login;
    case SignedIn(:final user):
      if (user.mustChangePassword) {
        return location == Routes.changePassword ? null : Routes.changePassword;
      }
      final home = Routes.home(user.primaryRole);
      if (_isClinicalRoute(location)) {
        if (!user.canSync) return home;
        if (_isEditRoute(location) && !user.canEditPatients) return home;
        return null;
      }
      if (_isPatientAppRoute(location)) {
        return user.roles.contains(UserRole.patient) ? null : home;
      }
      final isOwnHome = user.roles.any((r) => location == Routes.home(r));
      if (isOwnHome) return null;
      return home;
  }
}
