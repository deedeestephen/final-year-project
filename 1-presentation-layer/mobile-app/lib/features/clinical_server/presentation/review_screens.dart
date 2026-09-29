import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../app/routes.dart';
import '../../../app/theme/tokens.dart';
import '../../../shared/widgets/async_state_view.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../patients/presentation/form_widgets.dart';
import '../application/clinical_server_providers.dart';
import '../data/clinical_server_models.dart';
import 'server_common.dart';

/// Slides in the pathologist's facility waiting for a review, oldest first.
class ReviewQueueScreen extends ConsumerWidget {
  const ReviewQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queue = ref.watch(reviewQueueProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Review queue')),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: AsyncStateView<List<Specimen>>(
              loading: queue.isLoading && !queue.hasValue,
              data: queue.value,
              error: queue.error,
              onRetry: () => ref.invalidate(reviewQueueProvider),
              isEmpty: (l) => l.isEmpty,
              emptyMessage: 'No slides are waiting for review.',
              builder: (context, list) => RefreshIndicator(
                onRefresh: () async => ref.invalidate(reviewQueueProvider),
                child: ListView(
                  padding: const EdgeInsets.all(AppSizes.md),
                  children: [
                    for (final s in list) ...[
                      ClinicalCard(
                        key: Key('review.slide.${s.id}'),
                        onTap: () => context.push(Routes.reviewSlide(s.id)),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${s.format}${s.stain == null ? '' : ' · ${s.stain}'}',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleSmall,
                                  ),
                                  Text(
                                    'Added ${formatDate(s.createdAt)}',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                            Icon(
                              Symbols.chevron_right_rounded,
                              color: context.colors.textSecondary,
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
          ),
        ],
      ),
    );
  }
}

/// The pathologist records the two Gleason patterns; the server works out
/// the ISUP grade group.
class ReviewSlideScreen extends ConsumerStatefulWidget {
  const ReviewSlideScreen({super.key, required this.slideId});

  final String slideId;

  @override
  ConsumerState<ReviewSlideScreen> createState() => _ReviewSlideScreenState();
}

class _ReviewSlideScreenState extends ConsumerState<ReviewSlideScreen> {
  final _form = GlobalKey<FormState>();
  String? _primary;
  String? _secondary;
  bool _busy = false;
  String? _error;

  static const _patterns = {
    '3': 'Pattern 3',
    '4': 'Pattern 4',
    '5': 'Pattern 5',
  };

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(clinicalServerApiProvider)
          .review(
            widget.slideId,
            primary: int.parse(_primary!),
            secondary: int.parse(_secondary!),
          );
      ref
        ..invalidate(slideProvider(widget.slideId))
        ..invalidate(reviewQueueProvider);
    } catch (e) {
      setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final slide = ref.watch(slideProvider(widget.slideId));
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Slide review')),
      body: AsyncStateView<Specimen>(
        loading: slide.isLoading && !slide.hasValue,
        data: slide.value,
        error: slide.error,
        onRetry: () => ref.invalidate(slideProvider(widget.slideId)),
        builder: (context, s) => ListView(
          padding: const EdgeInsets.all(AppSizes.md),
          children: [
            ClinicalCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LabelledValue('Format', s.format),
                  if (s.stain != null) LabelledValue('Stain', s.stain!),
                  if (s.biopsyDate != null)
                    LabelledValue('Biopsy date', s.biopsyDate!),
                  LabelledValue('Added', formatDate(s.createdAt)),
                ],
              ),
            ),
            const SizedBox(height: AppSizes.md),
            if (s.isReviewed)
              ClinicalCard(
                key: const Key('review.result'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Reviewed', style: theme.textTheme.titleMedium),
                    LabelledValue(
                      'Gleason',
                      '${s.gleasonPrimary} + ${s.gleasonSecondary} = '
                          '${s.gleasonPrimary! + s.gleasonSecondary!}',
                    ),
                    LabelledValue('ISUP grade group', '${s.isupGradeGroup}'),
                    LabelledValue('Reviewed on', formatDate(s.reviewedAt!)),
                  ],
                ),
              )
            else
              Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    LabelledDropdown(
                      key: const Key('review.primary'),
                      label: 'Most common pattern (primary)',
                      options: _patterns,
                      value: _primary,
                      onChanged: (v) => setState(() => _primary = v),
                      validator: (v) =>
                          v == null ? 'Choose the primary pattern.' : null,
                    ),
                    const SizedBox(height: AppSizes.md),
                    LabelledDropdown(
                      key: const Key('review.secondary'),
                      label: 'Second most common pattern (secondary)',
                      options: _patterns,
                      value: _secondary,
                      onChanged: (v) => setState(() => _secondary = v),
                      validator: (v) =>
                          v == null ? 'Choose the secondary pattern.' : null,
                    ),
                    const SizedBox(height: AppSizes.sm),
                    Text(
                      'The ISUP grade group is worked out by the server from '
                      'these two patterns. A slide is reviewed once.',
                      style: theme.textTheme.bodySmall,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: AppSizes.sm),
                      Text(
                        _error!,
                        style: TextStyle(color: context.colors.danger),
                      ),
                    ],
                    const SizedBox(height: AppSizes.md),
                    FilledButton(
                      key: const Key('review.save'),
                      onPressed: _busy ? null : _save,
                      child: Text(_busy ? 'Saving…' : 'Save review'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
