import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/routes.dart';
import '../../core/config/app_env.dart';
import '../../app/theme/tokens.dart';
import '../../core/providers.dart';
import '../../shared/widgets/clinical_card.dart';
import '../../shared/widgets/national_stripe.dart';
import '../../shared/widgets/offline_banner.dart';
import '../auth/application/session_controller.dart';
import '../auth/domain/current_user.dart';
import '../sync/device_sync_button.dart';

/// A place in a role's home. Destinations a later phase delivers show that
/// phase, so nothing looks finished early.
class HomeDestination {
  const HomeDestination(
    this.title,
    this.description,
    this.icon, {
    this.phase,
    this.route,
  });
  final String title;
  final String description;
  final IconData icon;

  /// The build phase that delivers it; null when it is available now.
  final int? phase;
  final String? route;
}

/// Staff homes. Patients have their own tabbed app (features/patient).
const roleDestinations = <UserRole, List<HomeDestination>>{
  UserRole.clinician: [
    HomeDestination(
      'Patients',
      'Register and find patients, also offline',
      Icons.people_outline,
      route: Routes.patients,
    ),
    HomeDestination(
      'New screening',
      'Choose a patient, then add PSA, DRE and PI-RADS',
      Icons.add_task_outlined,
      route: Routes.patients,
    ),
    HomeDestination(
      'AI results to review',
      'Decision-support results awaiting you',
      Icons.fact_check_outlined,
      phase: 10,
    ),
    HomeDestination(
      'Referrals',
      'Referrals and follow-up',
      Icons.send_outlined,
      phase: 12,
    ),
  ],
  UserRole.pathologist: [
    HomeDestination(
      'Patients',
      'View patients and their screening records',
      Icons.people_outline,
      route: Routes.patients,
    ),
    HomeDestination(
      'Review queue',
      'Cases waiting for specialist review',
      Icons.inbox_outlined,
      phase: 11,
    ),
    HomeDestination(
      'Images',
      'MRI and histopathology uploads',
      Icons.image_outlined,
      phase: 9,
    ),
    HomeDestination(
      'Reports',
      'Signed-off reports',
      Icons.description_outlined,
      phase: 11,
    ),
  ],
  UserRole.admin: [
    HomeDestination(
      'Administration is on the web',
      'Manage users, roles and permissions, and patient accounts in the '
          'PCa mHealth admin portal on a computer (${AppEnv.adminPortalUrl}).',
      Icons.computer_outlined,
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
      appBar: AppBar(
        title: Text(role.label),
        actions: [if (user.canSync) const DeviceSyncButton()],
      ),
      drawer: _HomeDrawer(user: user, current: role),
      body: Column(
        children: [
          const NationalStripe(height: 4),
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
                    onTap: d.route == null
                        ? null
                        : () => context.push(d.route!),
                    child: Row(
                      children: [
                        Icon(d.icon, color: AppColors.primary),
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
                              if (d.phase != null) ...[
                                const SizedBox(height: AppSizes.xs),
                                Text(
                                  'Coming in build phase ${d.phase}',
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                            ],
                          ),
                        ),
                        if (d.route != null)
                          const Icon(
                            Icons.chevron_right,
                            color: AppColors.textSecondary,
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

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final counts = await ref.read(localStoreProvider).counts();
    final unsent = counts.pending + counts.rejected + counts.conflicts;
    if (unsent > 0 && context.mounted) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Unsent changes'),
          content: Text(
            '$unsent change${unsent == 1 ? ' has' : 's have'} not been sent to the server yet. '
            'Signing out removes ${unsent == 1 ? 'it' : 'them'} from this phone. '
            'Connect to the internet and sync first to keep ${unsent == 1 ? 'it' : 'them'}.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            TextButton(
              key: const Key('signOut.confirm'),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Sign out anyway'),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }
    await ref.read(sessionControllerProvider.notifier).signOut();
  }

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
            if (user.canSync)
              ListTile(
                leading: const Icon(Icons.sync),
                title: const Text('Sync'),
                onTap: () {
                  Navigator.of(context).pop();
                  context.push(Routes.sync);
                },
              ),
            const Spacer(),
            const Divider(),
            ListTile(
              key: const Key('home.signOut'),
              leading: const Icon(Icons.logout),
              title: const Text('Sign out'),
              onTap: () async {
                Navigator.of(context).pop();
                await _signOut(context, ref);
              },
            ),
          ],
        ),
      ),
    );
  }
}
