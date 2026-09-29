import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../app/routes.dart';
import '../../../app/theme/app_theme.dart';
import '../../../app/theme/tokens.dart';
import '../../../core/connectivity/connectivity_service.dart';
import '../../../shared/widgets/ai_disclaimer_banner.dart';
import '../../../shared/widgets/async_state_view.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../patients/application/patient_providers.dart';
import '../application/clinical_server_providers.dart';
import '../data/clinical_server_models.dart';
import 'server_common.dart';

/// How often and for how long a waiting analysis is checked while the
/// screen is open. Nothing is checked in the background.
const pollEvery = Duration(seconds: 3);
const pollFor = Duration(minutes: 2);

/// A patient's AI analyses: ask for a new one and open the reports.
class AnalysesScreen extends ConsumerStatefulWidget {
  const AnalysesScreen({super.key, required this.patientId});

  final String patientId; // local id

  @override
  ConsumerState<AnalysesScreen> createState() => _AnalysesScreenState();
}

class _AnalysesScreenState extends ConsumerState<AnalysesScreen> {
  Timer? _poll;
  DateTime? _pollUntil;
  // After the time limit, checking stays off until the user acts again.
  bool _gaveUp = false;
  bool _busy = false;

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  /// Re-reads the list every few seconds while a job is waiting or running.
  void _keepChecking(String serverId, {bool userAction = false}) {
    if (userAction) _gaveUp = false;
    if (_poll != null || _gaveUp) return;
    _pollUntil = DateTime.now().add(pollFor);
    _poll = Timer.periodic(pollEvery, (_) {
      if (!mounted || DateTime.now().isAfter(_pollUntil!)) {
        _poll?.cancel();
        _poll = null;
        _gaveUp = true;
        return;
      }
      ref.invalidate(analysesProvider(serverId));
    });
  }

  Future<void> _request(String serverId) async {
    setState(() => _busy = true);
    try {
      await ref.read(clinicalServerApiProvider).requestAnalysis(serverId);
      ref.invalidate(analysesProvider(serverId));
      _keepChecking(serverId, userAction: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(friendlyError(e))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final patient = ref.watch(patientProvider(widget.patientId)).value;
    final serverId = patient?.serverId;
    final theme = Theme.of(context);
    if (serverId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('AI analysis')),
        body: const Padding(
          padding: EdgeInsets.all(AppSizes.md),
          child: NotSyncedYetCard(),
        ),
      );
    }

    final online = ref.watch(onlineProvider).value ?? true;
    final consents = ref.watch(staffConsentsProvider(serverId));
    final records = ref.watch(recordsProvider(widget.patientId)).value ?? [];
    final hasConsent =
        consents.value?.any((c) => c.type == 'AI_ANALYSIS' && c.isActive) ??
        false;
    final hasRecord = records.any((r) => r.serverId != null);
    final jobs = ref.watch(analysesProvider(serverId));
    if (jobs.value?.any((j) => j.isActive) ?? false) _keepChecking(serverId);

    final reason = !online
        ? 'The phone is offline. AI analysis needs a connection.'
        : consents.isLoading
        ? null
        : !hasConsent
        ? 'The patient has not consented to AI analysis. Record it under Consent first.'
        : !hasRecord
        ? 'Add a screening record and let it sync first.'
        : null;
    final canRequest =
        online && hasConsent && hasRecord && !_busy && !consents.isLoading;

    return Scaffold(
      appBar: AppBar(title: const Text('AI analysis')),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(AppSizes.md),
              children: [
                Text(
                  'Decision support only. A clinician makes every decision.',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSizes.md),
                FilledButton.icon(
                  key: const Key('ai.request'),
                  onPressed: canRequest ? () => _request(serverId) : null,
                  icon: const Icon(Symbols.analytics_rounded),
                  label: Text(_busy ? 'Asking…' : 'Request AI analysis'),
                ),
                if (reason != null) ...[
                  const SizedBox(height: AppSizes.xs),
                  Text(
                    reason,
                    key: const Key('ai.disabledReason'),
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
                const SizedBox(height: AppSizes.lg),
                Text('Analyses', style: theme.textTheme.titleMedium),
                const SizedBox(height: AppSizes.sm),
                ...jobs.when(
                  data: (list) => list.isEmpty
                      ? [const Text('No analyses yet.')]
                      : [for (final j in list) AnalysisCard(job: j)],
                  loading: () => [const LinearProgressIndicator()],
                  error: (e, _) => [Text(friendlyError(e))],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// One analysis in a list; opens the report when it has one.
class AnalysisCard extends StatelessWidget {
  const AnalysisCard({super.key, required this.job, this.showPatient = false});

  final AiJob job;
  final bool showPatient;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final done = job.status == 'SUCCEEDED';
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.sm),
      child: ClinicalCard(
        key: Key('ai.job.${job.id}'),
        severity: job.status == 'FAILED' || job.status == 'TIMED_OUT'
            ? Severity.warning
            : Severity.none,
        onTap: done ? () => context.push(Routes.aiJob(job.id)) : null,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (showPatient && job.patientMrn != null)
                    Text(job.patientMrn!, style: theme.textTheme.titleSmall),
                  Text(
                    aiStatusLabels[job.status] ?? job.status,
                    style: theme.textTheme.titleSmall,
                  ),
                  Text(
                    formatDate(job.createdAt),
                    style: theme.textTheme.bodySmall,
                  ),
                  if (job.isActive) ...[
                    const SizedBox(height: AppSizes.xs),
                    const LinearProgressIndicator(),
                  ],
                  if (job.error != null)
                    Text(job.error!, style: theme.textTheme.bodyMedium),
                ],
              ),
            ),
            if (done)
              Icon(
                Symbols.chevron_right_rounded,
                color: context.colors.textSecondary,
              ),
          ],
        ),
      ),
    );
  }
}

/// Recent analyses in the user's facility ("AI results to review").
class RecentAnalysesScreen extends ConsumerWidget {
  const RecentAnalysesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobs = ref.watch(recentAnalysesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('AI results')),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: AsyncStateView<List<AiJob>>(
              loading: jobs.isLoading && !jobs.hasValue,
              data: jobs.value,
              error: jobs.error,
              onRetry: () => ref.invalidate(recentAnalysesProvider),
              isEmpty: (l) => l.isEmpty,
              emptyMessage: 'No AI analyses in your facility yet.',
              builder: (context, list) => RefreshIndicator(
                onRefresh: () async => ref.invalidate(recentAnalysesProvider),
                child: ListView(
                  padding: const EdgeInsets.all(AppSizes.md),
                  children: [
                    for (final j in list)
                      AnalysisCard(job: j, showPatient: true),
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

/// The report. The disclaimer comes first; values are shown plainly, with no
/// colours or words that suggest good or bad.
class AiReportScreen extends ConsumerWidget {
  const AiReportScreen({super.key, required this.jobId});

  final String jobId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final job = ref.watch(analysisProvider(jobId));
    return Scaffold(
      appBar: AppBar(title: const Text('AI report')),
      body: AsyncStateView<AiJob>(
        loading: job.isLoading && !job.hasValue,
        data: job.value,
        error: job.error,
        onRetry: () => ref.invalidate(analysisProvider(jobId)),
        builder: (context, j) {
          final report = j.report;
          if (report == null) {
            return Padding(
              padding: const EdgeInsets.all(AppSizes.md),
              child: Text(
                j.error ?? 'This analysis has no report yet.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            );
          }
          return _ReportView(report: report);
        },
      ),
    );
  }
}

class _ReportView extends StatelessWidget {
  const _ReportView({required this.report});

  final AiReport report;

  String _percent(double v) => '${(v * 100).toStringAsFixed(0)}%';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final r = report;
    return ListView(
      padding: const EdgeInsets.all(AppSizes.md),
      children: [
        AiDisclaimerBanner(
          key: const Key('ai.report.banner'),
          provenance: r.isMock
              ? AiProvenance.developmentMock
              : AiProvenance.researchModel,
        ),
        const SizedBox(height: AppSizes.md),
        ClinicalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Result', style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSizes.xs),
              LabelledValue(
                'Probability',
                r.pcaProbability == null
                    ? 'Not produced'
                    : _percent(r.pcaProbability!),
                labelWidth: 150,
              ),
              if (r.probabilityInterval != null)
                LabelledValue(
                  'Range',
                  '${_percent(r.probabilityInterval!.$1)} – '
                      '${_percent(r.probabilityInterval!.$2)}',
                  labelWidth: 150,
                ),
              LabelledValue(
                'Grade group',
                r.gleasonGradeGroup?.toString() ?? 'Not produced',
                labelWidth: 150,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSizes.sm),
        ClinicalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Parts of the AI used', style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSizes.xs),
              for (final m in r.modulesUsed)
                Text(
                  '• ${aiModuleLabels[m] ?? m}  (${r.modelVersions[m] ?? '?'})',
                  style: clinicalValueStyle(
                    size: 13,
                    color: context.colors.textPrimary,
                  ),
                ),
              if (r.inputNotes.isNotEmpty) ...[
                const SizedBox(height: AppSizes.sm),
                Text(
                  'Files not sent to the AI',
                  style: theme.textTheme.titleSmall,
                ),
                for (final note in r.inputNotes)
                  Text(
                    '• $note',
                    key: const Key('ai.report.inputNote'),
                    style: theme.textTheme.bodyMedium,
                  ),
              ],
              if (r.modulesSkipped.isNotEmpty) ...[
                const SizedBox(height: AppSizes.sm),
                Text('Not used', style: theme.textTheme.titleSmall),
                for (final s in r.modulesSkipped)
                  Text(
                    '• ${aiModuleLabels[s.module] ?? s.module}: ${s.reason}',
                    style: theme.textTheme.bodyMedium,
                  ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSizes.sm),
        ClinicalCard(
          key: const Key('ai.report.explanations'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Why (explanations)', style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSizes.xs),
              if (r.explanations.isEmpty)
                Text(
                  'No explanations were returned.',
                  style: theme.textTheme.bodyMedium,
                ),
              for (final e in r.explanations) _ExplanationTile(explanation: e),
            ],
          ),
        ),
        const SizedBox(height: AppSizes.sm),
        ClinicalCard(
          child: Text(
            'Accuracy figures: Evaluation data not yet available.',
            key: const Key('ai.report.evaluation'),
            style: theme.textTheme.bodyMedium,
          ),
        ),
      ],
    );
  }
}

class _ExplanationTile extends ConsumerWidget {
  const _ExplanationTile({required this.explanation});

  final AiExplanation explanation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final e = explanation;
    final title =
        '${explanationKindLabels[e.kind] ?? e.kind} · ${aiModuleLabels[e.module] ?? e.module}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSizes.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: theme.textTheme.titleSmall),
          if (!e.available)
            Text(
              e.unavailableReason ?? 'Not available.',
              style: theme.textTheme.bodyMedium,
            )
          else if (e.hasImage && e.id != null)
            FutureBuilder(
              future: ref
                  .read(clinicalServerApiProvider)
                  .explanationImage(e.id!),
              builder: (context, snap) => snap.hasData
                  ? Image.memory(snap.data!, semanticLabel: title)
                  : snap.hasError
                  ? Text(friendlyError(snap.error!))
                  : const LinearProgressIndicator(),
            )
          else if (e.values != null)
            for (final entry in e.values!.entries)
              Text(
                '${entry.key}: ${entry.value >= 0 ? '+' : ''}${entry.value.toStringAsFixed(2)}',
                style: clinicalValueStyle(
                  size: 13,
                  color: context.colors.textPrimary,
                ),
              ),
        ],
      ),
    );
  }
}
