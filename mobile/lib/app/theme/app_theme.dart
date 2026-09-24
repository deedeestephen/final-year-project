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
  Color color = AppColors.textPrimary,
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

/// Monospaced style for clinical values (PSA, Gleason, IDs): digits align in tables.
TextStyle clinicalValueStyle({double size = 15, Color? color}) => _font(
  AppFonts.mono,
  size,
  FontWeight.w500,
  height: size + 5,
  color: color ?? AppColors.textPrimary,
);

TextTheme _textTheme() {
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
      color: AppColors.textMuted,
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
  );
}

ThemeData buildAppTheme() {
  final text = _textTheme();
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
    colorScheme: const ColorScheme.light(
      primary: AppColors.primary,
      onPrimary: AppColors.onPrimary,
      secondary: AppColors.linkText,
      onSecondary: AppColors.onPrimary,
      error: AppColors.danger,
      onError: AppColors.onPrimary,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      outline: AppColors.borderStrong,
      outlineVariant: AppColors.border,
    ),
    scaffoldBackgroundColor: AppColors.canvas,
    textTheme: text,
    fontFamily: AppFonts.body,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    visualDensity: VisualDensity.standard,
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.primary,
      foregroundColor: AppColors.onPrimary,
      elevation: 0,
      titleTextStyle: text.titleLarge?.copyWith(color: AppColors.onPrimary),
    ),
    cardTheme: const CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(AppRadii.card),
        side: BorderSide(color: AppColors.border),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onPrimary,
        minimumSize: const Size.fromHeight(AppSizes.minTouchTarget),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: controlShape,
        textStyle: text.labelLarge,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        backgroundColor: AppColors.surfaceMuted,
        foregroundColor: AppColors.primary,
        minimumSize: const Size.fromHeight(AppSizes.minTouchTarget),
        side: const BorderSide(color: AppColors.borderStrong),
        shape: controlShape,
        textStyle: text.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.linkText,
        minimumSize: minTarget,
        textStyle: text.labelLarge,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: minTarget),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      // 52 px inputs for one-handed field entry (Option 1 legibility rule).
      constraints: const BoxConstraints(minHeight: AppSizes.inputHeight),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      labelStyle: text.labelLarge?.copyWith(color: AppColors.textSecondary),
      floatingLabelStyle: text.labelMedium?.copyWith(color: AppColors.primary),
      hintStyle: text.bodyMedium?.copyWith(color: AppColors.textMuted),
      helperStyle: text.bodySmall,
      errorStyle: text.bodySmall?.copyWith(color: AppColors.danger),
      border: inputBorder(AppColors.borderStrong, 1.5),
      enabledBorder: inputBorder(AppColors.borderStrong, 1.5),
      focusedBorder: inputBorder(AppColors.positive, 2),
      errorBorder: inputBorder(AppColors.danger, 1.5),
      focusedErrorBorder: inputBorder(AppColors.danger, 2),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.border,
      thickness: 1,
      space: 1,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.textPrimary,
      contentTextStyle: text.bodyMedium?.copyWith(color: AppColors.onPrimary),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
