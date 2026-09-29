import 'package:flutter/material.dart';

/// Design tokens: awareness blue (ADR-011, which replaces the national
/// colours of ADR-004), with the legibility rules kept from ADR-002. Light
/// blue is the prostate-cancer awareness colour; it is used for decoration
/// only, and every colour that carries text is deep enough to reach WCAG 2.1
/// AA contrast. The app is a research prototype, not an official service.
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
    required this.heroStart,
    required this.heroEnd,
    required this.onHeroMuted,
    required this.accent,
    required this.shadow,
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
  final Color linkText; // blue text and icons
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

  /// The blue gradient behind the home greeting and the sign-in header
  /// (white text on both ends).
  final Color heroStart;
  final Color heroEnd;

  /// Smaller text on the hero gradient.
  final Color onHeroMuted;

  /// The awareness light blue: the accent line under the hero, the bot's
  /// antenna, the recording glow. Decoration only, never text.
  final Color accent;

  /// Soft card shadow (transparent in dark mode, where borders carry depth).
  final Color shadow;

  static const light = AppPalette(
    brightness: Brightness.light,
    primary: Color(0xFF2563EB),
    primaryPressed: Color(0xFF1D4ED8),
    canvas: Color(0xFFF5F8FF),
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFEEF3FF),
    border: Color(0xFFDCE4F2),
    borderStrong: Color(0xFFB8C6DE),
    textPrimary: Color(0xFF0F172A),
    textSecondary: Color(0xFF334155),
    textMuted: Color(0xFF52627A),
    onPrimary: Color(0xFFFFFFFF),
    positive: Color(0xFF3B82F6),
    syncedDot: Color(0xFF16A34A),
    amber: Color(0xFFEF7D00),
    sky: Color(0xFF0284C7),
    linkText: Color(0xFF1D4ED8),
    amberText: Color(0xFFB45309),
    danger: Color(0xFFB91C1C),
    onDanger: Color(0xFFFFFFFF),
    dangerBg: Color(0xFFFEF2F2),
    dangerBorder: Color(0xFFFCA5A5),
    warningText: Color(0xFF92400E),
    warningBg: Color(0xFFFFF7ED),
    successText: Color(0xFF166534),
    successBg: Color(0xFFF0FDF4),
    infoText: Color(0xFF075985),
    infoBg: Color(0xFFF0F9FF),
    offlineText: Color(0xFF334155),
    offlineBg: Color(0xFFEEF2F7),
    heroStart: Color(0xFF1D4ED8),
    heroEnd: Color(0xFF1E3A8A),
    onHeroMuted: Color(0xFFDBEAFE),
    accent: Color(0xFF38BDF8),
    shadow: Color(0x1A1E3A8A),
  );

  static const dark = AppPalette(
    brightness: Brightness.dark,
    primary: Color(0xFF2563EB),
    primaryPressed: Color(0xFF1D4ED8),
    canvas: Color(0xFF0B1220),
    surface: Color(0xFF111A2E),
    surfaceMuted: Color(0xFF1A2540),
    border: Color(0xFF243150),
    borderStrong: Color(0xFF4A5B80),
    textPrimary: Color(0xFFE8EEF9),
    textSecondary: Color(0xFFB9C5DA),
    textMuted: Color(0xFF93A3BD),
    onPrimary: Color(0xFFFFFFFF),
    positive: Color(0xFF60A5FA),
    syncedDot: Color(0xFF4ADE80),
    amber: Color(0xFFF59E0B),
    sky: Color(0xFF38BDF8),
    linkText: Color(0xFF93C5FD),
    amberText: Color(0xFFFCD34D),
    danger: Color(0xFFFCA5A5),
    onDanger: Color(0xFF2A0A0A),
    dangerBg: Color(0xFF3A1418),
    dangerBorder: Color(0xFF8C3A3A),
    warningText: Color(0xFFFCD34D),
    warningBg: Color(0xFF3A2A10),
    successText: Color(0xFF86EFAC),
    successBg: Color(0xFF0F2A1C),
    infoText: Color(0xFF7DD3FC),
    infoBg: Color(0xFF0C2436),
    offlineText: Color(0xFFCBD5E1),
    offlineBg: Color(0xFF1A2334),
    heroStart: Color(0xFF1E40AF),
    heroEnd: Color(0xFF172554),
    onHeroMuted: Color(0xFFDBEAFE),
    accent: Color(0xFF38BDF8),
    shadow: Color(0x00000000),
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
      heroStart: l(heroStart, other.heroStart),
      heroEnd: l(heroEnd, other.heroEnd),
      onHeroMuted: l(onHeroMuted, other.onHeroMuted),
      accent: l(accent, other.accent),
      shadow: l(shadow, other.shadow),
    );
  }
}

/// Colourful icon backgrounds for navigation tiles. They only tell tiles
/// apart; they never mean good or bad, and are not used on clinical results.
enum AccentTone {
  blue(
    Color(0xFFDBEAFE),
    Color(0xFF1D4ED8),
    Color(0xFF172554),
    Color(0xFF93C5FD),
  ),
  sky(
    Color(0xFFE0F2FE),
    Color(0xFF075985),
    Color(0xFF0C2D44),
    Color(0xFF7DD3FC),
  ),
  orange(
    Color(0xFFFFEDD5),
    Color(0xFF9A3412),
    Color(0xFF3B2912),
    Color(0xFFFDBA74),
  ),
  purple(
    Color(0xFFEDE9FE),
    Color(0xFF5B21B6),
    Color(0xFF2E2350),
    Color(0xFFC4B5FD),
  ),
  teal(
    Color(0xFFCCFBF1),
    Color(0xFF0F766E),
    Color(0xFF0F3531),
    Color(0xFF5EEAD4),
  ),
  grey(
    Color(0xFFEEF2F7),
    Color(0xFF334155),
    Color(0xFF1E293B),
    Color(0xFFCBD5E1),
  );

  const AccentTone(this._lightBg, this._lightFg, this._darkBg, this._darkFg);

  final Color _lightBg;
  final Color _lightFg;
  final Color _darkBg;
  final Color _darkFg;

  Color background(AppPalette p) =>
      p.brightness == Brightness.dark ? _darkBg : _lightBg;
  Color foreground(AppPalette p) =>
      p.brightness == Brightness.dark ? _darkFg : _lightFg;
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
  static const control = Radius.circular(12); // inputs, buttons
  static const card = Radius.circular(20); // cards, dialogs
  static const tile = Radius.circular(14); // icon squares on tiles
  static const hero = Radius.circular(28); // bottom of the home header
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
  ('label on primary blue', p.onPrimary, p.primary),
  ('label on pressed blue', p.onPrimary, p.primaryPressed),
  ('blue text on muted surface', p.linkText, p.surfaceMuted),
  ('blue link text on surface', p.linkText, p.surface),
  ('blue link text on canvas', p.linkText, p.canvas),
  ('copper text on surface', p.amberText, p.surface),
  ('danger on danger background', p.danger, p.dangerBg),
  ('danger on surface', p.danger, p.surface),
  ('label on danger', p.onDanger, p.danger),
  ('warning on warning background', p.warningText, p.warningBg),
  ('success on success background', p.successText, p.successBg),
  ('info on info background', p.infoText, p.infoBg),
  ('offline on offline background', p.offlineText, p.offlineBg),
  ('snackbar text', p.canvas, p.textPrimary),
  ('greeting on hero, light end', p.onPrimary, p.heroStart),
  ('greeting on hero, dark end', p.onPrimary, p.heroEnd),
  ('small text on hero, light end', p.onHeroMuted, p.heroStart),
  ('small text on hero, dark end', p.onHeroMuted, p.heroEnd),
  for (final t in AccentTone.values)
    ('${t.name} tile icon and label', t.foreground(p), t.background(p)),
];

extension AppPaletteContext on BuildContext {
  /// The colours for the current light or dark theme.
  AppPalette get colors =>
      Theme.of(this).extension<AppPalette>() ?? AppPalette.light;
}
