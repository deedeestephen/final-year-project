import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/tokens.dart';
import '../../../core/db/app_database.dart';
import '../../../core/db/local_store.dart';
import '../../../core/providers.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../shared/widgets/primary_button.dart';
import '../application/patient_providers.dart';
import 'clinical_formats.dart';
import 'form_widgets.dart';

/// Edits contact and area details. Only changed fields are sent, with the
/// version they were based on, so a clash with someone else's edit is caught.
class EditPatientScreen extends ConsumerWidget {
  const EditPatientScreen({super.key, required this.patientId});

  final String patientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final patient = ref.watch(patientProvider(patientId)).value;
    return Scaffold(
      appBar: AppBar(title: const Text('Edit details')),
      body: patient == null
          ? const Center(
              child: CircularProgressIndicator(semanticsLabel: 'Loading'),
            )
          : _EditForm(patient: patient),
    );
  }
}

class _EditForm extends ConsumerStatefulWidget {
  const _EditForm({required this.patient});

  final LocalPatient patient;

  @override
  ConsumerState<_EditForm> createState() => _EditFormState();
}

class _EditFormState extends ConsumerState<_EditForm> {
  final _form = GlobalKey<FormState>();
  late final _given = TextEditingController(text: widget.patient.givenName);
  late final _family = TextEditingController(text: widget.patient.familyName);
  late final _phone = TextEditingController(text: widget.patient.phone ?? '');
  late final _district = TextEditingController(
    text: widget.patient.district ?? '',
  );
  late String _region = widget.patient.regionClass;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_given, _family, _phone, _district]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _changed(TextEditingController c, String? original) {
    final v = c.text.trim();
    return v.isEmpty || v == (original ?? '') ? null : v;
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    final p = widget.patient;
    final changes = PatientChanges(
      givenName: _changed(_given, p.givenName),
      familyName: _changed(_family, p.familyName),
      phone: _changed(_phone, p.phone),
      district: _changed(_district, p.district),
      regionClass: _region == p.regionClass ? null : _region,
    );
    if (changes.isEmpty) {
      context.pop();
      return;
    }
    setState(() => _busy = true);
    await ref.read(localStoreProvider).updatePatient(p.id, changes);
    unawaited(ref.read(syncEngineProvider).sync());
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Changes saved on this device.')),
    );
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      // Not a lazy ListView: every field must stay built so the form
      // validates all of them, including those scrolled out of view.
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSizes.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SyntheticDataNotice(),
            TextFormField(
              key: const Key('edit.given'),
              controller: _given,
              decoration: const InputDecoration(labelText: 'First name'),
              validator: (v) => validateName(v, 'first name'),
            ),
            const SizedBox(height: AppSizes.md),
            TextFormField(
              key: const Key('edit.family'),
              controller: _family,
              decoration: const InputDecoration(labelText: 'Surname'),
              validator: (v) => validateName(v, 'surname'),
            ),
            const SizedBox(height: AppSizes.md),
            TextFormField(
              key: const Key('edit.phone'),
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone'),
              validator: validatePhone,
            ),
            const SizedBox(height: AppSizes.md),
            TextFormField(
              key: const Key('edit.district'),
              controller: _district,
              decoration: const InputDecoration(labelText: 'District'),
              validator: validateOptionalText,
            ),
            const SizedBox(height: AppSizes.md),
            LabelledDropdown(
              label: 'Area type',
              options: regionLabels,
              value: _region,
              onChanged: (v) => setState(() => _region = v ?? _region),
            ),
            const SizedBox(height: AppSizes.lg),
            PrimaryButton(
              key: const Key('edit.save'),
              label: 'Save changes',
              busy: _busy,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}
