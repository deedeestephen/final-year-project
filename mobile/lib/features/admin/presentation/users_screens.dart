import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/tokens.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../auth/presentation/auth_messages.dart';
import '../../patients/presentation/clinical_formats.dart';
import '../data/admin_repository.dart';
import 'admin_common.dart';

/// All accounts, with search and a role filter.
class UsersScreen extends ConsumerStatefulWidget {
  const UsersScreen({super.key});

  @override
  ConsumerState<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends ConsumerState<UsersScreen> {
  String _query = '';
  String? _role;
  late Future<List<AdminUser>> _users = _load();

  Future<List<AdminUser>> _load() =>
      ref.read(adminRepositoryProvider).users(q: _query, role: _role);

  void _reload() => setState(() {
    _users = _load();
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Users')),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('users.add'),
        onPressed: () async {
          await context.push('/admin/users/new');
          _reload();
        },
        icon: const Icon(Icons.person_add_alt_1_outlined),
        label: const Text('Add staff user'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSizes.md,
              AppSizes.md,
              AppSizes.md,
              0,
            ),
            child: TextField(
              key: const Key('users.search'),
              decoration: const InputDecoration(
                labelText: 'Search by name or email',
                prefixIcon: Icon(Icons.search),
              ),
              onSubmitted: (v) {
                _query = v;
                _reload();
              },
            ),
          ),
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.md),
              children: [
                for (final entry in {null: 'All', ...roleLabels}.entries)
                  Padding(
                    padding: const EdgeInsets.only(
                      right: AppSizes.sm,
                      top: AppSizes.sm,
                    ),
                    child: ChoiceChip(
                      label: Text(entry.value),
                      selected: _role == entry.key,
                      onSelected: (_) {
                        _role = entry.key;
                        _reload();
                      },
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: FutureBuilder<List<AdminUser>>(
              future: _users,
              builder: (context, snap) {
                if (snap.hasError) {
                  return Center(child: Text(adminErrorMessage(snap.error!)));
                }
                if (!snap.hasData) {
                  return const Center(
                    child: CircularProgressIndicator(semanticsLabel: 'Loading'),
                  );
                }
                final users = snap.data!;
                if (users.isEmpty) {
                  return const Center(child: Text('No users found.'));
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(
                    AppSizes.md,
                    AppSizes.sm,
                    AppSizes.md,
                    96,
                  ),
                  itemCount: users.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSizes.sm),
                  itemBuilder: (context, i) {
                    final u = users[i];
                    return ClinicalCard(
                      key: Key('user.${u.email}'),
                      onTap: () async {
                        await context.push('/admin/users/${u.id}');
                        _reload();
                      },
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  u.displayName,
                                  style: theme.textTheme.titleMedium,
                                ),
                                Text(
                                  u.email,
                                  style: theme.textTheme.bodyMedium,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  u.roles
                                      .map((r) => roleLabels[r] ?? r)
                                      .join(' · '),
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                          StatusChip(u.status),
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

/// Roles, facility and status for one account, plus unlock and password reset.
class UserDetailScreen extends ConsumerStatefulWidget {
  const UserDetailScreen({super.key, required this.userId});

  final String userId;

  @override
  ConsumerState<UserDetailScreen> createState() => _UserDetailScreenState();
}

class _UserDetailScreenState extends ConsumerState<UserDetailScreen> {
  AdminUser? _user;
  Set<String> _roles = {};
  String? _facilityId;
  bool _active = true;
  bool _busy = false;
  Object? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final u = await ref.read(adminRepositoryProvider).user(widget.userId);
      if (!mounted) return;
      setState(() {
        _user = u;
        _roles = u.roles.toSet();
        _facilityId = u.facilityId;
        _active = u.status != 'DISABLED';
      });
    } catch (e) {
      if (mounted) setState(() => _loadError = e);
    }
  }

  Future<void> _run(Future<void> Function() action, String done) async {
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      (ScaffoldMessenger.of(
        context,
      )..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(done)));
      await _load();
    } catch (e) {
      if (mounted) showAdminError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    final u = _user!;
    if (_roles.isEmpty) {
      (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(
        const SnackBar(content: Text('Choose at least one role.')),
      );
      return;
    }
    if (_roles.any(facilityRoles.contains) && _facilityId == null) {
      (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(
        const SnackBar(
          content: Text('Clinicians and pathologists need a facility.'),
        ),
      );
      return;
    }
    final changes = <String, Object>{
      if (!_sameRoles(u.roles)) 'roles': _roles.toList()..sort(),
      if (_facilityId != null && _facilityId != u.facilityId)
        'facilityId': _facilityId!,
      if (_active != (u.status != 'DISABLED'))
        'status': _active ? 'ACTIVE' : 'DISABLED',
    };
    if (changes.isEmpty) return;
    await _run(
      () => ref.read(adminRepositoryProvider).updateUser(u.id, changes),
      'Saved. Changes to access apply straight away.',
    );
  }

  bool _sameRoles(List<String> roles) =>
      roles.length == _roles.length && roles.every(_roles.contains);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final u = _user;
    final facilities = ref.watch(facilitiesProvider).value ?? const [];
    return Scaffold(
      appBar: AppBar(title: Text(u?.displayName ?? 'User')),
      body: u == null
          ? Center(
              child: _loadError == null
                  ? const CircularProgressIndicator(semanticsLabel: 'Loading')
                  : Text(adminErrorMessage(_loadError!)),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(AppSizes.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ClinicalCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                u.email,
                                style: theme.textTheme.titleMedium,
                              ),
                            ),
                            StatusChip(u.status),
                          ],
                        ),
                        const SizedBox(height: AppSizes.xs),
                        Text(
                          u.lastLoginAt == null
                              ? 'Never signed in'
                              : 'Last sign-in ${DateFormat('d MMM yyyy, HH:mm').format(u.lastLoginAt!.toLocal())}',
                          style: theme.textTheme.bodyMedium,
                        ),
                        if (u.mustChangePassword)
                          Text(
                            'Must choose a new password at next sign-in',
                            style: theme.textTheme.bodySmall,
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSizes.lg),
                  Text('Roles', style: theme.textTheme.titleMedium),
                  const SizedBox(height: AppSizes.xs),
                  Wrap(
                    spacing: AppSizes.sm,
                    runSpacing: AppSizes.xs,
                    children: [
                      for (final r in roleLabels.entries)
                        FilterChip(
                          key: Key('user.role.${r.key}'),
                          label: Text(r.value),
                          selected: _roles.contains(r.key),
                          onSelected: (on) => setState(
                            () => on ? _roles.add(r.key) : _roles.remove(r.key),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSizes.lg),
                  Text(
                    'Facility (which patients they can see)',
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSizes.xs),
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    key: const Key('user.facility'),
                    initialValue: facilities.any((f) => f.id == _facilityId)
                        ? _facilityId
                        : null,
                    decoration: const InputDecoration(labelText: 'Facility'),
                    items: [
                      for (final f in facilities)
                        DropdownMenuItem(
                          value: f.id,
                          child: Text(f.name, overflow: TextOverflow.ellipsis),
                        ),
                    ],
                    onChanged: (v) => setState(() => _facilityId = v),
                  ),
                  const SizedBox(height: AppSizes.md),
                  SwitchListTile(
                    key: const Key('user.active'),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Account active'),
                    subtitle: const Text(
                      'Turning this off signs the person out everywhere.',
                    ),
                    value: _active,
                    onChanged: (v) => setState(() => _active = v),
                  ),
                  const SizedBox(height: AppSizes.md),
                  PrimaryButton(
                    key: const Key('user.save'),
                    label: 'Save changes',
                    busy: _busy,
                    onPressed: _save,
                  ),
                  const SizedBox(height: AppSizes.lg),
                  const Divider(),
                  if (u.status == 'LOCKED')
                    OutlinedButton.icon(
                      key: const Key('user.unlock'),
                      onPressed: _busy
                          ? null
                          : () => _run(
                              () => ref
                                  .read(adminRepositoryProvider)
                                  .updateUser(u.id, {'unlock': true}),
                              'Account unlocked.',
                            ),
                      icon: const Icon(Icons.lock_open),
                      label: const Text('Unlock account'),
                    ),
                  const SizedBox(height: AppSizes.sm),
                  OutlinedButton.icon(
                    key: const Key('user.resetPassword'),
                    onPressed: _busy
                        ? null
                        : () async {
                            try {
                              final temp = await ref
                                  .read(adminRepositoryProvider)
                                  .resetPassword(u.id);
                              if (!context.mounted) return;
                              await showTemporaryPassword(
                                context,
                                email: u.email,
                                password: temp,
                              );
                              await _load();
                            } catch (e) {
                              if (context.mounted) showAdminError(context, e);
                            }
                          },
                    icon: const Icon(Icons.password),
                    label: const Text('Reset password'),
                  ),
                ],
              ),
            ),
    );
  }
}

/// Creates a staff account with a one-time temporary password.
class CreateUserScreen extends ConsumerStatefulWidget {
  const CreateUserScreen({super.key});

  @override
  ConsumerState<CreateUserScreen> createState() => _CreateUserScreenState();
}

class _CreateUserScreenState extends ConsumerState<CreateUserScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _name = TextEditingController();
  final Set<String> _roles = {'CLINICIAN'};
  String? _facilityId;
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (!_form.currentState!.validate()) return;
    if (_roles.isEmpty) return;
    setState(() => _busy = true);
    try {
      final temp = await ref
          .read(adminRepositoryProvider)
          .createUser(
            email: _email.text,
            displayName: _name.text,
            roles: _roles.toList(),
            facilityId: _facilityId,
          );
      if (!mounted) return;
      await showTemporaryPassword(
        context,
        email: _email.text.trim(),
        password: temp,
      );
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) showAdminError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final facilities = ref.watch(facilitiesProvider).value ?? const [];
    final needsFacility = _roles.any(facilityRoles.contains);
    return Scaffold(
      appBar: AppBar(title: const Text('Add staff user')),
      body: Form(
        key: _form,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSizes.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                key: const Key('newUser.email'),
                controller: _email,
                decoration: const InputDecoration(labelText: 'Email'),
                keyboardType: TextInputType.emailAddress,
                validator: validateEmail,
              ),
              const SizedBox(height: AppSizes.md),
              TextFormField(
                key: const Key('newUser.name'),
                controller: _name,
                decoration: const InputDecoration(labelText: 'Full name'),
                validator: (v) => validateName(v, 'name'),
              ),
              const SizedBox(height: AppSizes.lg),
              Text('Roles', style: theme.textTheme.titleMedium),
              Wrap(
                spacing: AppSizes.sm,
                children: [
                  for (final r in roleLabels.entries.where(
                    (r) => r.key != 'PATIENT',
                  ))
                    FilterChip(
                      key: Key('newUser.role.${r.key}'),
                      label: Text(r.value),
                      selected: _roles.contains(r.key),
                      onSelected: (on) => setState(
                        () => on ? _roles.add(r.key) : _roles.remove(r.key),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AppSizes.md),
              DropdownButtonFormField<String>(
                isExpanded: true,
                key: const Key('newUser.facility'),
                initialValue: _facilityId,
                decoration: InputDecoration(
                  labelText: needsFacility ? 'Facility' : 'Facility (optional)',
                ),
                items: [
                  for (final f in facilities)
                    DropdownMenuItem(
                      value: f.id,
                      child: Text(f.name, overflow: TextOverflow.ellipsis),
                    ),
                ],
                onChanged: (v) => setState(() => _facilityId = v),
                validator: (v) => needsFacility && v == null
                    ? 'Clinicians and pathologists need a facility.'
                    : null,
              ),
              const SizedBox(height: AppSizes.sm),
              Text(
                'Patients create their own accounts in the app.',
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: AppSizes.lg),
              PrimaryButton(
                key: const Key('newUser.create'),
                label: 'Create account',
                busy: _busy,
                onPressed: _create,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
