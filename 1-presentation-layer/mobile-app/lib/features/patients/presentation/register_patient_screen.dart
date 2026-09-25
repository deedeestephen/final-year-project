import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../app/theme/tokens.dart';
import '../../../core/db/local_store.dart';
import '../../../core/providers.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../../shared/widgets/primary_button.dart';
import 'clinical_formats.dart';
import 'form_widgets.dart';

/// Registers a patient on the device; it is sent to the server when online.
class RegisterPatientScreen extends ConsumerStatefulWidget {
  const RegisterPatientScreen({super.key});

  @override
  ConsumerState<RegisterPatientScreen> createState() =>
      _RegisterPatientScreenState();
}

class _RegisterPatientScreenState extends ConsumerState<RegisterPatientScreen> {
  final _form = GlobalKey<FormState>();
  final _given = TextEditingController();
  final _family = TextEditingController();
  final _dob = TextEditingController();
  final _district = TextEditingController();
  final _phone = TextEditingController();
  final _nrc = TextEditingController();
  String? _region;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_given, _family, _dob, _district, _phone, _nrc]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    final patient = await ref
        .read(localStoreProvider)
        .registerPatient(
          PatientDraft(
            givenName: _given.text,
            familyName: _family.text,
            dateOfBirth: _dob.text.trim(),
            regionClass: _region!,
            district: _district.text,
            phone: _phone.text,
            nationalId: _nrc.text,
          ),
        );
    unawaited(ref.read(syncEngineProvider).sync());
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Patient saved on this device.')),
    );
    context.pushReplacement(Routes.patient(patient.id));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Register patient')),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: Form(
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
                      key: const Key('register.given'),
                      controller: _given,
                      decoration: const InputDecoration(
                        labelText: 'First name',
                      ),
                      textCapitalization: TextCapitalization.words,
                      validator: (v) => validateName(v, 'first name'),
                    ),
                    const SizedBox(height: AppSizes.md),
                    TextFormField(
                      key: const Key('register.family'),
                      controller: _family,
                      decoration: const InputDecoration(labelText: 'Surname'),
                      textCapitalization: TextCapitalization.words,
                      validator: (v) => validateName(v, 'surname'),
                    ),
                    const SizedBox(height: AppSizes.md),
                    DateField(
                      fieldKey: const Key('register.dob'),
                      controller: _dob,
                      label: 'Date of birth',
                      firstDate: DateTime(1900),
                    ),
                    const SizedBox(height: AppSizes.md),
                    LabelledDropdown(
                      key: const Key('register.region'),
                      label: 'Area type',
                      options: regionLabels,
                      value: _region,
                      onChanged: (v) => setState(() => _region = v),
                      validator: (v) =>
                          v == null ? 'Choose the area type.' : null,
                    ),
                    const SizedBox(height: AppSizes.md),
                    TextFormField(
                      key: const Key('register.district'),
                      controller: _district,
                      decoration: const InputDecoration(
                        labelText: 'District (optional)',
                      ),
                      validator: validateOptionalText,
                    ),
                    const SizedBox(height: AppSizes.md),
                    TextFormField(
                      key: const Key('register.phone'),
                      controller: _phone,
                      decoration: const InputDecoration(
                        labelText: 'Phone (optional)',
                        hintText: '+260971234567',
                      ),
                      keyboardType: TextInputType.phone,
                      validator: validatePhone,
                    ),
                    const SizedBox(height: AppSizes.md),
                    TextFormField(
                      key: const Key('register.nrc'),
                      controller: _nrc,
                      decoration: const InputDecoration(
                        labelText: 'NRC number (optional)',
                        hintText: '123456/78/1',
                      ),
                      validator: validateNationalId,
                    ),
                    const SizedBox(height: AppSizes.lg),
                    PrimaryButton(
                      key: const Key('register.save'),
                      label: 'Save patient',
                      busy: _busy,
                      onPressed: _save,
                    ),
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
