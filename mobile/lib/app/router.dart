import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/application/session_controller.dart';
import '../features/auth/domain/current_user.dart';
import '../features/auth/presentation/change_password_screen.dart';
import '../features/auth/presentation/forgot_password_screen.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/home/role_home_screen.dart';
import '../features/patients/presentation/add_record_screen.dart';
import '../features/patients/presentation/edit_patient_screen.dart';
import '../features/patients/presentation/patient_detail_screen.dart';
import '../features/patients/presentation/patients_screen.dart';
import '../features/patients/presentation/register_patient_screen.dart';
import '../features/sync/sync_screen.dart';
import 'routes.dart';

final routerProvider = Provider<GoRouter>((ref) {
  // Re-run redirects whenever the session changes.
  final refresh = ValueNotifier<SessionState>(
    ref.read(sessionControllerProvider),
  );
  ref.listen(sessionControllerProvider, (_, next) => refresh.value = next);
  ref.onDispose(refresh.dispose);

  final router = GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect: (context, state) => resolveRedirect(
      ref.read(sessionControllerProvider),
      state.matchedLocation,
    ),
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const _SplashScreen()),
      GoRoute(path: Routes.login, builder: (_, _) => const LoginScreen()),
      GoRoute(
        path: Routes.forgotPassword,
        builder: (_, _) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: Routes.changePassword,
        builder: (_, _) => const ChangePasswordScreen(),
      ),
      GoRoute(path: Routes.sync, builder: (_, _) => const SyncScreen()),
      GoRoute(
        path: Routes.patients,
        builder: (_, _) => const PatientsScreen(),
        routes: [
          // "new" is declared before ":id" so it is not read as an id.
          GoRoute(
            path: 'new',
            builder: (_, _) => const RegisterPatientScreen(),
          ),
          GoRoute(
            path: ':id',
            builder: (_, state) =>
                PatientDetailScreen(patientId: state.pathParameters['id']!),
            routes: [
              GoRoute(
                path: 'edit',
                builder: (_, state) =>
                    EditPatientScreen(patientId: state.pathParameters['id']!),
              ),
              GoRoute(
                path: 'records/new',
                builder: (_, state) =>
                    AddRecordScreen(patientId: state.pathParameters['id']!),
              ),
            ],
          ),
        ],
      ),
      for (final role in UserRole.values)
        GoRoute(
          path: Routes.home(role),
          builder: (_, _) => RoleHomeScreen(role: role),
        ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(child: CircularProgressIndicator(semanticsLabel: 'Loading')),
  );
}
