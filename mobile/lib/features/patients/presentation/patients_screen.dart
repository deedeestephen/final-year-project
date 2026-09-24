import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
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

/// Patients stored on this device (works offline).
class PatientsScreen extends ConsumerStatefulWidget {
  const PatientsScreen({super.key});

  @override
  ConsumerState<PatientsScreen> createState() => _PatientsScreenState();
}

class _PatientsScreenState extends ConsumerState<PatientsScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionControllerProvider);
    final canEdit = session is SignedIn && session.user.canEditPatients;
    final patients = ref.watch(patientsProvider(_query));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Patients'),
        actions: const [DeviceSyncButton()],
      ),
      floatingActionButton: canEdit
          ? FloatingActionButton.extended(
              key: const Key('patients.register'),
              onPressed: () => context.push(Routes.newPatient),
              icon: const Icon(Icons.person_add_alt_1_outlined),
              label: const Text('Register patient'),
            )
          : null,
      body: Column(
        children: [
          const OfflineBanner(),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSizes.md,
              AppSizes.md,
              AppSizes.md,
              AppSizes.sm,
            ),
            child: TextField(
              key: const Key('patients.search'),
              decoration: const InputDecoration(
                labelText: 'Search by name or MRN',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          Expanded(
            child: AsyncStateView<List<LocalPatient>>(
              loading: patients.isLoading && !patients.hasValue,
              data: patients.value,
              error: patients.error,
              isEmpty: (list) => list.isEmpty,
              emptyMessage: _query.isEmpty
                  ? 'No patients on this device yet.'
                  : 'No patients match "$_query".',
              builder: (context, list) => ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                  AppSizes.md,
                  AppSizes.sm,
                  AppSizes.md,
                  96,
                ),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: AppSizes.sm),
                itemBuilder: (context, i) => _PatientTile(patient: list[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PatientTile extends StatelessWidget {
  const _PatientTile({required this.patient});

  final LocalPatient patient;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = patient;
    final severity = switch (p.syncState) {
      RowSync.rejected => Severity.danger,
      RowSync.conflict => Severity.warning,
      _ => Severity.none,
    };
    return ClinicalCard(
      severity: severity,
      onTap: () => context.push(Routes.patient(p.id)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${p.familyName}, ${p.givenName}',
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: 2),
                Text(
                  '${p.mrn ?? 'MRN after sync'} · '
                  '${ageInYears(p.dateOfBirth, DateTime.now())} yrs · '
                  '${regionLabels[p.regionClass] ?? p.regionClass}',
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSizes.sm),
          SyncStatusBadge(status: rowSyncStatus(p.syncState)),
        ],
      ),
    );
  }
}
