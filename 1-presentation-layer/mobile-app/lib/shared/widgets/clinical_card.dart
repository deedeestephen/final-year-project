import 'package:flutter/material.dart';

import '../../app/theme/tokens.dart';

/// Severity shown as a 4 px left accent. Colour is never the only signal:
/// callers also put the severity in words.
enum Severity {
  none,
  info,
  positive,
  warning,
  danger;

  /// The accent colour in the current light or dark palette.
  Color accentIn(AppPalette p) => switch (this) {
    Severity.none => p.border,
    Severity.info => p.sky,
    Severity.positive => p.positive,
    Severity.warning => p.amber,
    Severity.danger => p.danger,
  };
}

/// Card (white in light mode) with a hairline border and optional severity accent.
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
                  color: severity.accentIn(context.colors),
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
