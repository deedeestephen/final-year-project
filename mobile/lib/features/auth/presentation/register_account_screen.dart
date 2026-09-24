import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../app/theme/tokens.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../patient/application/patient_providers.dart';
import '../../patients/presentation/clinical_formats.dart';
import 'auth_messages.dart';
import 'auth_scaffold.dart';

/// Self-registration for patients (`POST /auth/register`). Staff accounts are
/// created by an administrator.
class RegisterAccountScreen extends ConsumerStatefulWidget {
  const RegisterAccountScreen({super.key});

  static const done =
      'Your account is ready. Sign in, then ask your clinic to link it to your record.';

  @override
  ConsumerState<RegisterAccountScreen> createState() =>
      _RegisterAccountScreenState();
}

class _RegisterAccountScreenState extends ConsumerState<RegisterAccountScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _phone = TextEditingController();
  final _idNumber = TextEditingController();
  String _idType = 'NRC';
  bool _busy = false;
  bool _created = false;
  String? _error;
  List<String> _serverPasswordErrors = const [];
  List<String> _serverIdErrors = const [];

  @override
  void dispose() {
    for (final c in [_name, _email, _password, _confirm, _phone, _idNumber]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _validatePassword(String? v) {
    final value = v ?? '';
    if (value.length < passwordMinLength) {
      return 'Use at least $passwordMinLength characters.';
    }
    if (value.length > passwordMaxLength) {
      return 'Use at most $passwordMaxLength characters.';
    }
    if (_serverPasswordErrors.isNotEmpty) {
      return _serverPasswordErrors.join('\n');
    }
    return null;
  }

  Future<void> _submit() async {
    setState(() {
      _serverPasswordErrors = const [];
      _serverIdErrors = const [];
    });
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(patientRepositoryProvider)
          .register(
            displayName: _name.text,
            email: _email.text,
            password: _password.text,
            phone: _phone.text,
            idDocumentType: _idType,
            idNumber: _idNumber.text,
          );
      if (mounted) setState(() => _created = true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = switch (e.code) {
          // Same wording whether or not the email is already registered.
          'CONFLICT' =>
            'An account cannot be created with these details. If you already '
                'have an account, sign in or reset your password.',
          _ => authErrorMessage(e),
        };
        _serverPasswordErrors = e.fieldErrors['password'] ?? const [];
        _serverIdErrors = e.fieldErrors['idNumber'] ?? const [];
      });
      if (_serverIdErrors.isNotEmpty) _form.currentState!.validate();
      if (_serverPasswordErrors.isNotEmpty) _form.currentState!.validate();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_created) {
      return AuthScaffold(
        title: 'Account created',
        showBack: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              RegisterAccountScreen.done,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSizes.lg),
            PrimaryButton(
              key: const Key('register.toSignIn'),
              label: 'Go to sign in',
              onPressed: () => context.go(Routes.login),
            ),
          ],
        ),
      );
    }
    return AuthScaffold(
      title: 'Create an account',
      subtitle:
          'For patients. Clinic staff get their account from an administrator.',
      showBack: true,
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) FormErrorBox(_error!),
            TextFormField(
              key: const Key('account.name'),
              controller: _name,
              decoration: const InputDecoration(labelText: 'Your name'),
              textCapitalization: TextCapitalization.words,
              autofillHints: const [AutofillHints.name],
              validator: (v) => (v?.trim() ?? '').isEmpty
                  ? 'Enter your name.'
                  : validateName(v, 'name'),
            ),
            const SizedBox(height: AppSizes.md),
            TextFormField(
              key: const Key('account.email'),
              controller: _email,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              autofillHints: const [AutofillHints.email],
              validator: validateEmail,
            ),
            const SizedBox(height: AppSizes.md),
            TextFormField(
              key: const Key('account.phone'),
              controller: _phone,
              decoration: const InputDecoration(
                labelText: 'Phone number',
                hintText: '+260971234567',
              ),
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumber],
              validator: validateRequiredPhone,
            ),
            const SizedBox(height: AppSizes.md),
            Text(
              'Identity document',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: AppSizes.xs),
            SegmentedButton<String>(
              key: const Key('account.idType'),
              segments: const [
                ButtonSegment(value: 'NRC', label: Text('NRC')),
                ButtonSegment(value: 'PASSPORT', label: Text('Passport')),
              ],
              selected: {_idType},
              showSelectedIcon: false,
              onSelectionChanged: (s) => setState(() {
                _idType = s.first;
                _serverIdErrors = const [];
              }),
            ),
            const SizedBox(height: AppSizes.sm),
            TextFormField(
              key: const Key('account.idNumber'),
              controller: _idNumber,
              decoration: InputDecoration(
                labelText: _idType == 'NRC' ? 'NRC number' : 'Passport number',
                hintText: _idType == 'NRC' ? '123456/78/1' : 'ZN1234567',
              ),
              textCapitalization: TextCapitalization.characters,
              validator: (v) {
                final local = _idType == 'NRC'
                    ? validateNrc(v)
                    : validatePassport(v);
                if (local != null) return local;
                return _serverIdErrors.isEmpty
                    ? null
                    : 'Please check this number.';
              },
            ),
            const SizedBox(height: AppSizes.xs),
            Text(
              'Your phone and ID number are stored encrypted. Your clinic uses '
              'the NRC to link this account to your record.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: AppSizes.md),
            TextFormField(
              key: const Key('account.password'),
              controller: _password,
              decoration: const InputDecoration(labelText: 'Password'),
              obscureText: true,
              autofillHints: const [AutofillHints.newPassword],
              validator: _validatePassword,
            ),
            const SizedBox(height: AppSizes.md),
            TextFormField(
              key: const Key('account.confirm'),
              controller: _confirm,
              decoration: const InputDecoration(labelText: 'Confirm password'),
              obscureText: true,
              validator: (v) =>
                  v != _password.text ? 'The passwords do not match.' : null,
            ),
            const SizedBox(height: AppSizes.xs),
            Text(
              'Use at least $passwordMinLength characters. A short phrase works well.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: AppSizes.lg),
            PrimaryButton(
              key: const Key('account.submit'),
              label: 'Create account',
              busy: _busy,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
