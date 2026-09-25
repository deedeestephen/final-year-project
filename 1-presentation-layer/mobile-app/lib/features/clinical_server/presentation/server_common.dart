import 'package:flutter/material.dart';

import '../../../app/theme/app_theme.dart';
import '../../../app/theme/tokens.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/clinical_card.dart';

/// Plain words for the server's error codes on these screens.
String friendlyError(Object error) {
  if (error is! ApiException) return 'Something went wrong. Please try again.';
  if (error.isNetwork) {
    return 'No connection. This needs the internet; try again when online.';
  }
  return switch (error.code) {
    'CONSENT_REQUIRED' =>
      'The patient has not consented to AI analysis. Record their consent first.',
    'CLINICAL_RECORD_REQUIRED' =>
      'Add a screening record (and let it sync) before asking for an analysis.',
    'AI_JOB_IN_PROGRESS' => 'An analysis for this patient is already running.',
    'AI_UNAVAILABLE' => 'AI analysis is switched off on the server right now.',
    'ALREADY_REVIEWED' => 'This slide has already been reviewed.',
    'RATE_LIMITED' => 'Too many requests. Please wait a moment and try again.',
    _ => error.message,
  };
}

/// Shown instead of a server feature while a patient exists only on this phone.
class NotSyncedYetCard extends StatelessWidget {
  const NotSyncedYetCard({super.key});

  @override
  Widget build(BuildContext context) {
    return ClinicalCard(
      severity: Severity.info,
      child: Text(
        'Consent, images and AI analysis become available after this patient '
        'has synced to the server.',
        style: Theme.of(context).textTheme.bodyMedium,
      ),
    );
  }
}

/// A label and a value in the clinical number font.
class LabelledValue extends StatelessWidget {
  const LabelledValue(
    this.label,
    this.value, {
    super.key,
    this.labelWidth = 120,
  });

  final String label;
  final String value;
  final double labelWidth;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: labelWidth,
            child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
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

String formatDate(DateTime d) {
  final local = d.toLocal();
  String two(int v) => v.toString().padLeft(2, '0');
  return '${local.year}-${two(local.month)}-${two(local.day)} '
      '${two(local.hour)}:${two(local.minute)}';
}

String formatBytes(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
  return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
}
