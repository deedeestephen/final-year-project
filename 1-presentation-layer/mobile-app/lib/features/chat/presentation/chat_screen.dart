import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/tokens.dart';
import '../../../core/connectivity/connectivity_service.dart';
import '../../../shared/widgets/hero_header.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../auth/application/session_controller.dart';
import '../../auth/domain/current_user.dart';
import '../application/chat_controller.dart';
import '../data/chat_api.dart';

const _patientSuggestions = [
  'What does a PSA test measure?',
  'What happens during a DRE?',
  'When should I get help quickly?',
];
const _clinicianSuggestions = [
  'What does PI-RADS 4 mean?',
  'How do Gleason scores map to grade groups?',
  'How is PSA density calculated?',
];

/// The assistant (Phase 13): patients ("Ask a question") and clinicians
/// ("Ask the assistant"). Answers are quoted from reviewed documents, with
/// their sources; it never diagnoses (ADR-009).
class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send([String? text]) async {
    final question = (text ?? _input.text).trim();
    if (question.isEmpty) return;
    if (text == null) _input.clear();
    await ref.read(chatControllerProvider.notifier).ask(question);
    if (ref.read(chatControllerProvider).error != null && text == null) {
      // Keep the question so it can be sent again.
      _input.text = question;
    }
    await WidgetsBinding.instance.endOfFrame;
    if (_scroll.hasClients) {
      await _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete this conversation?'),
        content: const Text(
          'It is removed from the server. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            key: const Key('chat.delete.confirm'),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(chatControllerProvider.notifier).startOver(delete: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionControllerProvider);
    final clinician =
        session is SignedIn && session.user.roles.contains(UserRole.clinician);
    final state = ref.watch(chatControllerProvider);
    final online = ref.watch(onlineProvider).value ?? true;
    final theme = Theme.of(context);
    final p = context.colors;
    final suggestions = clinician ? _clinicianSuggestions : _patientSuggestions;

    return Scaffold(
      appBar: AppBar(
        title: Text(clinician ? 'Ask the assistant' : 'Ask a question'),
        actions: [
          PopupMenuButton<String>(
            key: const Key('chat.menu'),
            tooltip: 'More',
            onSelected: (v) => v == 'new'
                ? ref.read(chatControllerProvider.notifier).startOver()
                : _delete(),
            itemBuilder: (_) => [
              const PopupMenuItem(
                key: Key('chat.new'),
                value: 'new',
                child: Text('New conversation'),
              ),
              if (state.conversationId != null)
                const PopupMenuItem(
                  key: Key('chat.delete'),
                  value: 'delete',
                  child: Text('Delete conversation'),
                ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: ListView(
              controller: _scroll,
              padding: const EdgeInsets.all(AppSizes.md),
              children: [
                _Intro(clinician: clinician),
                if (state.messages.isEmpty) ...[
                  const SectionTitle('Try asking'),
                  Wrap(
                    spacing: AppSizes.sm,
                    runSpacing: AppSizes.sm,
                    children: [
                      for (final (i, s) in suggestions.indexed)
                        ActionChip(
                          key: Key('chat.suggestion.$i'),
                          label: Text(s),
                          onPressed: online && !state.sending
                              ? () => _send(s)
                              : null,
                        ),
                    ],
                  ),
                ],
                for (final (i, m) in state.messages.indexed)
                  Padding(
                    key: Key('chat.message.$i'),
                    padding: const EdgeInsets.only(top: AppSizes.sm + 4),
                    child: m.fromUser
                        ? _QuestionBubble(message: m)
                        : _AnswerCard(message: m),
                  ),
                if (state.sending)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSizes.md),
                    child: Row(
                      children: [
                        const SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        const SizedBox(width: AppSizes.sm + 4),
                        Text(
                          'Looking in the reviewed information…',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          if (state.error != null)
            Container(
              key: const Key('chat.error'),
              width: double.infinity,
              color: p.dangerBg,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSizes.md,
                vertical: AppSizes.sm,
              ),
              child: Text(
                state.error!,
                style: theme.textTheme.bodyMedium?.copyWith(color: p.danger),
              ),
            ),
          if (!online)
            Padding(
              key: const Key('chat.offline'),
              padding: const EdgeInsets.fromLTRB(
                AppSizes.md,
                AppSizes.sm,
                AppSizes.md,
                0,
              ),
              child: Text(
                'The assistant needs the internet. Your question can be sent '
                'when you are back online.',
                style: theme.textTheme.bodySmall,
              ),
            ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(AppSizes.sm + 4),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      key: const Key('chat.input'),
                      controller: _input,
                      maxLength: 1000,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: online ? (_) => _send() : null,
                      decoration: const InputDecoration(
                        hintText: 'Type your question',
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSizes.sm),
                  IconButton.filled(
                    key: const Key('chat.send'),
                    tooltip: 'Send',
                    onPressed: online && !state.sending ? () => _send() : null,
                    icon: const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Intro extends StatelessWidget {
  const _Intro({required this.clinician});

  final bool clinician;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSizes.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const TintedIcon(
              Icons.chat_outlined,
              tone: AccentTone.teal,
              size: 44,
            ),
            const SizedBox(width: AppSizes.md - 4),
            Expanded(
              child: Text(
                clinician
                    ? 'Answers are quoted from reviewed reference cards, with '
                          'their sources. They do not replace clinical judgement '
                          'or the local protocol.'
                    : 'Answers are quoted from reviewed health information, '
                          'with their sources. The assistant cannot see your '
                          'records and never tells you what your results mean. '
                          'Not for emergencies: if you feel very unwell, go to '
                          'a clinic or hospital now.',
                key: const Key('chat.intro'),
                style: theme.textTheme.bodyMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuestionBubble extends StatelessWidget {
  const _QuestionBubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    return Align(
      alignment: Alignment.centerRight,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.8,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: AccentTone.green.background(p),
            borderRadius: const BorderRadius.only(
              topLeft: AppRadii.card,
              topRight: AppRadii.card,
              bottomLeft: AppRadii.card,
              bottomRight: Radius.circular(6),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSizes.md,
              vertical: AppSizes.sm + 4,
            ),
            child: Text(
              message.text,
              style: Theme.of(
                context,
              ).textTheme.bodyLarge?.copyWith(color: p.textPrimary),
            ),
          ),
        ),
      ),
    );
  }
}

class _AnswerCard extends StatelessWidget {
  const _AnswerCard({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.colors;
    final (label, icon, fg, bg) = switch (message.safety) {
      ChatSafety.urgentCare => (
        'Urgent',
        Icons.warning_amber_rounded,
        p.danger,
        p.dangerBg,
      ),
      ChatSafety.declined => (
        'I cannot help with that',
        Icons.info_outline,
        p.infoText,
        p.infoBg,
      ),
      ChatSafety.noSource => (
        'No reviewed information',
        Icons.help_outline,
        p.textSecondary,
        p.surfaceMuted,
      ),
      ChatSafety.ok => (null, null, null, null),
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSizes.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (label != null)
              Container(
                margin: const EdgeInsets.only(bottom: AppSizes.sm),
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSizes.sm + 2,
                  vertical: AppSizes.xs,
                ),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: const BorderRadius.all(AppRadii.chip),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 18, color: fg),
                    const SizedBox(width: AppSizes.xs + 2),
                    Flexible(
                      child: Text(
                        label,
                        style: theme.textTheme.labelMedium?.copyWith(color: fg),
                      ),
                    ),
                  ],
                ),
              ),
            Text(message.text, style: theme.textTheme.bodyLarge),
            if (message.sources.isNotEmpty) ...[
              const SizedBox(height: AppSizes.sm + 4),
              Text(
                message.sources.length == 1 ? 'Source' : 'Sources',
                style: theme.textTheme.labelLarge,
              ),
              for (final s in message.sources)
                Padding(
                  padding: const EdgeInsets.only(top: AppSizes.xs),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.menu_book_outlined,
                        size: 18,
                        color: p.textSecondary,
                      ),
                      const SizedBox(width: AppSizes.sm),
                      Expanded(
                        child: SelectableText(
                          s.url.isEmpty ? s.name : '${s.name}\n${s.url}',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
            if (message.reviewStatus != null) ...[
              const SizedBox(height: AppSizes.sm),
              Text(
                'Content status: ${message.reviewStatus}',
                style: theme.textTheme.bodySmall,
              ),
            ],
            if (message.disclaimer != null) ...[
              const SizedBox(height: AppSizes.sm),
              Text(message.disclaimer!, style: theme.textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}
