import 'package:flutter/painting.dart';

/// Design tokens: Design Option 2 "Clinical Trust" with the Option 1
/// legibility rules (ADR-002). Colours used for text are chosen to reach
/// WCAG 2.1 AA contrast; brighter accents are for icons, dots and borders only.
abstract final class AppColors {
  // Structure
  static const navy = Color(0xFF0A2540); // primary actions, headers
  static const navyPressed = Color(0xFF0F3460);
  static const canvas = Color(0xFFF8FAFC); // app background
  static const surface = Color(0xFFFFFFFF); // cards, sheets
  static const surfaceMuted = Color(0xFFF1F5F9); // secondary buttons, chips
  static const border = Color(0xFFE2E8F0); // hairline card border
  static const borderStrong = Color(0xFFCBD5E1); // inputs, raised sheets

  // Text
  static const textPrimary = Color(0xFF0F172A);
  static const textSecondary = Color(0xFF475569);
  static const textMuted = Color(
    0xFF64748B,
  ); // timestamps and meta only (13 px)
  static const onNavy = Color(0xFFFFFFFF);

  // Clinical accents (not for text on white)
  static const teal = Color(0xFF0D9488); // focus ring, positive accent
  static const emerald = Color(0xFF10B981); // "synced" dot
  static const amber = Color(0xFFD97706); // warning icon/accent
  static const sky = Color(0xFF0284C7); // syncing dot

  // Text-safe variants of the accents
  static const tealText = Color(0xFF0F766E);
  static const amberText = Color(0xFFB45309);

  // Severity (text colour on its tinted background)
  static const danger = Color(0xFFBE123C);
  static const dangerBg = Color(0xFFFFF1F2);
  static const dangerBorder = Color(0xFFFDA4AF);
  static const warningText = Color(0xFF92400E);
  static const warningBg = Color(0xFFFEF3C7);
  static const successText = Color(0xFF065F46);
  static const successBg = Color(0xFFECFDF5);
  static const infoText = Color(0xFF075985);
  static const infoBg = Color(0xFFF0F9FF);
  static const offlineText = Color(0xFF334155);
  static const offlineBg = Color(0xFFF1F5F9);
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
  ('muted meta text on surface', AppColors.textMuted, AppColors.surface),
  ('muted meta text on canvas', AppColors.textMuted, AppColors.canvas),
  ('button label on navy', AppColors.onNavy, AppColors.navy),
  ('button label on pressed navy', AppColors.onNavy, AppColors.navyPressed),
  ('navy text on muted surface', AppColors.navy, AppColors.surfaceMuted),
  ('teal link text on surface', AppColors.tealText, AppColors.surface),
  ('amber text on surface', AppColors.amberText, AppColors.surface),
  ('danger on danger background', AppColors.danger, AppColors.dangerBg),
  ('warning on warning background', AppColors.warningText, AppColors.warningBg),
  ('success on success background', AppColors.successText, AppColors.successBg),
  ('info on info background', AppColors.infoText, AppColors.infoBg),
  ('offline on offline background', AppColors.offlineText, AppColors.offlineBg),
];
