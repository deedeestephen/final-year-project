import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../app/theme/tokens.dart';
import '../../../shared/widgets/national_stripe.dart';
import '../../../shared/widgets/offline_banner.dart';

/// Layout shared by the signed-out screens: a green gradient header with the
/// app's name and the screen title, the offline strip, then the form in a
/// readable column and a research-prototype footer.
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
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _AuthHeader(title: title, subtitle: subtitle, showBack: showBack),
            const OfflineBanner(),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSizes.lg,
                    AppSizes.lg,
                    AppSizes.lg,
                    AppSizes.lg,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      child,
                      const SizedBox(height: AppSizes.xl),
                      SafeArea(
                        top: false,
                        child: Text(
                          NationalStripe.notOfficial,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                    ],
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

/// "PCa" in a white rounded square: the app's mark (not an emblem).
class AppMark extends StatelessWidget {
  const AppMark({super.key, this.size = 44});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.all(AppRadii.tile),
        ),
        child: Text(
          'PCa',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            // Fixed brand green: the mark is always on white.
            color: AppPalette.light.primary,
            fontSize: size * 0.34,
            fontWeight: FontWeight.w800,
            height: 1,
          ),
        ),
      ),
    );
  }
}

class _AuthHeader extends StatelessWidget {
  const _AuthHeader({
    required this.title,
    required this.subtitle,
    required this.showBack,
  });

  final String title;
  final String? subtitle;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    final text = Theme.of(context).textTheme;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(bottom: AppRadii.hero),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [p.heroStart, p.heroEnd],
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 488),
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(
                        AppSizes.lg,
                        showBack ? AppSizes.xs : AppSizes.xl,
                        AppSizes.lg,
                        AppSizes.xl,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (showBack)
                            Transform.translate(
                              offset: const Offset(-12, 0),
                              child: BackButton(color: p.onPrimary),
                            ),
                          Row(
                            children: [
                              const AppMark(),
                              const SizedBox(width: AppSizes.md - 4),
                              Text(
                                'PCa mHealth',
                                style: text.titleLarge?.copyWith(
                                  color: p.onPrimary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSizes.lg),
                          Semantics(
                            header: true,
                            child: Text(
                              title,
                              style: text.headlineMedium?.copyWith(
                                color: p.onPrimary,
                              ),
                            ),
                          ),
                          if (subtitle != null) ...[
                            const SizedBox(height: AppSizes.sm),
                            Text(
                              subtitle!,
                              style: text.bodyLarge?.copyWith(
                                color: p.onHeroMuted,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const NationalStripe(height: 4),
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
          color: context.colors.dangerBg,
          border: Border.all(color: context.colors.dangerBorder),
          borderRadius: const BorderRadius.all(AppRadii.control),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.error_outline, color: context.colors.danger),
            const SizedBox(width: AppSizes.sm),
            Expanded(
              child: Text(
                message,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: context.colors.danger),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
