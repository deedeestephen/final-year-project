import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/routes.dart';
import '../../../app/theme/tokens.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../auth/application/session_controller.dart';
import '../../patients/presentation/clinical_formats.dart';
import '../application/patient_providers.dart';
import '../domain/patient_models.dart';
import 'my_home_screen.dart';
import 'patient_widgets.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider);
    final user = session is SignedIn ? session.user : null;
    final profile = ref.watch(myProfileProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(AppSizes.md),
              children: [
                PatientLoad<Cached<PatientProfile?>>(
                  value: profile,
                  onRetry: () => ref.invalidate(myProfileProvider),
                  builder: (cached) {
                    final p = cached.value;
                    if (p == null) {
                      return NotLinkedCard(email: user?.email ?? '');
                    }
                    return ClinicalCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          OfflineStamp(cached: cached),
                          Text(
                            '${p.givenName} ${p.familyName}',
                            style: theme.textTheme.titleLarge,
                          ),
                          const SizedBox(height: AppSizes.sm),
                          ValueRow('Record number', p.mrn),
                          ValueRow('Date of birth', p.dateOfBirth),
                          ValueRow(
                            'Area',
                            [
                              regionLabels[p.regionClass] ?? p.regionClass,
                              ?p.district,
                            ].join(' · '),
                          ),
                          if (p.phone != null) ValueRow('Phone', p.phone!),
                          if (p.nationalIdMasked != null)
                            ValueRow('NRC', p.nationalIdMasked!),
                        ],
                      ),
                    );
                  },
                ),
                const SizedBox(height: AppSizes.sm),
                if (user != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: AppSizes.sm),
                    child: ValueRow('Account email', user.email),
                  ),
                const Divider(),
                ListTile(
                  key: const Key('profile.consents'),
                  leading: const Icon(Icons.verified_user_outlined),
                  title: const Text('My consents'),
                  subtitle: const Text('See or withdraw what you agreed to'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.go(Routes.myConsents),
                ),
                ListTile(
                  key: const Key('profile.reports'),
                  leading: const Icon(Icons.description_outlined),
                  title: const Text('My reports'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.go(Routes.myReports),
                ),
                ListTile(
                  key: const Key('profile.password'),
                  leading: const Icon(Icons.password_outlined),
                  title: const Text('Change password'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.go(Routes.myPassword),
                ),
                ListTile(
                  key: const Key('profile.settings'),
                  leading: const Icon(Icons.settings_outlined),
                  title: const Text('Settings'),
                  subtitle: const Text('Light or dark appearance'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push(Routes.settings),
                ),
                ListTile(
                  key: const Key('profile.signOut'),
                  leading: const Icon(Icons.logout),
                  title: const Text('Sign out'),
                  onTap: () =>
                      ref.read(sessionControllerProvider.notifier).signOut(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Plain-language names and what withdrawing means, for each consent type.
const consentTexts = <String, ({String name, String ifWithdrawn})>{
  'DATA_PROCESSING': (
    name: 'Using your health information for your care',
    ifWithdrawn:
        'Your clinic may no longer be able to keep your records in this app. '
        'Please talk to your clinic about what this means for you.',
  ),
  'AI_ANALYSIS': (
    name: 'AI-assisted analysis of your results',
    ifWithdrawn:
        'AI-assisted analysis will no longer be used for your care. '
        'Your clinician will still look after you.',
  ),
  'RESEARCH_USE': (
    name: 'Use of your anonymised information for research',
    ifWithdrawn: 'Your information will not be used in new research.',
  ),
  'EHR_SHARING': (
    name: 'Sharing with the national health record',
    ifWithdrawn:
        'Your records will no longer be shared with the national health record.',
  ),
};

class MyConsentsScreen extends ConsumerWidget {
  const MyConsentsScreen({super.key});

  Future<void> _withdraw(
    BuildContext context,
    WidgetRef ref,
    ConsentItem consent,
  ) async {
    final text = consentTexts[consent.type];
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Withdraw this consent?'),
        content: Text(
          '${text?.name ?? consent.type}\n\n'
          '${text?.ifWithdrawn ?? ''}\n\n'
          'You can always withdraw your consent. You do not need to give a reason.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            key: const Key('consent.confirmWithdraw'),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Withdraw'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    String message = 'Consent withdrawn.';
    try {
      await ref.read(patientRepositoryProvider).withdrawConsent(consent.id);
    } on ApiException catch (e) {
      message = e.isNetwork
          ? 'You are offline. Connect to the internet and try again.'
          : e.code == 'ALREADY_WITHDRAWN'
          ? 'This consent was already withdrawn.'
          : 'That did not work. Please try again.';
    }
    ref.invalidate(myConsentsProvider);
    ref.invalidate(inboxProvider);
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final consents = ref.watch(myConsentsProvider);
    final theme = Theme.of(context);
    final date = DateFormat('d MMM yyyy');
    return Scaffold(
      appBar: AppBar(title: const Text('My consents')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(myConsentsProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(AppSizes.md),
          children: [
            PatientLoad<Cached<List<ConsentItem>>>(
              value: consents,
              onRetry: () => ref.invalidate(myConsentsProvider),
              builder: (cached) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  OfflineStamp(cached: cached),
                  if (cached.value.isEmpty)
                    Text(
                      'No consents are recorded for you.',
                      style: theme.textTheme.bodyLarge,
                    ),
                  for (final c in cached.value) ...[
                    ClinicalCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            consentTexts[c.type]?.name ?? c.type,
                            style: theme.textTheme.titleMedium,
                          ),
                          const SizedBox(height: AppSizes.xs),
                          Text(
                            c.isActive
                                ? 'Given on ${date.format(c.grantedAt.toLocal())}'
                                : 'Withdrawn on ${date.format((c.withdrawnAt ?? c.grantedAt).toLocal())}',
                            style: theme.textTheme.bodyMedium,
                          ),
                          if (c.isActive && !cached.offline) ...[
                            const SizedBox(height: AppSizes.sm),
                            OutlinedButton(
                              key: Key('consent.withdraw.${c.id}'),
                              onPressed: () => _withdraw(context, ref, c),
                              child: const Text('Withdraw'),
                            ),
                          ],
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
      ),
    );
  }
}

class MyReportsScreen extends StatelessWidget {
  const MyReportsScreen({super.key});

  static const empty =
      'No reports yet. Reports your clinician releases to you will appear here.';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My reports')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSizes.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.description_outlined,
                size: 40,
                color: context.colors.textSecondary,
              ),
              const SizedBox(height: AppSizes.sm),
              Text(
                empty,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
