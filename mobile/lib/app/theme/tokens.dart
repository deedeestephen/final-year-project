import 'package:flutter/painting.dart';

/// Design tokens: Zambian national colours (ADR-004), with the legibility
/// rules kept from ADR-002. The flag's colours appear as accents and in the
/// national stripe; where a colour carries text it is deepened until it
/// reaches WCAG 2.1 AA contrast. No national emblem is used: this is a
/// research prototype, not an official Government of Zambia service.
abstract final class AppColors {
  // Flag colours, exactly (accents, stripe, icons; not for body text).
  static const flagGreen = Color(0xFF198A00);
  static const flagRed = Color(0xFFDE2010);
  static const flagBlack = Color(0xFF000000);
  static const flagOrange = Color(0xFFEF7D00);

  // Structure
  static const primary = Color(0xFF146E00); // deep flag green: buttons, bars
  static const primaryPressed = Color(0xFF0F5500);
  static const canvas = Color(0xFFF7F9F6); // app background
  static const surface = Color(0xFFFFFFFF); // cards, sheets
  static const surfaceMuted = Color(0xFFEEF3EC); // secondary buttons, chips
  static const border = Color(0xFFDDE5DA); // hairline card border
  static const borderStrong = Color(0xFFC2CFBE); // inputs, raised sheets

  // Text
  static const textPrimary = Color(0xFF111111); // near flag black
  static const textSecondary = Color(0xFF45503F);
  static const textMuted = Color(0xFF5E6858); // timestamps and meta only
  static const onPrimary = Color(0xFFFFFFFF);

  // Accents (not for text on white)
  static const positive = flagGreen; // focus ring, positive accent
  static const syncedDot = Color(0xFF2E9E1A);
  static const amber = flagOrange; // copper-orange: warnings, highlights
  static const sky = Color(0xFF0277BD); // syncing / information dot

  // Text-safe variants
  static const linkText = primary;
  static const amberText = Color(0xFFA04A00); // deep copper

  // Severity (text colour on its tinted background)
  static const danger = Color(0xFFB81A0D); // deep flag red
  static const dangerBg = Color(0xFFFFF1EF);
  static const dangerBorder = Color(0xFFF4A79E);
  static const warningText = Color(0xFF8A3E00);
  static const warningBg = Color(0xFFFFF3E3);
  static const successText = Color(0xFF0F5C12);
  static const successBg = Color(0xFFEAF6E6);
  static const infoText = Color(0xFF065A8C);
  static const infoBg = Color(0xFFEEF7FC);
  static const offlineText = Color(0xFF3A4336);
  static const offlineBg = Color(0xFFEEF1EC);
}

abstract final class AppFonts {
  static const heading = 'PlusJakartaSans';
  static const body = 'Inter';
  static const mono = 'JetBrainsMono';
}

abstract final class AppSizes {
  // Legibility rules (Option 1): body text never below 15 px; 13 px for meta only.
  static const bodyMin = 15.0;
  static const metaText = 13.0;
  static const minTouchTarget = 48.0;
  static const inputHeight = 52.0;
  static const severityAccentWidth = 4.0;

  // Spacing scale (8 pt grid with a 4 pt sub-grid)
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}

abstract final class AppRadii {
  static const chip = Radius.circular(999);
  static const control = Radius.circular(8); // inputs, buttons
  static const card = Radius.circular(16); // clinical cards, dialogs
  static const data = Radius.circular(4); // tables, lab values
}

/// Every foreground/background pair the UI uses for text; the theme test
/// checks each one against WCAG AA (4.5:1).
const textColourPairs = <(String, Color, Color)>[
  ('primary text on surface', AppColors.textPrimary, AppColors.surface),
  ('primary text on canvas', AppColors.textPrimary, AppColors.canvas),
  ('secondary text on surface', AppColors.textSecondary, AppColors.surface),
  ('secondary text on canvas', AppColors.textSecondary, AppColors.canvas),
  ('muted meta text on surface', AppColors.textMuted, AppColors.surface),
  ('muted meta text on canvas', AppColors.textMuted, AppColors.canvas),
  ('label on primary green', AppColors.onPrimary, AppColors.primary),
  ('label on pressed green', AppColors.onPrimary, AppColors.primaryPressed),
  ('green text on muted surface', AppColors.primary, AppColors.surfaceMuted),
  ('green link text on surface', AppColors.linkText, AppColors.surface),
  ('copper text on surface', AppColors.amberText, AppColors.surface),
  ('danger on danger background', AppColors.danger, AppColors.dangerBg),
  ('danger on surface', AppColors.danger, AppColors.surface),
  ('warning on warning background', AppColors.warningText, AppColors.warningBg),
  ('success on success background', AppColors.successText, AppColors.successBg),
  ('info on info background', AppColors.infoText, AppColors.infoBg),
  ('offline on offline background', AppColors.offlineText, AppColors.offlineBg),
];
