import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../app/routes.dart';
import '../../core/config/app_env.dart';
import '../../app/theme/tokens.dart';
import '../../core/providers.dart';
import '../../shared/widgets/assistant_avatar.dart';
import '../../shared/widgets/hero_header.dart';
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
    this.later = false,
    this.tone = AccentTone.blue,
  });
  final String title;
  final String description;
  final IconData icon;

  /// Tells the tiles apart; it has no clinical meaning.
  final AccentTone tone;

  /// The build phase that delivers it; null when it is available now.
  final int? phase;
  final String? route;

  /// Planned, but not scheduled in a build phase yet.
  final bool later;

  bool get available => phase == null && !later;

  String? get badge => phase != null
      ? 'Coming in build phase $phase'
      : later
      ? 'Planned for a later version'
      : null;
}

/// Staff homes. Patients have their own tabbed app (features/patient).
const roleDestinations = <UserRole, List<HomeDestination>>{
  UserRole.clinician: [
    HomeDestination(
      'Patients',
      'Register and find patients, also offline',
      Symbols.group_rounded,
      route: Routes.patients,
    ),
    HomeDestination(
      'New screening',
      'Choose a patient, then add PSA, DRE and PI-RADS',
      Symbols.add_task_rounded,
      route: Routes.patients,
      tone: AccentTone.blue,
    ),
    HomeDestination(
      'AI results to review',
      'Recent AI analyses in your facility (decision support only)',
      Symbols.fact_check_rounded,
      route: Routes.aiResults,
      tone: AccentTone.purple,
    ),
    // The assistant (Phase 13, docs/chatbot-plan.md).
    HomeDestination(
      'Ask the assistant',
      'Reference cards with their sources: PI-RADS, grade groups, PSA density',
      Symbols.chat_rounded,
      route: Routes.chat,
      tone: AccentTone.teal,
    ),
    HomeDestination(
      'Referrals',
      'Referrals and follow-up',
      Symbols.send_rounded,
      later: true,
      tone: AccentTone.orange,
    ),
  ],
  UserRole.pathologist: [
    HomeDestination(
      'Review queue',
      'Slides waiting for your Gleason review',
      Symbols.inbox_rounded,
      route: Routes.review,
      tone: AccentTone.purple,
    ),
    HomeDestination(
      'Patients',
      'Open a patient to see or add images and slides',
      Symbols.group_rounded,
      route: Routes.patients,
    ),
    HomeDestination(
      'AI results',
      'Recent AI analyses in your facility (decision support only)',
      Symbols.description_rounded,
      route: Routes.aiResults,
      tone: AccentTone.blue,
    ),
  ],
  UserRole.admin: [
    HomeDestination(
      'Administration is on the web',
      'Manage users, roles and permissions, and patient accounts in the '
          'PCa mHealth admin portal on a computer (${AppEnv.adminPortalUrl}).',
      Symbols.computer_rounded,
      tone: AccentTone.blue,
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
    final destinations = roleDestinations[role]!;
    final now = destinations.where((d) => d.available).toList();
    final upcoming = destinations.where((d) => !d.available).toList();

    Widget tile(HomeDestination d) => Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.sm + 4),
      child: ActionTile(
        icon: d.icon,
        leading: d.route == Routes.chat && d.available
            ? const AssistantAvatar(size: 52)
            : null,
        title: d.title,
        description: d.description,
        tone: d.available ? d.tone : AccentTone.grey,
        badge: d.badge,
        onTap: d.route == null ? null : () => context.push(d.route!),
      ),
    );

    return Scaffold(
      drawer: _HomeDrawer(user: user, current: role),
      floatingActionButton: now.any((d) => d.route == Routes.chat)
          ? const AssistantFab()
          : null,
      body: Column(
        children: [
          HeroHeader(
            title: role.label,
            greeting: 'Welcome, ${user.displayName}',
            subtitle: user.email,
            name: user.displayName,
            leading: DrawerButton(
              style: IconButton.styleFrom(
                foregroundColor: context.colors.onPrimary,
              ),
            ),
            actions: [if (user.canSync) const DeviceSyncButton()],
          ),
          const OfflineBanner(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSizes.md,
                AppSizes.sm,
                AppSizes.md,
                96,
              ),
              children: [
                if (now.isNotEmpty) const SectionTitle('Your work'),
                for (final d in now) tile(d),
                if (upcoming.isNotEmpty) const SectionTitle('Coming later'),
                for (final d in upcoming) tile(d),
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
              child: Row(
                children: [
                  InitialsAvatar(name: user.displayName),
                  const SizedBox(width: AppSizes.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.displayName,
                          style: theme.textTheme.titleMedium,
                        ),
                        Text(user.email, style: theme.textTheme.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(),
            if (roles.length > 1)
              for (final r in roles)
                ListTile(
                  leading: const Icon(Symbols.swap_horiz_rounded),
                  title: Text(r.label),
                  selected: r == current,
                  onTap: () {
                    Navigator.of(context).pop();
                    context.go(Routes.home(r));
                  },
                ),
            if (user.canSync)
              ListTile(
                leading: const Icon(Symbols.sync_rounded),
                title: const Text('Sync'),
                onTap: () {
                  Navigator.of(context).pop();
                  context.push(Routes.sync);
                },
              ),
            ListTile(
              key: const Key('home.settings'),
              leading: const Icon(Symbols.settings_rounded),
              title: const Text('Settings'),
              onTap: () {
                Navigator.of(context).pop();
                context.push(Routes.settings);
              },
            ),
            const Spacer(),
            const Divider(),
            ListTile(
              key: const Key('home.signOut'),
              leading: const Icon(Symbols.logout_rounded),
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
