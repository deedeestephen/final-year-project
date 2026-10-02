import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/app/theme/app_theme.dart';
import 'package:pca_mhealth/app/theme/tokens.dart';

/// WCAG 2.1 relative luminance.
double _luminance(Color c) {
  double channel(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

double contrastRatio(Color a, Color b) {
  final la = _luminance(a);
  final lb = _luminance(b);
  final (hi, lo) = la > lb ? (la, lb) : (lb, la);
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  group('colour contrast (WCAG 2.1 AA, NFR-11)', () {
    test('the contrast function matches known values', () {
      expect(contrastRatio(Colors.black, Colors.white), closeTo(21, 0.01));
      expect(contrastRatio(Colors.white, Colors.white), closeTo(1, 0.01));
    });

    for (final (mode, palette) in [
      ('light', AppPalette.light),
      ('dark', AppPalette.dark),
    ]) {
      for (final (name, fg, bg) in textColourPairs(palette)) {
        test('$mode mode: $name reaches 4.5:1', () {
          expect(
            contrastRatio(fg, bg),
            greaterThanOrEqualTo(4.5),
            reason: '$mode: $name',
          );
        });
      }
      // WCAG 1.4.11: a text field's outline shows where to type, so it must
      // reach 3:1 against what the field sits on (review of 2 October 2026:
      // it was 1.7:1 in light mode and 2.6:1 in dark mode).
      test('$mode mode: text-field outlines reach 3:1 (non-text contrast)', () {
        for (final (ground, colour) in [
          ('surface', palette.surface),
          ('canvas', palette.canvas),
        ]) {
          expect(
            contrastRatio(palette.borderStrong, colour),
            greaterThanOrEqualTo(3),
            reason: '$mode: outline on $ground',
          );
        }
      });
    }

    test(
      'bright accents are genuinely unsafe for body text, which is why they are icon-only',
      () {
        expect(
          contrastRatio(AppPalette.light.positive, AppPalette.light.surface),
          lessThan(4.5),
        );
        expect(
          contrastRatio(AppPalette.light.amber, AppPalette.light.surface),
          lessThan(4.5),
        );
      },
    );
  });

  group('typography and touch targets', () {
    final theme = buildAppTheme();

    test('body text is at least 15 px and meta text at least 13 px', () {
      final t = theme.textTheme;
      for (final style in [
        t.bodyMedium,
        t.bodyLarge,
        t.labelLarge,
        t.titleMedium,
      ]) {
        expect(style!.fontSize, greaterThanOrEqualTo(AppSizes.bodyMin));
      }
      for (final style in [t.bodySmall, t.labelMedium]) {
        expect(style!.fontSize, greaterThanOrEqualTo(AppSizes.metaText));
      }
    });

    test('text styles drive the variable-font weight axis', () {
      final bold = theme.textTheme.headlineMedium!;
      expect(bold.fontVariations, [const FontVariation.weight(700)]);
      expect(bold.fontFamily, AppFonts.heading);
      expect(clinicalValueStyle().fontFamily, AppFonts.mono);
    });

    test('buttons and inputs meet the 48 dp and 52 px targets', () {
      final filled = theme.filledButtonTheme.style!.minimumSize!.resolve({})!;
      expect(filled.height, greaterThanOrEqualTo(AppSizes.minTouchTarget));
      final text = theme.textButtonTheme.style!.minimumSize!.resolve({})!;
      expect(text.height, greaterThanOrEqualTo(AppSizes.minTouchTarget));
      expect(
        theme.inputDecorationTheme.constraints!.minHeight,
        AppSizes.inputHeight,
      );
      expect(theme.materialTapTargetSize, MaterialTapTargetSize.padded);
    });
  });
}
