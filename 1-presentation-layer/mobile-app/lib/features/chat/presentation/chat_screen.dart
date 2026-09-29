import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../app/theme/tokens.dart';
import '../../../core/connectivity/connectivity_service.dart';
import '../../../shared/audio/read_aloud.dart';
import '../../../shared/widgets/assistant_avatar.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../auth/application/session_controller.dart';
import '../../auth/domain/current_user.dart';
import '../application/chat_controller.dart';
import '../data/chat_api.dart';
import 'chat_composer.dart';

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

/// The PCa Assistant (Phase 13) for patients and clinicians. Answers come
/// from reviewed documents, with their sources; it never diagnoses (ADR-009,
/// ADR-010). Questions can be typed or spoken, and answers read aloud
/// (ADR-012).
class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  late final ReadAloudController _reader;

  @override
  void initState() {
    super.initState();
    _reader = ref.read(readAloudControllerProvider.notifier);
  }

  @override
  void dispose() {
    // Leaving the chat stops an answer being read. Deferred: providers
    // cannot change while the widget tree is being torn down.
    Future.microtask(() => _reader.stop(prefix: 'chat:'));
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
      await _reader.stop(prefix: 'chat:');
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
    final canAsk = online && !state.sending;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            // On a white disc: the app bar is blue.
            const AssistantAvatar(size: 40, onBadge: true),
            const SizedBox(width: AppSizes.sm + 2),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      AssistantAvatar.name,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: p.onPrimary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    clinician
                        ? 'Answers from reviewed reference cards'
                        : 'Answers from reviewed health information',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: p.onPrimary,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            key: const Key('chat.menu'),
            tooltip: 'More',
            icon: const Icon(Symbols.more_vert_rounded),
            onSelected: (v) async {
              if (v == 'new') {
                await _reader.stop(prefix: 'chat:');
                await ref.read(chatControllerProvider.notifier).startOver();
              } else {
                await _delete();
              }
            },
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
                if (state.messages.isEmpty)
                  _Welcome(
                    clinician: clinician,
                    suggestions: suggestions,
                    onPick: canAsk ? _send : null,
                  ),
                _Intro(clinician: clinician),
                for (final (i, m) in state.messages.indexed)
                  Padding(
                    key: Key('chat.message.$i'),
                    padding: const EdgeInsets.only(top: AppSizes.sm + 4),
                    child: m.fromUser
                        ? _QuestionBubble(message: m)
                        : _FromAssistant(child: _AnswerCard(message: m)),
                  ),
                if (state.sending)
                  const Padding(
                    padding: EdgeInsets.only(top: AppSizes.sm + 4),
                    child: _FromAssistant(child: _Typing()),
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
          ChatComposer(controller: _input, enabled: canAsk, onSend: _send),
        ],
      ),
    );
  }
}

/// The empty chat: the bot says hello and offers questions to start with.
class _Welcome extends StatelessWidget {
  const _Welcome({
    required this.clinician,
    required this.suggestions,
    required this.onPick,
  });

  final bool clinician;
  final List<String> suggestions;
  final void Function(String)? onPick;

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    final theme = Theme.of(context);
    final pick = onPick;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.md),
      child: Column(
        children: [
          const SizedBox(height: AppSizes.sm),
          const AssistantAvatar(
            size: 96,
            animate: true,
            semanticLabel: AssistantAvatar.name,
          ),
          const SizedBox(height: AppSizes.md - 4),
          Container(
            key: const Key('chat.welcome'),
            padding: const EdgeInsets.all(AppSizes.md),
            decoration: BoxDecoration(
              color: p.surface,
              borderRadius: const BorderRadius.all(AppRadii.card),
              border: Border.all(color: p.border),
              boxShadow: [
                BoxShadow(
                  color: p.shadow,
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                Text(
                  clinician
                      ? 'Hello! I am the PCa Assistant.'
                      : 'Hi! I am the PCa Assistant.',
                  style: theme.textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSizes.xs),
                Text(
                  clinician
                      ? 'Ask me about the reference cards: PI-RADS, grade '
                            'groups, PSA density and more.'
                      : 'Ask me about prostate health, tests such as PSA, and '
                            'what happens at the clinic. Type, or tap the '
                            'microphone and speak.',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: p.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSizes.md),
          Text('Try asking', style: theme.textTheme.titleSmall),
          const SizedBox(height: AppSizes.sm),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: AppSizes.sm,
            runSpacing: AppSizes.sm,
            children: [
              for (final (i, s) in suggestions.indexed)
                ActionChip(
                  key: Key('chat.suggestion.$i'),
                  avatar: Icon(
                    Symbols.chat_bubble_rounded,
                    size: 18,
                    color: p.linkText,
                  ),
                  label: Text(s),
                  onPressed: pick == null ? null : () => pick(s),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// What the assistant can and cannot do, and what not to type. Stays at the
/// top of the conversation.
class _Intro extends StatelessWidget {
  const _Intro({required this.clinician});

  final bool clinician;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.colors;
    return Container(
      padding: const EdgeInsets.all(AppSizes.md - 4),
      decoration: BoxDecoration(
        color: p.surfaceMuted,
        borderRadius: const BorderRadius.all(AppRadii.control),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Symbols.shield_person_rounded, size: 22, color: p.linkText),
          const SizedBox(width: AppSizes.sm + 2),
          Expanded(
            child: Text(
              clinician
                  ? 'Answers come only from reviewed reference cards, with '
                        'their sources; an AI may help word them. They do not '
                        'replace clinical judgement or the local protocol. '
                        'Do not type patient names or numbers. $_voiceNote'
                  : 'Answers come only from reviewed health information, '
                        'with their sources; an AI may help word them. The '
                        'assistant cannot see your records and never tells '
                        'you what your results mean. Do not type your name, '
                        'NRC, phone number or results. Not for emergencies: '
                        'if you feel very unwell, go to a clinic or hospital '
                        'now. $_voiceNote',
              key: const Key('chat.intro'),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: p.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

const _voiceNote =
    'If you speak, your phone\'s speech service (for example Google\'s) '
    'turns your voice into text; the app only receives the text.';

/// An assistant message: the bot on the left, the content next to it.
class _FromAssistant extends StatelessWidget {
  const _FromAssistant({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 2),
          child: AssistantAvatar(size: 34),
        ),
        const SizedBox(width: AppSizes.sm),
        Expanded(child: child),
      ],
    );
  }
}

/// Three dots that rise in turn while the answer is on its way.
class _Typing extends StatefulWidget {
  const _Typing();

  @override
  State<_Typing> createState() => _TypingState();
}

class _TypingState extends State<_Typing> with SingleTickerProviderStateMixin {
  late final _dots = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      _dots.stop();
    } else if (!_dots.isAnimating) {
      _dots.repeat();
    }
  }

  @override
  void dispose() {
    _dots.dispose();
    super.dispose();
  }

  /// 0 to 1 and back for dot [i], a third of a cycle after the one before.
  static double _bounce(double t, int i) {
    final x = (t - i / 3) % 1;
    return x < 0.4 ? math.sin(x / 0.4 * math.pi) : 0;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    return Align(
      alignment: Alignment.centerLeft,
      child: Semantics(
        key: const Key('chat.typing'),
        liveRegion: true,
        label: 'Looking in the reviewed information',
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            color: p.surface,
            border: Border.all(color: p.border),
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(6),
              topRight: AppRadii.card,
              bottomLeft: AppRadii.card,
              bottomRight: AppRadii.card,
            ),
          ),
          child: AnimatedBuilder(
            animation: _dots,
            builder: (_, _) => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < 3; i++)
                  Transform.translate(
                    offset: Offset(0, -4 * _bounce(_dots.value, i)),
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: Color.lerp(
                          p.borderStrong,
                          p.primary,
                          _bounce(_dots.value, i),
                        ),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The person's question: a blue bubble on the right.
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
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [p.primary, p.primaryPressed],
            ),
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
              ).textTheme.bodyLarge?.copyWith(color: p.onPrimary),
            ),
          ),
        ),
      ),
    );
  }
}

class _AnswerCard extends ConsumerWidget {
  const _AnswerCard({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final p = context.colors;
    final (label, icon, fg, bg) = switch (message.safety) {
      ChatSafety.urgentCare => (
        'Urgent',
        Symbols.warning_rounded,
        p.danger,
        p.dangerBg,
      ),
      ChatSafety.declined => (
        'I cannot help with that',
        Symbols.info_rounded,
        p.infoText,
        p.infoBg,
      ),
      ChatSafety.noSource => (
        'No reviewed information',
        Symbols.help_rounded,
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
            if (message.writtenBy != null)
              Padding(
                key: Key('chat.writtenBy.${message.id}'),
                padding: const EdgeInsets.only(bottom: AppSizes.sm),
                child: Row(
                  children: [
                    Icon(
                      Symbols.auto_awesome_rounded,
                      size: 18,
                      color: p.textSecondary,
                    ),
                    const SizedBox(width: AppSizes.xs + 2),
                    Expanded(
                      child: Text(
                        'Written by AI (${_modelName(message.writtenBy!)}) '
                        'from the sources below',
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: p.textSecondary,
                        ),
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
                        Symbols.menu_book_rounded,
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
            const SizedBox(height: AppSizes.xs),
            _ListenToAnswer(
              id: 'chat:${message.id}',
              parts: [?label, message.text, ?message.disclaimer],
            ),
          ],
        ),
      ),
    );
  }
}

/// "Listen" reads the answer aloud (not the sources), for people who find
/// reading hard. Tapping again stops it.
class _ListenToAnswer extends ConsumerWidget {
  const _ListenToAnswer({required this.id, required this.parts});

  final String id;
  final List<String> parts;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reading = ref.watch(
      readAloudControllerProvider.select((s) => s.isReading(id)),
    );
    final reader = ref.read(readAloudControllerProvider.notifier);
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        key: Key('chat.listen.${id.substring(5)}'),
        onPressed: () => reading ? reader.stop() : reader.play(id, parts),
        icon: Icon(
          reading ? Symbols.stop_circle_rounded : Symbols.volume_up_rounded,
          fill: reading ? 1 : 0,
        ),
        label: Text(reading ? 'Stop reading' : 'Listen'),
      ),
    );
  }
}

/// "claude-haiku-4-5-20251001" -> "Claude"; other names are shown as they are.
String _modelName(String model) =>
    model.toLowerCase().startsWith('claude') ? 'Claude' : model;
