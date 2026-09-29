import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../app/routes.dart';
import '../../../app/theme/tokens.dart';
import '../../../shared/audio/read_aloud.dart';
import '../../../shared/widgets/assistant_avatar.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../../shared/widgets/hero_header.dart';
import '../../auth/application/session_controller.dart';
import '../domain/education.dart';

/// The education library. Works offline (bundled with the app). Every
/// article can be listened to, for people who cannot read (ADR-012).
class LearnScreen extends ConsumerWidget {
  const LearnScreen({super.key});

  static const pendingTranslation =
      'Bemba and Nyanja: translation awaiting human verification.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final library = ref.watch(educationLibraryProvider);
    final session = ref.watch(sessionControllerProvider);
    final canChat = session is SignedIn && session.user.canUseChat;
    final theme = Theme.of(context);
    final p = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Learn')),
      floatingActionButton: canChat ? const AssistantFab() : null,
      body: switch (library) {
        AsyncData(:final value) => ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.md,
            AppSizes.md,
            AppSizes.md,
            96,
          ),
          children: [
            Text('Language', style: theme.textTheme.titleSmall),
            const SizedBox(height: AppSizes.xs),
            Wrap(
              spacing: AppSizes.sm,
              children: [
                for (final lang in educationLanguages)
                  ChoiceChip(
                    key: Key('learn.lang.${lang.code}'),
                    label: Text(lang.label),
                    selected: lang.code == 'en',
                    onSelected: lang.available ? (_) {} : null,
                  ),
              ],
            ),
            const SizedBox(height: AppSizes.xs),
            Text(pendingTranslation, style: theme.textTheme.bodySmall),
            const SizedBox(height: AppSizes.md - 4),
            Row(
              children: [
                Icon(Symbols.headphones_rounded, color: p.linkText),
                const SizedBox(width: AppSizes.sm),
                Expanded(
                  child: Text(
                    'Tap Listen to hear any article read aloud.',
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSizes.md - 4),
            for (final a in value.articles) ...[
              ClinicalCard(
                onTap: () => context.go(Routes.article(a.id)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        const TintedIcon(
                          Symbols.menu_book_rounded,
                          tone: AccentTone.teal,
                          size: 44,
                        ),
                        const SizedBox(width: AppSizes.md - 4),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(a.title, style: theme.textTheme.titleMedium),
                              const SizedBox(height: 2),
                              Text(
                                a.summary,
                                style: theme.textTheme.bodyMedium,
                              ),
                              const SizedBox(height: AppSizes.xs),
                              Text(
                                '${a.minutes} min read',
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          Symbols.chevron_right_rounded,
                          color: p.textSecondary,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSizes.sm + 4),
                    // A big button with a play symbol, so the article can be
                    // started without reading the card.
                    FilledButton.icon(
                      key: Key('learn.listen.${a.id}'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AccentTone.blue.background(p),
                        foregroundColor: AccentTone.blue.foreground(p),
                      ),
                      onPressed: () =>
                          context.go('${Routes.article(a.id)}?listen=1'),
                      icon: const Icon(Symbols.play_arrow_rounded, fill: 1),
                      // Screen readers hear which article it plays.
                      label: Text(
                        'Listen',
                        semanticsLabel: 'Listen to ${a.title}',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSizes.sm + 4),
            ],
            const SizedBox(height: AppSizes.sm),
            Text(value.reviewStatus, style: theme.textTheme.bodySmall),
          ],
        ),
        AsyncError() => const Center(
          child: Text('The library could not be opened.'),
        ),
        _ => const Center(
          child: CircularProgressIndicator(semanticsLabel: 'Loading'),
        ),
      },
    );
  }
}

/// One article, with an audio bar that reads it aloud part by part: the
/// title and summary, then each section, then the closing advice. The part
/// being read is highlighted and scrolled into view. Sources are not read.
class ArticleScreen extends ConsumerStatefulWidget {
  const ArticleScreen({
    super.key,
    required this.articleId,
    this.listen = false,
  });

  final String articleId;

  /// Start reading as soon as the article is open (the Listen button).
  final bool listen;

  static const closing =
      'This is general information, not advice about your own health. '
      'Talk to your clinician about your situation.';

  @override
  ConsumerState<ArticleScreen> createState() => _ArticleScreenState();
}

class _ArticleScreenState extends ConsumerState<ArticleScreen> {
  late final ReadAloudController _reader;
  final _partKeys = <int, GlobalKey>{};
  bool _started = false;

  String get _id => 'article:${widget.articleId}';

  @override
  void initState() {
    super.initState();
    _reader = ref.read(readAloudControllerProvider.notifier);
  }

  @override
  void dispose() {
    // Closing the article stops it. Deferred: providers cannot change while
    // the widget tree is being torn down.
    final id = _id;
    Future.microtask(() => _reader.stop(prefix: id));
    super.dispose();
  }

  /// A heading followed by its text, with a pause between them when spoken.
  static String _spoken(String heading, String text) =>
      RegExp(r'[.!?:]$').hasMatch(heading)
      ? '$heading $text'
      : '$heading. $text';

  static List<String> _parts(Article a) => [
    _spoken(a.title, a.summary),
    for (final s in a.sections) _spoken(s.heading, s.body),
    ArticleScreen.closing,
  ];

  GlobalKey _keyFor(int part) => _partKeys[part] ??= GlobalKey();

  @override
  Widget build(BuildContext context) {
    final library = ref.watch(educationLibraryProvider).value;
    final article = library?.byId(widget.articleId);
    final reading = ref.watch(readAloudControllerProvider);
    final theme = Theme.of(context);

    ref.listen(readAloudControllerProvider, (before, now) {
      if (now.id != _id || now.part == before?.part) return;
      final target = _partKeys[now.part]?.currentContext;
      if (target != null) {
        Scrollable.ensureVisible(
          target,
          duration: const Duration(milliseconds: 300),
          alignment: 0.1,
        );
      }
    });

    if (article != null && widget.listen && !_started) {
      _started = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _reader.play(_id, _parts(article));
      });
    }

    final active = reading.isActive(_id);
    Widget part(int i, Widget child) => _ReadingPart(
      key: _keyFor(i),
      highlighted: active && reading.part == i,
      child: child,
    );

    return Scaffold(
      appBar: AppBar(title: Text(article?.title ?? 'Article')),
      // Pinned to the bottom, so Pause and Stop stay in reach while the
      // article scrolls to the part being read.
      bottomNavigationBar: article == null
          ? null
          : _ListenBar(
              state: reading,
              id: _id,
              onPlay: () => active && reading.paused
                  ? _reader.resume()
                  : _reader.play(_id, _parts(article)),
              onPause: _reader.pause,
              onStop: _reader.stop,
              onSlow: _reader.setSlow,
            ),
      body: library == null
          ? const Center(
              child: CircularProgressIndicator(semanticsLabel: 'Loading'),
            )
          : article == null
          ? const Center(child: Text('This article was not found.'))
          : ListView(
              padding: const EdgeInsets.all(AppSizes.md),
              children: [
                part(
                  0,
                  Text(article.summary, style: theme.textTheme.bodyLarge),
                ),
                for (final (i, s) in article.sections.indexed) ...[
                  const SizedBox(height: AppSizes.sm),
                  part(
                    i + 1,
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(s.heading, style: theme.textTheme.titleMedium),
                        const SizedBox(height: AppSizes.xs),
                        Text(s.body, style: theme.textTheme.bodyLarge),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: AppSizes.sm),
                part(
                  article.sections.length + 1,
                  Text(
                    ArticleScreen.closing,
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
                const SizedBox(height: AppSizes.md),
                const Divider(),
                Text('Sources', style: theme.textTheme.titleSmall),
                for (final src in article.sources)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSizes.xs),
                    child: SelectableText(
                      '${src.name}\n${src.url}',
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
                const SizedBox(height: AppSizes.md),
                Text(library.reviewStatus, style: theme.textTheme.bodySmall),
              ],
            ),
    );
  }
}

/// A block of the article; tinted, with a blue edge, while it is read.
class _ReadingPart extends StatelessWidget {
  const _ReadingPart({
    super.key,
    required this.highlighted,
    required this.child,
  });

  final bool highlighted;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
      decoration: BoxDecoration(
        color: highlighted ? AccentTone.blue.background(p) : null,
        borderRadius: const BorderRadius.all(AppRadii.control),
        border: Border(
          left: BorderSide(
            color: highlighted ? p.primary : Colors.transparent,
            width: 4,
          ),
        ),
      ),
      child: Semantics(
        // Tells screen reader users which part is being read.
        value: highlighted ? 'Being read aloud' : null,
        child: child,
      ),
    );
  }
}

/// Listen / Pause / Resume, Stop, and a slower voice, at the bottom of the
/// article like a media player.
class _ListenBar extends StatelessWidget {
  const _ListenBar({
    required this.state,
    required this.id,
    required this.onPlay,
    required this.onPause,
    required this.onStop,
    required this.onSlow,
  });

  final ReadAloudState state;
  final String id;
  final VoidCallback onPlay;
  final VoidCallback onPause;
  final VoidCallback onStop;
  final ValueChanged<bool> onSlow;

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    final theme = Theme.of(context);
    final active = state.isActive(id);
    final reading = state.isReading(id);
    return Container(
      key: const Key('article.listenBar'),
      decoration: BoxDecoration(
        color: p.surface,
        border: Border(top: BorderSide(color: p.border)),
        boxShadow: [
          BoxShadow(
            color: p.shadow,
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.md,
            AppSizes.sm + 4,
            AppSizes.md,
            AppSizes.sm,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      key: const Key('article.listen'),
                      onPressed: reading ? onPause : onPlay,
                      icon: Icon(
                        reading
                            ? Symbols.pause_rounded
                            : Symbols.play_arrow_rounded,
                        fill: 1,
                      ),
                      label: Text(
                        reading
                            ? 'Pause'
                            : active
                            ? 'Resume'
                            : 'Listen to this article',
                      ),
                    ),
                  ),
                  if (active) ...[
                    const SizedBox(width: AppSizes.sm),
                    IconButton.outlined(
                      key: const Key('article.stop'),
                      tooltip: 'Stop reading',
                      onPressed: onStop,
                      icon: const Icon(Symbols.stop_rounded, fill: 1),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: AppSizes.sm),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: AppSizes.sm,
                runSpacing: AppSizes.xs,
                children: [
                  FilterChip(
                    key: const Key('article.slow'),
                    avatar: Icon(
                      Symbols.speed_rounded,
                      size: 18,
                      color: p.linkText,
                    ),
                    label: const Text('Slower voice'),
                    selected: state.slow,
                    onSelected: onSlow,
                  ),
                  if (active)
                    Text(
                      'Part ${state.part + 1} of ${state.total}',
                      key: const Key('article.progress'),
                      style: theme.textTheme.bodySmall,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
