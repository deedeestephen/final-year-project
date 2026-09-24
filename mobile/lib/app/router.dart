import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/application/session_controller.dart';
import '../features/auth/domain/current_user.dart';
import '../features/auth/presentation/change_password_screen.dart';
import '../features/auth/presentation/forgot_password_screen.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/register_account_screen.dart';
import '../features/home/role_home_screen.dart';
import '../features/patient/presentation/learn_screen.dart';
import '../features/patient/presentation/messages_screen.dart';
import '../features/patient/presentation/my_home_screen.dart';
import '../features/patient/presentation/my_results_screen.dart';
import '../features/patient/presentation/patient_shell.dart';
import '../features/patient/presentation/profile_screens.dart';
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
      GoRoute(
        path: Routes.register,
        builder: (_, _) => const RegisterAccountScreen(),
      ),
      // Patient app: bottom tabs, each keeping its own navigation stack.
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => PatientShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.myHome,
                builder: (_, _) => const MyHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.myResults,
                builder: (_, _) => const MyResultsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.learn,
                builder: (_, _) => const LearnScreen(),
                routes: [
                  GoRoute(
                    path: ':articleId',
                    builder: (_, state) => ArticleScreen(
                      articleId: state.pathParameters['articleId']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.messages,
                builder: (_, _) => const MessagesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.profile,
                builder: (_, _) => const ProfileScreen(),
                routes: [
                  GoRoute(
                    path: 'consents',
                    builder: (_, _) => const MyConsentsScreen(),
                  ),
                  GoRoute(
                    path: 'reports',
                    builder: (_, _) => const MyReportsScreen(),
                  ),
                  GoRoute(
                    path: 'password',
                    builder: (_, _) =>
                        const ChangePasswordScreen(forced: false),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      // Staff homes (the patient home is the tab shell above).
      for (final role in UserRole.values.where((r) => r != UserRole.patient))
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
