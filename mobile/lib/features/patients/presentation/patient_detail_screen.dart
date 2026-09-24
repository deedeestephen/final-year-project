import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../app/theme/app_theme.dart';
import '../../../app/theme/tokens.dart';
import '../../../core/db/app_database.dart';
import '../../../shared/widgets/async_state_view.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../../shared/widgets/sync_status_badge.dart';
import '../../auth/application/session_controller.dart';
import '../../sync/device_sync_button.dart';
import '../application/patient_providers.dart';
import 'clinical_formats.dart';

class PatientDetailScreen extends ConsumerWidget {
  const PatientDetailScreen({super.key, required this.patientId});

  final String patientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final patient = ref.watch(patientProvider(patientId));
    final records = ref.watch(recordsProvider(patientId));
    final session = ref.watch(sessionControllerProvider);
    final canEdit = session is SignedIn && session.user.canEditPatients;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Patient'),
        actions: const [DeviceSyncButton()],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: AsyncStateView<LocalPatient?>(
              loading: patient.isLoading && !patient.hasValue,
              data: patient.value,
              error: patient.error,
              builder: (context, p) => p == null
                  ? const Center(
                      child: Text('This patient is not on this device.'),
                    )
                  : ListView(
                      padding: const EdgeInsets.all(AppSizes.md),
                      children: [
                        _Header(patient: p),
                        const SizedBox(height: AppSizes.md),
                        if (canEdit) ...[
                          FilledButton.icon(
                            key: const Key('patient.addRecord'),
                            onPressed: () =>
                                context.push(Routes.newRecord(p.id)),
                            icon: const Icon(Icons.add),
                            label: const Text('Add screening record'),
                          ),
                          const SizedBox(height: AppSizes.sm),
                          OutlinedButton.icon(
                            key: const Key('patient.edit'),
                            onPressed: p.serverId == null
                                ? null
                                : () => context.push(Routes.editPatient(p.id)),
                            icon: const Icon(Icons.edit_outlined),
                            label: const Text('Edit details'),
                          ),
                          if (p.serverId == null)
                            Padding(
                              padding: const EdgeInsets.only(top: AppSizes.xs),
                              child: Text(
                                'Details can be edited after this patient has synced.',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                        ],
                        const SizedBox(height: AppSizes.lg),
                        Text(
                          'Screening records',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: AppSizes.sm),
                        ..._records(context, records.value ?? const []),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _records(BuildContext context, List<LocalClinicalRecord> list) {
    if (list.isEmpty) {
      return [
        Text(
          'No screening records yet.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ];
    }
    return [
      for (final r in list) ...[
        ClinicalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      r.encounterDate,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                  SyncStatusBadge(status: rowSyncStatus(r.syncState)),
                ],
              ),
              const SizedBox(height: AppSizes.xs),
              _Value('PSA', formatMeasurement(r.psaNgMl, 'ng/mL')),
              if (r.freePsaNgMl != null)
                _Value('Free PSA', formatMeasurement(r.freePsaNgMl, 'ng/mL')),
              _Value('DRE', dreLabels[r.dreFinding] ?? r.dreFinding),
              if (r.piradsScore != null) _Value('PI-RADS', '${r.piradsScore}'),
              if (r.prostateVolumeMl != null)
                _Value('Volume', formatMeasurement(r.prostateVolumeMl, 'mL')),
              if (r.notes != null) ...[
                const SizedBox(height: AppSizes.xs),
                Text(r.notes!, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSizes.sm),
      ],
    ];
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.patient});

  final LocalPatient patient;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = patient;
    return ClinicalCard(
      severity: p.syncState == RowSync.rejected
          ? Severity.danger
          : p.syncState == RowSync.conflict
          ? Severity.warning
          : Severity.none,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${p.givenName} ${p.familyName}',
                  style: theme.textTheme.titleLarge,
                ),
              ),
              SyncStatusBadge(status: rowSyncStatus(p.syncState)),
            ],
          ),
          const SizedBox(height: AppSizes.sm),
          _Value('MRN', p.mrn ?? 'Assigned after sync'),
          _Value(
            'Born',
            '${p.dateOfBirth} (${ageInYears(p.dateOfBirth, DateTime.now())} yrs)',
          ),
          _Value(
            'Area',
            [
              regionLabels[p.regionClass] ?? p.regionClass,
              ?p.district,
            ].join(' · '),
          ),
          if (p.phone != null) _Value('Phone', p.phone!),
          if (p.nationalIdMasked != null) _Value('NRC', p.nationalIdMasked!),
        ],
      ),
    );
  }
}

class _Value extends StatelessWidget {
  const _Value(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(label, style: theme.textTheme.bodyMedium),
          ),
          Expanded(
            child: Text(
              value,
              style: clinicalValueStyle(color: AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}
