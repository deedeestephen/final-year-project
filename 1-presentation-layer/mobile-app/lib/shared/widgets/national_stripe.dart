import 'package:flutter/material.dart';

import '../../app/theme/tokens.dart';

/// A thin band in the Zambian flag's colours (green, red, black, orange),
/// used as a decorative accent. It is not an emblem and does not imply that
/// the app is an official government service.
class NationalStripe extends StatelessWidget {
  const NationalStripe({super.key, this.height = 6});

  final double height;

  static const notOfficial =
      'Research prototype. Not a medical device. '
      'Not an official Government of the Republic of Zambia service.';

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox(
        height: height,
        child: const Row(
          // Stretch: an empty coloured box would otherwise be 0 px tall.
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(flex: 7, child: ColoredBox(color: AppColors.flagGreen)),
            Expanded(child: ColoredBox(color: AppColors.flagRed)),
            Expanded(child: ColoredBox(color: AppColors.flagBlack)),
            Expanded(child: ColoredBox(color: AppColors.flagOrange)),
          ],
        ),
      ),
    );
  }
}
