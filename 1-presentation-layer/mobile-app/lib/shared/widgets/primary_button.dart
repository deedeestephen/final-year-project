import 'package:flutter/material.dart';

import '../../app/theme/tokens.dart';

/// Full-width primary action. Shows a spinner and ignores taps while [busy].
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final child = busy
        ? SizedBox.square(
            dimension: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: context.colors.onPrimary,
              semanticsLabel: 'Working',
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 20),
                const SizedBox(width: AppSizes.sm),
              ],
              Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
            ],
          );
    return SizedBox(
      width: double.infinity,
      height: AppSizes.inputHeight,
      child: FilledButton(onPressed: busy ? null : onPressed, child: child),
    );
  }
}
