import 'package:flutter/material.dart';

import '../../../app/theme/tokens.dart';
import '../../../shared/widgets/national_stripe.dart';
import '../../../shared/widgets/offline_banner.dart';

/// Layout shared by the signed-out screens: offline strip, centred column
/// with a readable maximum width, and a research-prototype footer.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
    this.showBack = false,
  });

  final String title;
  final String? subtitle;
  final Widget child;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: showBack ? AppBar() : null,
      body: SafeArea(
        child: Column(
          children: [
            const NationalStripe(),
            const OfflineBanner(),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(AppSizes.lg),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(title, style: theme.textTheme.headlineSmall),
                        if (subtitle != null) ...[
                          const SizedBox(height: AppSizes.sm),
                          Text(subtitle!, style: theme.textTheme.bodyLarge),
                        ],
                        const SizedBox(height: AppSizes.lg),
                        child,
                        const SizedBox(height: AppSizes.xl),
                        Text(
                          NationalStripe.notOfficial,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Error box shown above a form.
class FormErrorBox extends StatelessWidget {
  const FormErrorBox(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(AppSizes.md),
        margin: const EdgeInsets.only(bottom: AppSizes.md),
        decoration: BoxDecoration(
          color: AppColors.dangerBg,
          border: Border.all(color: AppColors.dangerBorder),
          borderRadius: const BorderRadius.all(AppRadii.control),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline, color: AppColors.danger),
            const SizedBox(width: AppSizes.sm),
            Expanded(
              child: Text(
                message,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: AppColors.danger),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
