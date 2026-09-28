import 'package:flutter/material.dart';

import 'tokens.dart';

/// Variable fonts: set both the weight and the matching `wght` axis so the
/// rendered weight is correct on every platform.
TextStyle _font(
  String family,
  double size,
  FontWeight weight, {
  double? height,
  double? letterSpacing,
  Color? color,
}) {
  return TextStyle(
    fontFamily: family,
    fontSize: size,
    fontWeight: weight,
    fontVariations: [FontVariation.weight(weight.value.toDouble())],
    height: height == null ? null : height / size,
    letterSpacing: letterSpacing,
    color: color,
  );
}

/// Monospaced style for clinical values (PSA, Gleason, IDs): digits align in
/// tables. Without a colour it takes the surrounding text colour, so it
/// works in light and dark mode.
TextStyle clinicalValueStyle({double size = 15, Color? color}) =>
    _font(AppFonts.mono, size, FontWeight.w500, height: size + 5, color: color);

TextTheme _textTheme(AppPalette p) {
  return TextTheme(
    displaySmall: _font(
      AppFonts.heading,
      28,
      FontWeight.w700,
      height: 36,
      letterSpacing: -0.5,
    ),
    headlineMedium: _font(
      AppFonts.heading,
      24,
      FontWeight.w700,
      height: 32,
      letterSpacing: -0.3,
    ),
    headlineSmall: _font(AppFonts.heading, 20, FontWeight.w600, height: 28),
    titleLarge: _font(AppFonts.heading, 18, FontWeight.w600, height: 24),
    titleMedium: _font(AppFonts.body, 16, FontWeight.w600, height: 24),
    bodyLarge: _font(AppFonts.body, 16, FontWeight.w400, height: 24),
    bodyMedium: _font(
      AppFonts.body,
      AppSizes.bodyMin,
      FontWeight.w400,
      height: 22,
    ),
    bodySmall: _font(
      AppFonts.body,
      AppSizes.metaText,
      FontWeight.w500,
      height: 18,
      color: p.textMuted,
    ),
    labelLarge: _font(
      AppFonts.body,
      AppSizes.bodyMin,
      FontWeight.w600,
      height: 20,
    ),
    labelMedium: _font(
      AppFonts.body,
      AppSizes.metaText,
      FontWeight.w600,
      height: 18,
    ),
    labelSmall: _font(
      AppFonts.body,
      11,
      FontWeight.w700,
      height: 16,
      letterSpacing: 0.55,
    ),
  ).apply(bodyColor: p.textPrimary, displayColor: p.textPrimary);
}

/// The app theme for one palette: [AppPalette.light] or [AppPalette.dark].
ThemeData buildAppTheme([AppPalette p = AppPalette.light]) {
  final base = _textTheme(p);
  final text = base.copyWith(
    bodySmall: base.bodySmall?.copyWith(color: p.textMuted),
  );
  const controlShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.all(AppRadii.control),
  );
  const minTarget = Size(AppSizes.minTouchTarget, AppSizes.minTouchTarget);

  OutlineInputBorder inputBorder(Color color, double width) =>
      OutlineInputBorder(
        borderRadius: const BorderRadius.all(AppRadii.control),
        borderSide: BorderSide(color: color, width: width),
      );

  return ThemeData(
    useMaterial3: true,
    brightness: p.brightness,
    extensions: [p],
    colorScheme: ColorScheme(
      brightness: p.brightness,
      primary: p.primary,
      onPrimary: p.onPrimary,
      secondary: p.linkText,
      onSecondary: p.canvas,
      error: p.danger,
      onError: p.onDanger,
      surface: p.surface,
      onSurface: p.textPrimary,
      onSurfaceVariant: p.textSecondary,
      surfaceContainerHighest: p.surfaceMuted,
      outline: p.borderStrong,
      outlineVariant: p.border,
    ),
    scaffoldBackgroundColor: p.canvas,
    textTheme: text,
    fontFamily: AppFonts.body,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    visualDensity: VisualDensity.standard,
    appBarTheme: AppBarTheme(
      backgroundColor: p.primary,
      foregroundColor: p.onPrimary,
      elevation: 0,
      titleTextStyle: text.titleLarge?.copyWith(color: p.onPrimary),
    ),
    cardTheme: CardThemeData(
      color: p.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(AppRadii.card),
        side: BorderSide(color: p.border),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: p.primary,
        foregroundColor: p.onPrimary,
        minimumSize: const Size.fromHeight(AppSizes.minTouchTarget),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: controlShape,
        textStyle: text.labelLarge,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        backgroundColor: p.surfaceMuted,
        foregroundColor: p.linkText,
        minimumSize: const Size.fromHeight(AppSizes.minTouchTarget),
        side: BorderSide(color: p.borderStrong),
        shape: controlShape,
        textStyle: text.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: p.linkText,
        minimumSize: minTarget,
        textStyle: text.labelLarge,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: minTarget),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.surface,
      // 52 px inputs for one-handed field entry (Option 1 legibility rule).
      constraints: const BoxConstraints(minHeight: AppSizes.inputHeight),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      labelStyle: text.labelLarge?.copyWith(color: p.textSecondary),
      floatingLabelStyle: text.labelMedium?.copyWith(color: p.linkText),
      hintStyle: text.bodyMedium?.copyWith(color: p.textMuted),
      helperStyle: text.bodySmall,
      errorStyle: text.bodySmall?.copyWith(color: p.danger),
      border: inputBorder(p.borderStrong, 1.5),
      enabledBorder: inputBorder(p.borderStrong, 1.5),
      focusedBorder: inputBorder(p.positive, 2),
      errorBorder: inputBorder(p.danger, 1.5),
      focusedErrorBorder: inputBorder(p.danger, 2),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: p.primary,
      foregroundColor: p.onPrimary,
      elevation: p.brightness == Brightness.dark ? 1 : 3,
    ),
    drawerTheme: DrawerThemeData(backgroundColor: p.surface),
    dialogTheme: DialogThemeData(backgroundColor: p.surface),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: p.surface),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.surface,
      indicatorColor: p.surfaceMuted,
    ),
    listTileTheme: ListTileThemeData(
      iconColor: p.textSecondary,
      textColor: p.textPrimary,
      selectedColor: p.linkText,
    ),
    dividerTheme: DividerThemeData(color: p.border, thickness: 1, space: 1),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: p.textPrimary,
      contentTextStyle: text.bodyMedium?.copyWith(color: p.canvas),
      actionTextColor: p.canvas,
      behavior: SnackBarBehavior.floating,
    ),
  );
}
