import 'package:flutter/material.dart';

import '../../app/theme/tokens.dart';

/// Severity shown as a 4 px left accent. Colour is never the only signal:
/// callers also put the severity in words.
enum Severity {
  none(AppColors.border),
  info(AppColors.sky),
  positive(AppColors.positive),
  warning(AppColors.amber),
  danger(AppColors.danger);

  const Severity(this.accent);
  final Color accent;
}

/// White card with a hairline border and optional severity accent.
class ClinicalCard extends StatelessWidget {
  const ClinicalCard({
    super.key,
    required this.child,
    this.severity = Severity.none,
    this.onTap,
    this.padding = const EdgeInsets.all(AppSizes.md),
  });

  final Widget child;
  final Severity severity;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (severity != Severity.none)
                Container(
                  width: AppSizes.severityAccentWidth,
                  color: severity.accent,
                ),
              Expanded(
                child: Padding(padding: padding, child: child),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
