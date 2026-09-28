import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../app/theme/tokens.dart';
import '../../../shared/widgets/hero_header.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../domain/education.dart';

/// The education library. Works offline (bundled with the app).
class LearnScreen extends ConsumerWidget {
  const LearnScreen({super.key});

  static const pendingTranslation =
      'Bemba and Nyanja: translation awaiting human verification.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final library = ref.watch(educationLibraryProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Learn')),
      body: switch (library) {
        AsyncData(:final value) => ListView(
          padding: const EdgeInsets.all(AppSizes.md),
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
            const SizedBox(height: AppSizes.md),
            for (final a in value.articles) ...[
              ClinicalCard(
                onTap: () => context.go(Routes.article(a.id)),
                child: Row(
                  children: [
                    const TintedIcon(
                      Icons.menu_book_outlined,
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
                          Text(a.summary, style: theme.textTheme.bodyMedium),
                          const SizedBox(height: AppSizes.xs),
                          Text(
                            '${a.minutes} min read',
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.chevron_right,
                      color: context.colors.textSecondary,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSizes.sm),
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

class ArticleScreen extends ConsumerWidget {
  const ArticleScreen({super.key, required this.articleId});

  final String articleId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final library = ref.watch(educationLibraryProvider).value;
    final article = library?.byId(articleId);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(article?.title ?? 'Article')),
      body: library == null
          ? const Center(
              child: CircularProgressIndicator(semanticsLabel: 'Loading'),
            )
          : article == null
          ? const Center(child: Text('This article was not found.'))
          : ListView(
              padding: const EdgeInsets.all(AppSizes.md),
              children: [
                Text(article.summary, style: theme.textTheme.bodyLarge),
                for (final s in article.sections) ...[
                  const SizedBox(height: AppSizes.lg),
                  Text(s.heading, style: theme.textTheme.titleMedium),
                  const SizedBox(height: AppSizes.xs),
                  Text(s.body, style: theme.textTheme.bodyLarge),
                ],
                const SizedBox(height: AppSizes.lg),
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
                const SizedBox(height: AppSizes.md),
                Text(
                  'This is general information, not advice about your own health. '
                  'Talk to your clinician about your situation.',
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),
    );
  }
}
