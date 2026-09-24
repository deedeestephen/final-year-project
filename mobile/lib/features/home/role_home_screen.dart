import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/routes.dart';
import '../../app/theme/tokens.dart';
import '../../shared/widgets/clinical_card.dart';
import '../../shared/widgets/offline_banner.dart';
import '../auth/application/session_controller.dart';
import '../auth/domain/current_user.dart';

/// A place in a role's home that later phases fill in.
class HomeDestination {
  const HomeDestination(this.title, this.description, this.icon, this.phase);
  final String title;
  final String description;
  final IconData icon;

  /// The build phase that delivers it; shown so nothing looks finished early.
  final int phase;
}

const roleDestinations = <UserRole, List<HomeDestination>>{
  UserRole.patient: [
    HomeDestination(
      'My screening',
      'Your screening history and next steps',
      Icons.assignment_outlined,
      8,
    ),
    HomeDestination(
      'Symptom check',
      'Answer a short questionnaire',
      Icons.checklist_outlined,
      8,
    ),
    HomeDestination(
      'Appointments',
      'Upcoming visits and reminders',
      Icons.event_outlined,
      13,
    ),
    HomeDestination(
      'Learn',
      'Prostate health information',
      Icons.menu_book_outlined,
      14,
    ),
  ],
  UserRole.clinician: [
    HomeDestination(
      'Patients',
      'Register and find patients',
      Icons.people_outline,
      8,
    ),
    HomeDestination(
      'New screening',
      'PSA, DRE and symptom scores',
      Icons.add_task_outlined,
      8,
    ),
    HomeDestination(
      'AI results to review',
      'Decision-support results awaiting you',
      Icons.fact_check_outlined,
      10,
    ),
    HomeDestination(
      'Referrals',
      'Referrals and follow-up',
      Icons.send_outlined,
      12,
    ),
  ],
  UserRole.pathologist: [
    HomeDestination(
      'Review queue',
      'Cases waiting for specialist review',
      Icons.inbox_outlined,
      11,
    ),
    HomeDestination(
      'Images',
      'MRI and histopathology uploads',
      Icons.image_outlined,
      9,
    ),
    HomeDestination(
      'Reports',
      'Signed-off reports',
      Icons.description_outlined,
      11,
    ),
  ],
  UserRole.admin: [
    HomeDestination(
      'Users',
      'Accounts, roles and access',
      Icons.manage_accounts_outlined,
      15,
    ),
    HomeDestination(
      'Facilities',
      'Clinics and hospitals',
      Icons.local_hospital_outlined,
      15,
    ),
    HomeDestination(
      'Audit log',
      'Who did what, and when',
      Icons.history_outlined,
      15,
    ),
    HomeDestination(
      'AI models',
      'Model versions and evaluation',
      Icons.model_training_outlined,
      16,
    ),
  ],
};

class RoleHomeScreen extends ConsumerWidget {
  const RoleHomeScreen({super.key, required this.role});

  final UserRole role;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider);
    if (session is! SignedIn) return const SizedBox.shrink();
    final user = session.user;
    final theme = Theme.of(context);
    final destinations = roleDestinations[role]!;

    return Scaffold(
      appBar: AppBar(title: Text(role.label)),
      drawer: _HomeDrawer(user: user, current: role),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(AppSizes.md),
              children: [
                Text(
                  'Welcome, ${user.displayName}',
                  style: theme.textTheme.titleLarge,
                ),
                const SizedBox(height: AppSizes.xs),
                Text(user.email, style: theme.textTheme.bodyMedium),
                const SizedBox(height: AppSizes.lg),
                for (final d in destinations) ...[
                  ClinicalCard(
                    child: Row(
                      children: [
                        Icon(d.icon, color: AppColors.navy),
                        const SizedBox(width: AppSizes.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(d.title, style: theme.textTheme.titleMedium),
                              const SizedBox(height: 2),
                              Text(
                                d.description,
                                style: theme.textTheme.bodyMedium,
                              ),
                              const SizedBox(height: AppSizes.xs),
                              Text(
                                'Coming in build phase ${d.phase}',
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSizes.sm),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeDrawer extends ConsumerWidget {
  const _HomeDrawer({required this.user, required this.current});

  final CurrentUser user;
  final UserRole current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final roles = UserRole.values.where(user.roles.contains).toList();
    return Drawer(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSizes.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(user.displayName, style: theme.textTheme.titleMedium),
                  Text(user.email, style: theme.textTheme.bodySmall),
                ],
              ),
            ),
            const Divider(),
            if (roles.length > 1)
              for (final r in roles)
                ListTile(
                  leading: const Icon(Icons.swap_horiz),
                  title: Text(r.label),
                  selected: r == current,
                  onTap: () {
                    Navigator.of(context).pop();
                    context.go(Routes.home(r));
                  },
                ),
            const Spacer(),
            const Divider(),
            ListTile(
              key: const Key('home.signOut'),
              leading: const Icon(Icons.logout),
              title: const Text('Sign out'),
              onTap: () {
                Navigator.of(context).pop();
                ref.read(sessionControllerProvider.notifier).signOut();
              },
            ),
          ],
        ),
      ),
    );
  }
}
