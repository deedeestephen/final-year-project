import 'package:flutter/material.dart';

/// Design tokens: Zambian national colours (ADR-004), with the legibility
/// rules kept from ADR-002. The flag's colours appear as accents and in the
/// national stripe; where a colour carries text it is deepened until it
/// reaches WCAG 2.1 AA contrast. No national emblem is used: this is a
/// research prototype, not an official Government of Zambia service.
abstract final class AppColors {
  // Flag colours, exactly (accents, stripe, icons; not for body text). The
  // same in light and dark mode.
  static const flagGreen = Color(0xFF198A00);
  static const flagRed = Color(0xFFDE2010);
  static const flagBlack = Color(0xFF000000);
  static const flagOrange = Color(0xFFEF7D00);
}

/// The colours that change between light and dark mode. Widgets read them
/// with `context.colors`; every text pair is checked for WCAG AA in both.
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.brightness,
    required this.primary,
    required this.primaryPressed,
    required this.canvas,
    required this.surface,
    required this.surfaceMuted,
    required this.border,
    required this.borderStrong,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.onPrimary,
    required this.positive,
    required this.syncedDot,
    required this.amber,
    required this.sky,
    required this.linkText,
    required this.amberText,
    required this.danger,
    required this.onDanger,
    required this.dangerBg,
    required this.dangerBorder,
    required this.warningText,
    required this.warningBg,
    required this.successText,
    required this.successBg,
    required this.infoText,
    required this.infoBg,
    required this.offlineText,
    required this.offlineBg,
  });

  final Brightness brightness;
  final Color primary; // buttons, app bar (white text on it)
  final Color primaryPressed;
  final Color canvas; // app background
  final Color surface; // cards, sheets
  final Color surfaceMuted; // secondary buttons, chips
  final Color border; // hairline card border
  final Color borderStrong; // inputs, raised sheets
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted; // timestamps and meta only
  final Color onPrimary; // text on primary
  final Color positive; // focus ring, positive accent
  final Color syncedDot;
  final Color amber; // warnings, highlights (not text)
  final Color sky; // syncing / information dot
  final Color linkText; // green text and icons
  final Color amberText; // copper text
  final Color danger;
  final Color onDanger; // text on a danger fill
  final Color dangerBg;
  final Color dangerBorder;
  final Color warningText;
  final Color warningBg;
  final Color successText;
  final Color successBg;
  final Color infoText;
  final Color infoBg;
  final Color offlineText;
  final Color offlineBg;

  static const light = AppPalette(
    brightness: Brightness.light,
    primary: Color(0xFF146E00),
    primaryPressed: Color(0xFF0F5500),
    canvas: Color(0xFFF7F9F6),
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFEEF3EC),
    border: Color(0xFFDDE5DA),
    borderStrong: Color(0xFFC2CFBE),
    textPrimary: Color(0xFF111111),
    textSecondary: Color(0xFF45503F),
    textMuted: Color(0xFF5E6858),
    onPrimary: Color(0xFFFFFFFF),
    positive: Color(0xFF198A00),
    syncedDot: Color(0xFF2E9E1A),
    amber: Color(0xFFEF7D00),
    sky: Color(0xFF0277BD),
    linkText: Color(0xFF146E00),
    amberText: Color(0xFFA04A00),
    danger: Color(0xFFB81A0D),
    onDanger: Color(0xFFFFFFFF),
    dangerBg: Color(0xFFFFF1EF),
    dangerBorder: Color(0xFFF4A79E),
    warningText: Color(0xFF8A3E00),
    warningBg: Color(0xFFFFF3E3),
    successText: Color(0xFF0F5C12),
    successBg: Color(0xFFEAF6E6),
    infoText: Color(0xFF065A8C),
    infoBg: Color(0xFFEEF7FC),
    offlineText: Color(0xFF3A4336),
    offlineBg: Color(0xFFEEF1EC),
  );

  static const dark = AppPalette(
    brightness: Brightness.dark,
    primary: Color(0xFF1F7A0E),
    primaryPressed: Color(0xFF16600A),
    canvas: Color(0xFF101410),
    surface: Color(0xFF1A201A),
    surfaceMuted: Color(0xFF243024),
    border: Color(0xFF2E3A2D),
    borderStrong: Color(0xFF55664F),
    textPrimary: Color(0xFFEDF1EB),
    textSecondary: Color(0xFFC3CCBF),
    textMuted: Color(0xFFA3AE9E),
    onPrimary: Color(0xFFFFFFFF),
    positive: Color(0xFF5CC247),
    syncedDot: Color(0xFF4CC23A),
    amber: Color(0xFFF08A1C),
    sky: Color(0xFF4FB3F0),
    linkText: Color(0xFF7FD46A),
    amberText: Color(0xFFF5A55A),
    danger: Color(0xFFFF8A80),
    onDanger: Color(0xFF2A0A07),
    dangerBg: Color(0xFF3A1714),
    dangerBorder: Color(0xFF8C3A33),
    warningText: Color(0xFFFFB870),
    warningBg: Color(0xFF3A2610),
    successText: Color(0xFF8EDB7C),
    successBg: Color(0xFF15301A),
    infoText: Color(0xFF8CCBF5),
    infoBg: Color(0xFF0F2A3A),
    offlineText: Color(0xFFD0D8CC),
    offlineBg: Color(0xFF252C24),
  );

  @override
  AppPalette copyWith() => this;

  @override
  AppPalette lerp(AppPalette? other, double t) {
    if (other == null) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return AppPalette(
      brightness: t < 0.5 ? brightness : other.brightness,
      primary: l(primary, other.primary),
      primaryPressed: l(primaryPressed, other.primaryPressed),
      canvas: l(canvas, other.canvas),
      surface: l(surface, other.surface),
      surfaceMuted: l(surfaceMuted, other.surfaceMuted),
      border: l(border, other.border),
      borderStrong: l(borderStrong, other.borderStrong),
      textPrimary: l(textPrimary, other.textPrimary),
      textSecondary: l(textSecondary, other.textSecondary),
      textMuted: l(textMuted, other.textMuted),
      onPrimary: l(onPrimary, other.onPrimary),
      positive: l(positive, other.positive),
      syncedDot: l(syncedDot, other.syncedDot),
      amber: l(amber, other.amber),
      sky: l(sky, other.sky),
      linkText: l(linkText, other.linkText),
      amberText: l(amberText, other.amberText),
      danger: l(danger, other.danger),
      onDanger: l(onDanger, other.onDanger),
      dangerBg: l(dangerBg, other.dangerBg),
      dangerBorder: l(dangerBorder, other.dangerBorder),
      warningText: l(warningText, other.warningText),
      warningBg: l(warningBg, other.warningBg),
      successText: l(successText, other.successText),
      successBg: l(successBg, other.successBg),
      infoText: l(infoText, other.infoText),
      infoBg: l(infoBg, other.infoBg),
      offlineText: l(offlineText, other.offlineText),
      offlineBg: l(offlineBg, other.offlineBg),
    );
  }
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
/// checks each one against WCAG AA (4.5:1) in light and dark mode.
List<(String, Color, Color)> textColourPairs(AppPalette p) => [
  ('primary text on surface', p.textPrimary, p.surface),
  ('primary text on canvas', p.textPrimary, p.canvas),
  ('secondary text on surface', p.textSecondary, p.surface),
  ('secondary text on canvas', p.textSecondary, p.canvas),
  ('muted meta text on surface', p.textMuted, p.surface),
  ('muted meta text on canvas', p.textMuted, p.canvas),
  ('label on primary green', p.onPrimary, p.primary),
  ('label on pressed green', p.onPrimary, p.primaryPressed),
  ('green text on muted surface', p.linkText, p.surfaceMuted),
  ('green link text on surface', p.linkText, p.surface),
  ('green link text on canvas', p.linkText, p.canvas),
  ('copper text on surface', p.amberText, p.surface),
  ('danger on danger background', p.danger, p.dangerBg),
  ('danger on surface', p.danger, p.surface),
  ('label on danger', p.onDanger, p.danger),
  ('warning on warning background', p.warningText, p.warningBg),
  ('success on success background', p.successText, p.successBg),
  ('info on info background', p.infoText, p.infoBg),
  ('offline on offline background', p.offlineText, p.offlineBg),
  ('snackbar text', p.canvas, p.textPrimary),
];

extension AppPaletteContext on BuildContext {
  /// The colours for the current light or dark theme.
  AppPalette get colors =>
      Theme.of(this).extension<AppPalette>() ?? AppPalette.light;
}
