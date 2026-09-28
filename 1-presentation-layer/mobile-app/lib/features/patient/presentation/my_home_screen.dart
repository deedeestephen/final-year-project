import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../app/theme/tokens.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../../shared/widgets/hero_header.dart';
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
      body: Column(
        children: [
          HeroHeader(
            title: 'Home',
            greeting: 'Hello, ${user?.displayName ?? ''}',
            subtitle: 'Your screening, your messages',
            name: user?.displayName,
          ),
          const OfflineBanner(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: refresh,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSizes.md,
                  AppSizes.md,
                  AppSizes.md,
                  AppSizes.lg,
                ),
                children: [
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
                  const SizedBox(height: AppSizes.sm + 4),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSizes.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const TintedIcon(
                                Icons.favorite_outline,
                                tone: AccentTone.teal,
                                size: 40,
                              ),
                              const SizedBox(width: AppSizes.sm + 4),
                              Expanded(
                                child: Text(
                                  'Looking after yourself',
                                  style: theme.textTheme.titleMedium,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSizes.sm),
                          Text(
                            'Keep your follow-up appointments. If you notice new '
                            'symptoms, contact your clinic.',
                            style: theme.textTheme.bodyLarge,
                          ),
                          const SizedBox(height: AppSizes.md - 4),
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
                  ),
                  // The assistant is planned in docs/chatbot-plan.md (Phase 13).
                  const SectionTitle('Coming later'),
                  for (final (title, icon) in const [
                    ('Symptom check', Icons.checklist_outlined),
                    ('Appointments and reminders', Icons.event_outlined),
                    ('Ask a question (assistant)', Icons.chat_outlined),
                  ]) ...[
                    ActionTile(
                      icon: icon,
                      title: title,
                      tone: AccentTone.grey,
                      badge: 'Coming in build phase 13',
                    ),
                    const SizedBox(height: AppSizes.sm + 4),
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
    final records = ref.watch(myRecordsProvider).value?.value;
    final unread = ref.watch(inboxProvider).value?.value.unreadCount;
    final latest = records == null || records.isEmpty ? null : records.first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ActionTile(
          icon: Icons.assignment_outlined,
          title: 'My results',
          description: latest == null
              ? 'No screening results yet.'
              : 'Latest screening: ${latest.encounterDate}',
          descriptionKey: const Key('home.latest'),
          onTap: () => context.go(Routes.myResults),
        ),
        const SizedBox(height: AppSizes.sm + 4),
        ActionTile(
          icon: Icons.mail_outline,
          title: 'Messages',
          tone: AccentTone.blue,
          description: unread == null
              ? 'Messages from your clinic'
              : unread == 0
              ? 'No unread messages'
              : '$unread unread message${unread == 1 ? '' : 's'}',
          descriptionKey: const Key('home.unread'),
          onTap: () => context.go(Routes.messages),
        ),
      ],
    );
  }
}
