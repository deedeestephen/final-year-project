import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../app/routes.dart';
import '../../../app/theme/tokens.dart';
import '../../../core/db/app_database.dart';
import '../../../shared/widgets/hero_header.dart';
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
    final items = <(Key, IconData, AccentTone, String, String, String)>[
      if (isClinician)
        (
          const Key('patient.consents'),
          Symbols.verified_user_rounded,
          AccentTone.sky,
          'Consent',
          'Record or withdraw the patient\'s consent, including for AI analysis',
          Routes.consents(patient.id),
        ),
      (
        const Key('patient.imaging'),
        Symbols.image_rounded,
        AccentTone.blue,
        'Images and slides',
        'MRI, ultrasound and CT images; histopathology slides',
        Routes.imaging(patient.id),
      ),
      (
        const Key('patient.ai'),
        Symbols.analytics_rounded,
        AccentTone.purple,
        'AI analysis',
        'Ask for an analysis and read the report',
        Routes.analyses(patient.id),
      ),
    ];
    return Column(
      children: [
        for (final (key, icon, tone, title, description, route) in items) ...[
          ActionTile(
            key: key,
            icon: icon,
            tone: tone,
            title: title,
            description: description,
            onTap: () => context.push(route),
          ),
          const SizedBox(height: AppSizes.sm + 4),
        ],
      ],
    );
  }
}
