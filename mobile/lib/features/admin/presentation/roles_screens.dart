import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/tokens.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/admin_repository.dart';
import 'admin_common.dart';

class RolesScreen extends ConsumerWidget {
  const RolesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roles = ref.watch(rolesProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Roles & permissions')),
      body: roles.when(
        loading: () => const Center(
          child: CircularProgressIndicator(semanticsLabel: 'Loading'),
        ),
        error: (e, _) => Center(child: Text(adminErrorMessage(e))),
        data: (list) => RefreshIndicator(
          onRefresh: () => ref.refresh(rolesProvider.future),
          child: ListView(
            padding: const EdgeInsets.all(AppSizes.md),
            children: [
              Text(
                'A role is a set of permissions. Changes apply to everyone '
                'with the role the next time their app talks to the server.',
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSizes.md),
              for (final r in list) ...[
                ClinicalCard(
                  key: Key('role.${r.name}'),
                  onTap: () => context.push('/admin/roles/${r.name}'),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              roleLabels[r.name] ?? r.name,
                              style: theme.textTheme.titleMedium,
                            ),
                            Text(
                              r.description,
                              style: theme.textTheme.bodyMedium,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${r.permissions.length} permissions · '
                              '${r.userCount} account${r.userCount == 1 ? '' : 's'}'
                              '${r.customised ? ' · Customised' : ''}',
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right,
                        color: AppColors.textSecondary,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSizes.sm),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Tick or untick the permissions of one role, with the server's safety locks
/// shown as locked boxes.
class RolePermissionsScreen extends ConsumerStatefulWidget {
  const RolePermissionsScreen({super.key, required this.roleName});

  final String roleName;

  @override
  ConsumerState<RolePermissionsScreen> createState() =>
      _RolePermissionsScreenState();
}

class _RolePermissionsScreenState extends ConsumerState<RolePermissionsScreen> {
  Set<String>? _selected;
  bool _busy = false;

  Future<void> _save(RoleInfo role) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Change this role?'),
        content: Text(
          'This changes what ${role.userCount} '
          'account${role.userCount == 1 ? '' : 's'} with the '
          '${roleLabels[role.name] ?? role.name} role can do, straight away. '
          'The change is recorded in the audit log.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            key: const Key('role.confirmSave'),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await _run(
      () => ref
          .read(adminRepositoryProvider)
          .setRolePermissions(role.name, _selected!.toList()..sort()),
      'Permissions saved.',
    );
  }

  Future<void> _run(Future<RoleInfo> Function() action, String done) async {
    setState(() => _busy = true);
    try {
      final updated = await action();
      ref.invalidate(rolesProvider);
      if (!mounted) return;
      setState(() => _selected = updated.permissions.toSet());
      (ScaffoldMessenger.of(
        context,
      )..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(done)));
    } catch (e) {
      if (mounted) showAdminError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final roles = ref.watch(rolesProvider).value;
    final catalogue = ref.watch(permissionCatalogueProvider).value;
    final role = roles?.where((r) => r.name == widget.roleName).firstOrNull;
    if (role != null && _selected == null) {
      _selected = role.permissions.toSet();
    }
    final selected = _selected;

    // Group the catalogue by area.
    final groups = <String, List<PermissionInfo>>{};
    for (final p in catalogue ?? const <PermissionInfo>[]) {
      final prefix = p.code.split(':').first;
      groups.putIfAbsent(permissionGroups[prefix] ?? 'Other', () => []).add(p);
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(roleLabels[widget.roleName] ?? widget.roleName),
      ),
      body: role == null || catalogue == null || selected == null
          ? const Center(
              child: CircularProgressIndicator(semanticsLabel: 'Loading'),
            )
          : ListView(
              padding: const EdgeInsets.all(AppSizes.md),
              children: [
                Text(role.description, style: theme.textTheme.bodyLarge),
                if (role.name == 'PATIENT')
                  Padding(
                    padding: const EdgeInsets.only(top: AppSizes.sm),
                    child: Text(
                      'For safety, patients can only be given permissions '
                      'about themselves.',
                      style: theme.textTheme.bodyMedium,
                    ),
                  ),
                for (final g in groups.entries) ...[
                  const SizedBox(height: AppSizes.md),
                  Text(g.key, style: theme.textTheme.titleSmall),
                  for (final p in g.value)
                    _PermissionTile(
                      permission: p,
                      checked: selected.contains(p.code),
                      locked: role.required.contains(p.code)
                          ? 'Always needed, so nobody is locked out'
                          : role.notAllowed.contains(p.code)
                          ? 'Not allowed for this role'
                          : null,
                      onChanged: (on) => setState(
                        () =>
                            on ? selected.add(p.code) : selected.remove(p.code),
                      ),
                    ),
                ],
                const SizedBox(height: AppSizes.lg),
                PrimaryButton(
                  key: const Key('role.save'),
                  label: 'Save permissions',
                  busy: _busy,
                  onPressed: () => _save(role),
                ),
                const SizedBox(height: AppSizes.sm),
                OutlinedButton(
                  key: const Key('role.reset'),
                  onPressed: _busy
                      ? null
                      : () => _run(
                          () => ref
                              .read(adminRepositoryProvider)
                              .resetRole(role.name),
                          'Back to the default permissions.',
                        ),
                  child: const Text('Reset to defaults'),
                ),
              ],
            ),
    );
  }
}

class _PermissionTile extends StatelessWidget {
  const _PermissionTile({
    required this.permission,
    required this.checked,
    required this.onChanged,
    this.locked,
  });

  final PermissionInfo permission;
  final bool checked;
  final String? locked;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return CheckboxListTile(
      key: Key('perm.${permission.code}'),
      contentPadding: EdgeInsets.zero,
      controlAffinity: ListTileControlAffinity.leading,
      value: checked,
      onChanged: locked == null ? (v) => onChanged(v ?? false) : null,
      title: Text(permission.description, style: theme.textTheme.bodyLarge),
      subtitle: Text(
        locked == null ? permission.code : '${permission.code} · $locked',
        style: theme.textTheme.bodySmall,
      ),
    );
  }
}
