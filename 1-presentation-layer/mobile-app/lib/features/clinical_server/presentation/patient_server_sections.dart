import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../app/theme/tokens.dart';
import '../../../core/db/app_database.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../auth/application/session_controller.dart';
import 'server_common.dart';

/// The patient page's links to the server features (Phase 9): consent,
/// images and slides, and AI analysis.
class PatientServerSections extends ConsumerWidget {
  const PatientServerSections({super.key, required this.patient});

  final LocalPatient patient;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (patient.serverId == null) return const NotSyncedYetCard();
    final session = ref.watch(sessionControllerProvider);
    final isClinician = session is SignedIn && session.user.canEditPatients;
    final items = <(Key, IconData, String, String, String)>[
      if (isClinician)
        (
          const Key('patient.consents'),
          Icons.verified_user_outlined,
          'Consent',
          'Record or withdraw the patient\'s consent, including for AI analysis',
          Routes.consents(patient.id),
        ),
      (
        const Key('patient.imaging'),
        Icons.image_outlined,
        'Images and slides',
        'MRI, ultrasound and CT images; histopathology slides',
        Routes.imaging(patient.id),
      ),
      (
        const Key('patient.ai'),
        Icons.analytics_outlined,
        'AI analysis',
        'Ask for an analysis and read the report',
        Routes.analyses(patient.id),
      ),
    ];
    final theme = Theme.of(context);
    return Column(
      children: [
        for (final (key, icon, title, description, route) in items) ...[
          ClinicalCard(
            key: key,
            onTap: () => context.push(route),
            child: Row(
              children: [
                Icon(icon, color: AppColors.primary),
                const SizedBox(width: AppSizes.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: theme.textTheme.titleMedium),
                      const SizedBox(height: 2),
                      Text(description, style: theme.textTheme.bodyMedium),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppColors.textSecondary),
              ],
            ),
          ),
          const SizedBox(height: AppSizes.sm),
        ],
      ],
    );
  }
}
