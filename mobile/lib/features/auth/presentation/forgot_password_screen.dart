import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/tokens.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../../../shared/widgets/primary_button.dart';
import 'auth_messages.dart';
import 'auth_scaffold.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  /// Same wording whether or not the account exists (no account enumeration).
  static const sentMessage =
      'If an account exists for this email, password reset instructions have '
      'been sent. You can also ask your facility administrator to reset it.';

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).forgotPassword(_email.text);
      if (mounted) setState(() => _sent = true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = authErrorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Reset your password',
      showBack: true,
      child: _sent
          ? Text(
              ForgotPasswordScreen.sentMessage,
              style: Theme.of(context).textTheme.bodyLarge,
            )
          : Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_error != null) FormErrorBox(_error!),
                  TextFormField(
                    key: const Key('forgot.email'),
                    controller: _email,
                    decoration: const InputDecoration(labelText: 'Email'),
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    validator: validateEmail,
                    onFieldSubmitted: (_) => _submit(),
                  ),
                  const SizedBox(height: AppSizes.lg),
                  PrimaryButton(
                    key: const Key('forgot.submit'),
                    label: 'Send reset instructions',
                    busy: _busy,
                    onPressed: _submit,
                  ),
                ],
              ),
            ),
    );
  }
}
