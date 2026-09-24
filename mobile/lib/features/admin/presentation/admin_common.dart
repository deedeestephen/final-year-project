import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../app/theme/tokens.dart';
import '../../../core/network/api_exception.dart';

const roleLabels = {
  'PATIENT': 'Patient',
  'CLINICIAN': 'Clinician',
  'PATHOLOGIST': 'Pathologist / Radiologist',
  'ADMIN': 'Administrator',
};

/// Roles that must belong to a facility (they see that facility's patients).
const facilityRoles = {'CLINICIAN', 'PATHOLOGIST'};

/// Groups for the permission checklist, by code prefix.
const permissionGroups = {
  'patient': 'Patients',
  'clinical': 'Screening records',
  'consent': 'Consent',
  'imaging': 'Imaging',
  'histopathology': 'Histopathology',
  'ai': 'AI analysis',
  'report': 'Reports',
  'chatbot': 'Education assistant',
  'notification': 'Messages',
  'sync': 'Offline sync',
  'user': 'Accounts',
  'role': 'Accounts',
  'patient_account': 'Accounts',
  'facility': 'Facilities',
  'audit': 'Audit',
  'fhir': 'Data exchange',
};

String adminErrorMessage(Object e) {
  if (e is! ApiException) return 'Something went wrong. Please try again.';
  if (e.isNetwork) {
    return 'You are offline. Connect to the internet and try again.';
  }
  return e.message;
}

void showAdminError(BuildContext context, Object e) {
  (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(
    SnackBar(content: Text(adminErrorMessage(e))),
  );
}

/// Shows a one-time temporary password so it can be passed on securely.
Future<void> showTemporaryPassword(
  BuildContext context, {
  required String email,
  required String password,
}) => showDialog<void>(
  context: context,
  builder: (context) => AlertDialog(
    title: const Text('Temporary password'),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('For $email. It is shown only once.'),
        const SizedBox(height: AppSizes.md),
        SelectableText(
          password,
          key: const Key('admin.tempPassword'),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: AppSizes.md),
        const Text(
          'Give it to the person privately (not by group chat or email). '
          'They must choose their own password when they sign in.',
        ),
      ],
    ),
    actions: [
      TextButton(
        onPressed: () => Clipboard.setData(ClipboardData(text: password)),
        child: const Text('Copy'),
      ),
      TextButton(
        key: const Key('admin.tempPassword.done'),
        onPressed: () => Navigator.pop(context),
        child: const Text('Done'),
      ),
    ],
  ),
);

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (fg, bg, label) = switch (status) {
      'ACTIVE' => (AppColors.successText, AppColors.successBg, 'Active'),
      'LOCKED' => (AppColors.warningText, AppColors.warningBg, 'Locked'),
      _ => (AppColors.danger, AppColors.dangerBg, 'Disabled'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: const BorderRadius.all(AppRadii.chip),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(color: fg),
      ),
    );
  }
}
