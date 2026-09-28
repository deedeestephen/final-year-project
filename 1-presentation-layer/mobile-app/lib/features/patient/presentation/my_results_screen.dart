import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_theme.dart';
import '../../../app/theme/tokens.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../patients/presentation/clinical_formats.dart';
import '../application/patient_providers.dart';
import '../domain/patient_models.dart';
import 'patient_widgets.dart';

/// The patient's own screening values. By design there are no risk labels,
/// colours or advice: the clinician explains what the results mean.
class MyResultsScreen extends ConsumerWidget {
  const MyResultsScreen({super.key});

  static const note = 'Your clinician will explain what this means for you.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final records = ref.watch(myRecordsProvider);
    final profile = ref.watch(myProfileProvider).value;
    final notLinked = profile != null && profile.value == null;
    final theme = Theme.of(context);
    final value = clinicalValueStyle(
      size: 16,
      color: context.colors.textPrimary,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('My results')),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(myRecordsProvider.future),
              child: ListView(
                padding: const EdgeInsets.all(AppSizes.md),
                children: [
                  const InfoNote(
                    note,
                    icon: Icons.medical_information_outlined,
                  ),
                  const SizedBox(height: AppSizes.md),
                  if (notLinked)
                    Text(
                      'Your results will appear here once your clinic links your account.',
                      style: theme.textTheme.bodyLarge,
                    )
                  else
                    PatientLoad<Cached<List<ScreeningRecord>>>(
                      value: records,
                      onRetry: () => ref.invalidate(myRecordsProvider),
                      builder: (cached) => Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          OfflineStamp(cached: cached),
                          if (cached.value.isEmpty)
                            Text(
                              'No screening results yet.',
                              style: theme.textTheme.bodyLarge,
                            ),
                          for (final r in cached.value) ...[
                            ClinicalCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Visit on ${r.encounterDate}',
                                    style: theme.textTheme.titleMedium,
                                  ),
                                  const SizedBox(height: AppSizes.xs),
                                  if (r.psaNgMl != null)
                                    ValueRow(
                                      'PSA (blood test)',
                                      formatMeasurement(r.psaNgMl, 'ng/mL'),
                                      valueStyle: value,
                                    ),
                                  if (r.freePsaNgMl != null)
                                    ValueRow(
                                      'Free PSA',
                                      formatMeasurement(r.freePsaNgMl, 'ng/mL'),
                                      valueStyle: value,
                                    ),
                                  ValueRow(
                                    'Prostate exam (DRE)',
                                    dreLabels[r.dreFinding] ?? r.dreFinding,
                                  ),
                                  if (r.piradsScore != null)
                                    ValueRow(
                                      'MRI score (PI-RADS)',
                                      '${r.piradsScore}',
                                      valueStyle: value,
                                    ),
                                  if (r.prostateVolumeMl != null)
                                    ValueRow(
                                      'Prostate size',
                                      formatMeasurement(
                                        r.prostateVolumeMl,
                                        'mL',
                                      ),
                                      valueStyle: value,
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
            ),
          ),
        ],
      ),
    );
  }
}
