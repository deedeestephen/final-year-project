import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/tokens.dart';
import '../../../shared/widgets/async_state_view.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../patients/application/patient_providers.dart';
import '../../patients/presentation/form_widgets.dart';
import '../application/clinical_server_providers.dart';
import '../data/clinical_server_models.dart';
import 'server_common.dart';

/// Consent a clinician records with the patient (paper form, witnessed
/// verbal consent, or on this device). Withdrawing is always possible.
class ConsentScreen extends ConsumerWidget {
  const ConsentScreen({super.key, required this.patientId});

  /// Local patient id (the route); the server id is looked up.
  final String patientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final patient = ref.watch(patientProvider(patientId)).value;
    final serverId = patient?.serverId;
    return Scaffold(
      appBar: AppBar(title: const Text('Consent')),
      floatingActionButton: serverId == null
          ? null
          : FloatingActionButton.extended(
              key: const Key('consent.add'),
              onPressed: () => _record(context, ref, serverId),
              icon: const Icon(Icons.add),
              label: const Text('Record consent'),
            ),
      body: serverId == null
          ? const Padding(
              padding: EdgeInsets.all(AppSizes.md),
              child: NotSyncedYetCard(),
            )
          : _ConsentList(serverId: serverId),
    );
  }

  Future<void> _record(
    BuildContext context,
    WidgetRef ref,
    String serverId,
  ) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ConsentForm(serverId: serverId),
    );
    if (saved == true) ref.invalidate(staffConsentsProvider(serverId));
  }
}

class _ConsentList extends ConsumerWidget {
  const _ConsentList({required this.serverId});

  final String serverId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final consents = ref.watch(staffConsentsProvider(serverId));
    return AsyncStateView<List<StaffConsent>>(
      loading: consents.isLoading && !consents.hasValue,
      data: consents.value,
      error: consents.error,
      onRetry: () => ref.invalidate(staffConsentsProvider(serverId)),
      isEmpty: (list) => list.isEmpty,
      emptyMessage: 'No consent recorded yet.',
      builder: (context, list) => ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSizes.md,
          AppSizes.md,
          AppSizes.md,
          96,
        ),
        children: [
          for (final c in list) ...[
            ClinicalCard(
              severity: c.isActive ? Severity.positive : Severity.none,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    consentTypeLabels[c.type] ?? c.type,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: AppSizes.xs),
                  LabelledValue('Status', c.isActive ? 'Given' : 'Withdrawn'),
                  LabelledValue(
                    'How',
                    consentMethodLabels[c.method] ?? c.method,
                  ),
                  LabelledValue('Given on', formatDate(c.grantedAt)),
                  if (c.withdrawnAt != null)
                    LabelledValue('Withdrawn', formatDate(c.withdrawnAt!)),
                  if (c.isActive)
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        key: Key('consent.withdraw.${c.type}'),
                        onPressed: () => _withdraw(context, ref, c),
                        child: const Text('Withdraw'),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSizes.sm),
          ],
        ],
      ),
    );
  }

  Future<void> _withdraw(
    BuildContext context,
    WidgetRef ref,
    StaffConsent c,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Withdraw consent?'),
        content: Text(
          '${consentTypeLabels[c.type] ?? c.type} will stop. '
          '${c.type == 'AI_ANALYSIS' ? 'No new AI analysis can be requested for this patient. ' : ''}'
          'Only do this if the patient asked to withdraw.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            key: const Key('consent.confirmWithdraw'),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Withdraw'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await ref.read(clinicalServerApiProvider).withdrawConsent(serverId, c.id);
      ref.invalidate(staffConsentsProvider(serverId));
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(friendlyError(e))));
      }
    }
  }
}

class _ConsentForm extends ConsumerStatefulWidget {
  const _ConsentForm({required this.serverId});

  final String serverId;

  @override
  ConsumerState<_ConsentForm> createState() => _ConsentFormState();
}

class _ConsentFormState extends ConsumerState<_ConsentForm> {
  final _form = GlobalKey<FormState>();
  String? _type = 'AI_ANALYSIS';
  String? _method = 'WRITTEN';
  final _version = TextEditingController(text: 'v1');
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _version.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(clinicalServerApiProvider)
          .grantConsent(
            widget.serverId,
            type: _type!,
            method: _method!,
            textVersion: _version.text.trim(),
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() {
        _busy = false;
        _error = friendlyError(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: AppSizes.md,
        right: AppSizes.md,
        top: AppSizes.md,
        bottom: MediaQuery.viewInsetsOf(context).bottom + AppSizes.md,
      ),
      child: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Record consent',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: AppSizes.sm),
            Text(
              'Only record consent the patient has actually given.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSizes.md),
            LabelledDropdown(
              key: const Key('consent.type'),
              label: 'What the patient agrees to',
              options: consentTypeLabels,
              value: _type,
              onChanged: (v) => setState(() => _type = v),
              validator: (v) => v == null ? 'Choose what was agreed.' : null,
            ),
            const SizedBox(height: AppSizes.md),
            LabelledDropdown(
              key: const Key('consent.method'),
              label: 'How it was given',
              options: consentMethodLabels,
              value: _method,
              onChanged: (v) => setState(() => _method = v),
              validator: (v) => v == null ? 'Choose how it was given.' : null,
            ),
            const SizedBox(height: AppSizes.md),
            TextFormField(
              key: const Key('consent.version'),
              controller: _version,
              decoration: const InputDecoration(
                labelText: 'Consent form version',
                helperText: 'As printed on the form, for example v1',
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Enter the version.' : null,
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSizes.sm),
              Text(_error!, style: TextStyle(color: context.colors.danger)),
            ],
            const SizedBox(height: AppSizes.md),
            FilledButton(
              key: const Key('consent.save'),
              onPressed: _busy ? null : _save,
              child: Text(_busy ? 'Saving…' : 'Save consent'),
            ),
          ],
        ),
      ),
    );
  }
}
