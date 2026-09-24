import '../features/auth/application/session_controller.dart';
import '../features/auth/domain/current_user.dart';

/// Route paths.
abstract final class Routes {
  static const splash = '/';
  static const login = '/login';
  static const forgotPassword = '/forgot-password';
  static const changePassword = '/change-password';

  static String home(UserRole role) => '/home/${role.name}';
}

const _publicRoutes = {Routes.login, Routes.forgotPassword};

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
      final isOwnHome = user.roles.any((r) => location == Routes.home(r));
      if (isOwnHome) return null;
      return Routes.home(user.primaryRole);
  }
}
