import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../app/theme/tokens.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../../shared/widgets/national_stripe.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../auth/application/session_controller.dart';
import '../application/patient_providers.dart';
import '../domain/patient_models.dart';
import 'patient_widgets.dart';

/// Shown instead of personal data until a clinic links the account.
class NotLinkedCard extends StatelessWidget {
  const NotLinkedCard({super.key, required this.email});

  final String email;

  static const text =
      'Your account is not linked to your clinic record yet. '
      'Ask your clinic to link it. Show them your account email:';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ClinicalCard(
      severity: Severity.info,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Almost ready', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSizes.xs),
          Text(text, style: theme.textTheme.bodyLarge),
          const SizedBox(height: AppSizes.xs),
          SelectableText(email, style: theme.textTheme.titleSmall),
        ],
      ),
    );
  }
}

class MyHomeScreen extends ConsumerWidget {
  const MyHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider);
    final user = session is SignedIn ? session.user : null;
    final profile = ref.watch(myProfileProvider);
    final theme = Theme.of(context);

    Future<void> refresh() async {
      ref.invalidate(myProfileProvider);
      ref.invalidate(myRecordsProvider);
      ref.invalidate(inboxProvider);
      try {
        await ref.read(myProfileProvider.future);
      } catch (_) {
        // The screen shows the error state.
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: Column(
        children: [
          const NationalStripe(height: 4),
          const OfflineBanner(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: refresh,
              child: ListView(
                padding: const EdgeInsets.all(AppSizes.md),
                children: [
                  Text(
                    'Hello, ${user?.displayName ?? ''}',
                    style: theme.textTheme.titleLarge,
                  ),
                  const SizedBox(height: AppSizes.md),
                  PatientLoad<Cached<PatientProfile?>>(
                    value: profile,
                    onRetry: () => ref.invalidate(myProfileProvider),
                    builder: (cached) => Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        OfflineStamp(cached: cached),
                        if (cached.value == null)
                          NotLinkedCard(email: user?.email ?? '')
                        else
                          const _LinkedCards(),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSizes.sm),
                  ClinicalCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Looking after yourself',
                          style: theme.textTheme.titleMedium,
                        ),
                        const SizedBox(height: AppSizes.xs),
                        Text(
                          'Keep your follow-up appointments. If you notice new '
                          'symptoms, contact your clinic.',
                          style: theme.textTheme.bodyLarge,
                        ),
                        const SizedBox(height: AppSizes.sm),
                        OutlinedButton.icon(
                          key: const Key('home.getHelp'),
                          onPressed: () =>
                              context.go(Routes.article('get-help')),
                          icon: const Icon(Icons.health_and_safety_outlined),
                          label: const Text('When to get help quickly'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSizes.lg),
                  Text('Coming later', style: theme.textTheme.titleMedium),
                  const SizedBox(height: AppSizes.sm),
                  for (final (title, icon) in const [
                    ('Symptom check', Icons.checklist_outlined),
                    ('Appointments and reminders', Icons.event_outlined),
                    ('Ask a question (assistant)', Icons.chat_outlined),
                  ]) ...[
                    ClinicalCard(
                      child: Row(
                        children: [
                          Icon(icon, color: AppColors.textSecondary),
                          const SizedBox(width: AppSizes.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(title, style: theme.textTheme.titleSmall),
                                Text(
                                  'Coming in build phase 13',
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
          ),
        ],
      ),
    );
  }
}

class _LinkedCards extends ConsumerWidget {
  const _LinkedCards();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final records = ref.watch(myRecordsProvider).value?.value;
    final unread = ref.watch(inboxProvider).value?.value.unreadCount;
    final latest = records == null || records.isEmpty ? null : records.first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClinicalCard(
          onTap: () => context.go(Routes.myResults),
          child: Row(
            children: [
              const Icon(Icons.assignment_outlined, color: AppColors.primary),
              const SizedBox(width: AppSizes.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('My results', style: theme.textTheme.titleMedium),
                    Text(
                      latest == null
                          ? 'No screening results yet.'
                          : 'Latest screening: ${latest.encounterDate}',
                      key: const Key('home.latest'),
                      style: theme.textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.textSecondary),
            ],
          ),
        ),
        const SizedBox(height: AppSizes.sm),
        ClinicalCard(
          onTap: () => context.go(Routes.messages),
          child: Row(
            children: [
              const Icon(Icons.mail_outline, color: AppColors.primary),
              const SizedBox(width: AppSizes.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Messages', style: theme.textTheme.titleMedium),
                    Text(
                      unread == null
                          ? 'Messages from your clinic'
                          : unread == 0
                          ? 'No unread messages'
                          : '$unread unread message${unread == 1 ? '' : 's'}',
                      key: const Key('home.unread'),
                      style: theme.textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.textSecondary),
            ],
          ),
        ),
      ],
    );
  }
}
