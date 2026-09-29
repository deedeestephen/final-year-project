import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../app/theme/tokens.dart';
import '../../core/db/app_database.dart';
import '../../core/db/local_store.dart';
import '../../core/providers.dart';
import '../../core/sync/sync_engine.dart';
import '../../core/sync/sync_providers.dart';
import '../../shared/widgets/clinical_card.dart';
import '../../shared/widgets/offline_banner.dart';
import '../../shared/widgets/primary_button.dart';
import '../../shared/widgets/sync_status_badge.dart';
import '../patients/application/patient_providers.dart';

/// Shows what is waiting to be sent and lets the user deal with changes the
/// server refused and edits that clashed with someone else's.
class SyncScreen extends ConsumerWidget {
  const SyncScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final counts = ref.watch(syncCountsProvider).value ?? const SyncCounts();
    final activity =
        ref.watch(syncActivityProvider).value ?? const SyncActivity();
    final conflicts = ref.watch(conflictsProvider).value ?? const [];
    final rejected = ref.watch(rejectedChangesProvider).value ?? const [];
    final syncing = activity.phase == SyncPhase.syncing;

    return Scaffold(
      appBar: AppBar(title: const Text('Sync')),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(AppSizes.md),
              children: [
                ClinicalCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'This device',
                              style: theme.textTheme.titleMedium,
                            ),
                          ),
                          SyncStatusBadge(
                            status: ref.watch(deviceSyncStatusProvider),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSizes.sm),
                      Text(
                        counts.pending == 0
                            ? 'Everything saved here has been sent.'
                            : '${counts.pending} change${counts.pending == 1 ? '' : 's'} waiting to be sent.',
                        key: const Key('sync.pending'),
                        style: theme.textTheme.bodyLarge,
                      ),
                      const SizedBox(height: AppSizes.xs),
                      Text(
                        activity.lastSyncAt == null
                            ? 'Not synced yet in this session.'
                            : 'Last synced ${DateFormat('d MMM yyyy, HH:mm').format(activity.lastSyncAt!)}.',
                        style: theme.textTheme.bodyMedium,
                      ),
                      if (activity.phase == SyncPhase.offline ||
                          activity.phase == SyncPhase.failed) ...[
                        const SizedBox(height: AppSizes.xs),
                        Text(
                          activity.phase == SyncPhase.offline
                              ? 'Could not reach the server. It will try again automatically.'
                              : activity.lastError ??
                                    'Sync failed. It will try again.',
                          key: const Key('sync.error'),
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: context.colors.amberText,
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSizes.md),
                      PrimaryButton(
                        key: const Key('sync.now'),
                        label: 'Sync now',
                        icon: Symbols.sync_rounded,
                        busy: syncing,
                        onPressed: () =>
                            ref.read(syncEngineProvider).sync(force: true),
                      ),
                    ],
                  ),
                ),
                if (conflicts.isNotEmpty) ...[
                  const SizedBox(height: AppSizes.lg),
                  Text(
                    'Changed by someone else',
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSizes.xs),
                  Text(
                    'Another user saved a newer version of these patients. '
                    'Compare and choose which to keep.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: AppSizes.sm),
                  for (final c in conflicts) _ConflictCard(conflict: c),
                ],
                if (rejected.isNotEmpty) ...[
                  const SizedBox(height: AppSizes.lg),
                  Text(
                    'Not accepted by the server',
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSizes.sm),
                  for (final op in rejected) _RejectedCard(op: op),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

const _fieldLabels = {
  'givenName': 'First name',
  'familyName': 'Surname',
  'phone': 'Phone',
  'district': 'District',
  'regionClass': 'Area type',
};

class _ConflictCard extends ConsumerWidget {
  const _ConflictCard({required this.conflict});

  final SyncConflict conflict;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final mine = (jsonDecode(conflict.localChanges) as Map)
        .cast<String, Object?>();
    final server = (jsonDecode(conflict.serverCopy) as Map)
        .cast<String, Object?>();
    final store = ref.read(localStoreProvider);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.sm),
      child: ClinicalCard(
        severity: Severity.warning,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${server['givenName'] ?? ''} ${server['familyName'] ?? ''}',
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: AppSizes.sm),
            Table(
              columnWidths: const {
                0: FlexColumnWidth(1.1),
                1: FlexColumnWidth(),
                2: FlexColumnWidth(),
              },
              children: [
                TableRow(
                  children: [
                    const SizedBox.shrink(),
                    Text('Your change', style: theme.textTheme.labelLarge),
                    Text('On the server', style: theme.textTheme.labelLarge),
                  ],
                ),
                for (final key in mine.keys)
                  TableRow(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(
                          _fieldLabels[key] ?? key,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(
                          '${mine[key] ?? '—'}',
                          style: theme.textTheme.bodyLarge,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(
                          '${server[key] ?? '—'}',
                          style: theme.textTheme.bodyLarge,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: AppSizes.sm),
            Wrap(
              spacing: AppSizes.sm,
              runSpacing: AppSizes.sm,
              children: [
                FilledButton(
                  key: Key('conflict.mine.${conflict.id}'),
                  onPressed: () async {
                    await store.resolveKeepMine(conflict.id);
                    await ref.read(syncEngineProvider).sync(force: true);
                  },
                  child: const Text('Use my change'),
                ),
                OutlinedButton(
                  key: Key('conflict.server.${conflict.id}'),
                  onPressed: () => store.resolveKeepServer(conflict.id),
                  child: const Text('Keep server version'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RejectedCard extends ConsumerWidget {
  const _RejectedCard({required this.op});

  final OutboxData op;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final what = switch ((op.entityType, op.operation)) {
      (EntityType.patient, 'CREATE') => 'New patient',
      (EntityType.patient, _) => 'Patient details change',
      _ => 'Screening record',
    };
    final payload = (jsonDecode(op.payload) as Map).cast<String, Object?>();
    final name = [
      payload['givenName'],
      payload['familyName'],
    ].whereType<String>().join(' ');
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.sm),
      child: ClinicalCard(
        severity: Severity.danger,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              name.isEmpty ? what : '$what: $name',
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: AppSizes.xs),
            Text(
              op.lastErrorMessage ?? 'The server did not accept this change.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: context.colors.danger,
              ),
            ),
            const SizedBox(height: AppSizes.sm),
            OutlinedButton.icon(
              key: Key('rejected.discard.${op.seq}'),
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Discard this change?'),
                    content: Text(
                      op.operation == 'CREATE' &&
                              op.entityType == EntityType.patient
                          ? 'The patient and their unsent records will be removed from this device.'
                          : 'This change will be removed from this device.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Cancel'),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Discard'),
                      ),
                    ],
                  ),
                );
                if (ok == true) {
                  await ref.read(localStoreProvider).discardRejected(op.seq);
                }
              },
              icon: const Icon(Symbols.delete_rounded),
              label: const Text('Discard'),
            ),
          ],
        ),
      ),
    );
  }
}
