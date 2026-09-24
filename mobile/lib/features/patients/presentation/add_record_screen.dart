import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/tokens.dart';
import '../../../core/db/local_store.dart';
import '../../../core/providers.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../../shared/widgets/primary_button.dart';
import 'clinical_formats.dart';
import 'form_widgets.dart';

/// Adds a screening record (PSA, DRE, PI-RADS...) for a patient.
class AddRecordScreen extends ConsumerStatefulWidget {
  const AddRecordScreen({super.key, required this.patientId});

  final String patientId;

  @override
  ConsumerState<AddRecordScreen> createState() => _AddRecordScreenState();
}

class _AddRecordScreenState extends ConsumerState<AddRecordScreen> {
  final _form = GlobalKey<FormState>();
  final _date = TextEditingController(text: formatDate(DateTime.now()));
  final _psa = TextEditingController();
  final _freePsa = TextEditingController();
  final _volume = TextEditingController();
  final _notes = TextEditingController();
  String? _dre;
  String? _pirads;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_date, _psa, _freePsa, _volume, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  ({double? value, String? error}) _psaValue() =>
      parseMeasurement(_psa.text, min: 0, max: 10000, decimals: 3);

  String? _validateFreePsa(String? v) {
    final free = parseMeasurement(v, min: 0, max: 10000, decimals: 3);
    if (free.error != null) return free.error;
    final total = _psaValue().value;
    if (free.value != null && total != null && free.value! > total) {
      return 'Free PSA cannot be higher than total PSA.';
    }
    return null;
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    await ref
        .read(localStoreProvider)
        .addRecord(
          widget.patientId,
          RecordDraft(
            encounterDate: _date.text.trim(),
            dreFinding: _dre!,
            psaNgMl: _psaValue().value,
            freePsaNgMl: parseMeasurement(
              _freePsa.text,
              min: 0,
              max: 10000,
              decimals: 3,
            ).value,
            piradsScore: _pirads == null ? null : int.parse(_pirads!),
            prostateVolumeMl: parseMeasurement(
              _volume.text,
              min: 1,
              max: 500,
              decimals: 1,
            ).value,
            notes: _notes.text,
          ),
        );
    unawaited(ref.read(syncEngineProvider).sync());
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Screening record saved on this device.')),
    );
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    const decimal = TextInputType.numberWithOptions(decimal: true);
    return Scaffold(
      appBar: AppBar(title: const Text('Screening record')),
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
                    DateField(
                      fieldKey: const Key('record.date'),
                      controller: _date,
                      label: 'Visit date',
                      firstDate: DateTime(1900),
                    ),
                    const SizedBox(height: AppSizes.md),
                    TextFormField(
                      key: const Key('record.psa'),
                      controller: _psa,
                      keyboardType: decimal,
                      decoration: const InputDecoration(
                        labelText: 'Total PSA (optional)',
                        suffixText: 'ng/mL',
                      ),
                      validator: (_) => _psaValue().error,
                    ),
                    const SizedBox(height: AppSizes.md),
                    TextFormField(
                      key: const Key('record.freePsa'),
                      controller: _freePsa,
                      keyboardType: decimal,
                      decoration: const InputDecoration(
                        labelText: 'Free PSA (optional)',
                        suffixText: 'ng/mL',
                      ),
                      validator: _validateFreePsa,
                    ),
                    const SizedBox(height: AppSizes.md),
                    LabelledDropdown(
                      key: const Key('record.dre'),
                      label: 'Digital rectal exam (DRE)',
                      options: dreLabels,
                      value: _dre,
                      onChanged: (v) => setState(() => _dre = v),
                      validator: (v) =>
                          v == null ? 'Choose the DRE finding.' : null,
                    ),
                    const SizedBox(height: AppSizes.md),
                    LabelledDropdown(
                      key: const Key('record.pirads'),
                      label: 'PI-RADS score (optional)',
                      options: const {
                        '1': '1: very low',
                        '2': '2: low',
                        '3': '3: intermediate',
                        '4': '4: high',
                        '5': '5: very high',
                      },
                      value: _pirads,
                      onChanged: (v) => setState(() => _pirads = v),
                    ),
                    const SizedBox(height: AppSizes.md),
                    TextFormField(
                      key: const Key('record.volume'),
                      controller: _volume,
                      keyboardType: decimal,
                      decoration: const InputDecoration(
                        labelText: 'Prostate volume (optional)',
                        suffixText: 'mL',
                      ),
                      validator: (v) => parseMeasurement(
                        v,
                        min: 1,
                        max: 500,
                        decimals: 1,
                      ).error,
                    ),
                    const SizedBox(height: AppSizes.md),
                    TextFormField(
                      key: const Key('record.notes'),
                      controller: _notes,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Notes (optional)',
                      ),
                      validator: (v) => validateOptionalText(v, max: 2000),
                    ),
                    const SizedBox(height: AppSizes.lg),
                    PrimaryButton(
                      key: const Key('record.save'),
                      label: 'Save record',
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
