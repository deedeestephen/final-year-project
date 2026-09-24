import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/tokens.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../data/admin_repository.dart';
import 'admin_common.dart';

/// Patient app accounts and their links to clinic records. Linking is only by
/// an exact NRC match, and the administrator sees just the record number and
/// facility, never clinical details.
class PatientAccountsScreen extends ConsumerStatefulWidget {
  const PatientAccountsScreen({super.key});

  @override
  ConsumerState<PatientAccountsScreen> createState() =>
      _PatientAccountsScreenState();
}

class _PatientAccountsScreenState extends ConsumerState<PatientAccountsScreen> {
  String _status = 'unlinked';
  late Future<List<PatientAccount>> _accounts = _load();

  Future<List<PatientAccount>> _load() =>
      ref.read(adminRepositoryProvider).patientAccounts(_status);

  void _reload() => setState(() {
    _accounts = _load();
  });

  Future<void> _link(PatientAccount a) async {
    final repo = ref.read(adminRepositoryProvider);
    RecordMatch match;
    try {
      match = await repo.match(a.userId);
    } on ApiException catch (e) {
      if (!mounted) return;
      final text = switch (e.code) {
        'NO_MATCH' =>
          'No clinic record has this NRC yet. The clinic must register the '
              'patient with the same NRC first.',
        'NO_NRC' =>
          'This account uses a passport. The clinic links passport holders.',
        _ => adminErrorMessage(e),
      };
      (ScaffoldMessenger.of(
        context,
      )..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(text)));
      return;
    }
    if (!mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          match.linkedToAnotherAccount
              ? 'Already linked'
              : 'Link this account?',
        ),
        content: Text(
          match.linkedToAnotherAccount
              ? 'Record ${match.mrn} at ${match.facilityName} is already linked '
                    'to another account. Check with the clinic.'
              : 'The NRC matches record ${match.mrn} at ${match.facilityName}.\n\n'
                    '${a.displayName} will be able to see their own results '
                    'and messages in the app.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          if (!match.linkedToAnotherAccount)
            TextButton(
              key: const Key('account.confirmLink'),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Link'),
            ),
        ],
      ),
    );
    if (ok != true) return;
    await _act(() => repo.link(a.userId), 'Account linked.');
  }

  Future<void> _unlink(PatientAccount a) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Unlink this account?'),
        content: Text(
          '${a.displayName} will no longer see record ${a.linkedMrn} in the '
          'app and will be signed out.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            key: const Key('account.confirmUnlink'),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Unlink'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await _act(
      () => ref.read(adminRepositoryProvider).unlink(a.userId),
      'Account unlinked.',
    );
  }

  Future<void> _act(Future<void> Function() action, String done) async {
    try {
      await action();
      if (!mounted) return;
      (ScaffoldMessenger.of(
        context,
      )..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(done)));
      _reload();
    } catch (e) {
      if (mounted) showAdminError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Patient accounts')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSizes.md),
            child: SegmentedButton<String>(
              key: const Key('accounts.filter'),
              segments: const [
                ButtonSegment(value: 'unlinked', label: Text('Not linked')),
                ButtonSegment(value: 'linked', label: Text('Linked')),
                ButtonSegment(value: 'all', label: Text('All')),
              ],
              selected: {_status},
              showSelectedIcon: false,
              onSelectionChanged: (s) {
                _status = s.first;
                _reload();
              },
            ),
          ),
          Expanded(
            child: FutureBuilder<List<PatientAccount>>(
              future: _accounts,
              builder: (context, snap) {
                if (snap.hasError) {
                  return Center(child: Text(adminErrorMessage(snap.error!)));
                }
                if (!snap.hasData) {
                  return const Center(
                    child: CircularProgressIndicator(semanticsLabel: 'Loading'),
                  );
                }
                final list = snap.data!;
                if (list.isEmpty) {
                  return const Center(child: Text('No accounts here.'));
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(
                    AppSizes.md,
                    0,
                    AppSizes.md,
                    AppSizes.lg,
                  ),
                  itemCount: list.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSizes.sm),
                  itemBuilder: (context, i) {
                    final a = list[i];
                    return ClinicalCard(
                      key: Key('account.${a.email}'),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            a.displayName,
                            style: theme.textTheme.titleMedium,
                          ),
                          Text(a.email, style: theme.textTheme.bodyMedium),
                          const SizedBox(height: AppSizes.xs),
                          Text(
                            [
                              if (a.idDocumentType != null)
                                '${a.idDocumentType == 'NRC' ? 'NRC' : 'Passport'} ${a.idNumberMasked}',
                              if (a.phoneMasked != null)
                                'Phone ${a.phoneMasked}',
                            ].join(' · '),
                            style: theme.textTheme.bodySmall,
                          ),
                          if (a.isLinked)
                            Padding(
                              padding: const EdgeInsets.only(top: AppSizes.xs),
                              child: Text(
                                'Linked to ${a.linkedMrn} at ${a.linkedFacility}',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: AppColors.successText,
                                ),
                              ),
                            ),
                          const SizedBox(height: AppSizes.sm),
                          a.isLinked
                              ? OutlinedButton(
                                  key: Key('account.unlink.${a.email}'),
                                  onPressed: () => _unlink(a),
                                  child: const Text('Unlink'),
                                )
                              : FilledButton(
                                  key: Key('account.link.${a.email}'),
                                  onPressed: () => _link(a),
                                  child: const Text('Find record and link'),
                                ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
