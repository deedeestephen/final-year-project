import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/tokens.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/primary_button.dart';
import '../application/session_controller.dart';
import 'auth_messages.dart';
import 'auth_scaffold.dart';

/// Required after an administrator creates an account or resets a password.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;
  List<String> _serverPasswordErrors = const [];

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  String? _validateNew(String? v) {
    final value = v ?? '';
    if (value.length < passwordMinLength) {
      return 'Use at least $passwordMinLength characters.';
    }
    if (value.length > passwordMaxLength) {
      return 'Use at most $passwordMaxLength characters.';
    }
    if (value == _current.text) {
      return 'Choose a password different from your current one.';
    }
    if (_serverPasswordErrors.isNotEmpty) {
      return _serverPasswordErrors.join('\n');
    }
    return null;
  }

  Future<void> _submit() async {
    setState(() => _serverPasswordErrors = const []);
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(sessionControllerProvider.notifier)
          .changePassword(_current.text, _next.text);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = authErrorMessage(e);
        _serverPasswordErrors = e.fieldErrors['password'] ?? const [];
      });
      if (_serverPasswordErrors.isNotEmpty) _form.currentState!.validate();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Choose a new password',
      subtitle:
          'For your security, set your own password before you continue. '
          'Use at least $passwordMinLength characters; a short phrase works well.',
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) FormErrorBox(_error!),
            TextFormField(
              key: const Key('change.current'),
              controller: _current,
              decoration: const InputDecoration(labelText: 'Current password'),
              obscureText: true,
              autofillHints: const [AutofillHints.password],
              validator: (v) => (v == null || v.isEmpty)
                  ? 'Enter your current password.'
                  : null,
            ),
            const SizedBox(height: AppSizes.md),
            TextFormField(
              key: const Key('change.new'),
              controller: _next,
              decoration: const InputDecoration(labelText: 'New password'),
              obscureText: true,
              autofillHints: const [AutofillHints.newPassword],
              validator: _validateNew,
              onChanged: (_) {
                if (_serverPasswordErrors.isNotEmpty) {
                  setState(() => _serverPasswordErrors = const []);
                }
              },
            ),
            const SizedBox(height: AppSizes.md),
            TextFormField(
              key: const Key('change.confirm'),
              controller: _confirm,
              decoration: const InputDecoration(
                labelText: 'Confirm new password',
              ),
              obscureText: true,
              validator: (v) =>
                  v != _next.text ? 'The passwords do not match.' : null,
            ),
            const SizedBox(height: AppSizes.lg),
            PrimaryButton(
              key: const Key('change.submit'),
              label: 'Save password',
              busy: _busy,
              onPressed: _submit,
            ),
            const SizedBox(height: AppSizes.sm),
            TextButton(
              onPressed: _busy
                  ? null
                  : () =>
                        ref.read(sessionControllerProvider.notifier).signOut(),
              child: const Text('Sign out'),
            ),
          ],
        ),
      ),
    );
  }
}
