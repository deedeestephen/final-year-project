import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Phone-level preferences (not patient data), loaded in `main()` before the
/// first frame so the app never flashes the wrong theme. Null in tests: the
/// choice then lives in memory only.
final preferencesProvider = Provider<SharedPreferences?>((_) => null);

const _themeKey = 'appearance.themeMode';

/// Light, dark, or the same as the phone. Kept across sign-out, because it
/// belongs to the phone, not to an account.
final themeModeProvider = NotifierProvider<ThemeModeController, ThemeMode>(
  ThemeModeController.new,
);

class ThemeModeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    final saved = ref.watch(preferencesProvider)?.getString(_themeKey);
    return ThemeMode.values.firstWhere(
      (m) => m.name == saved,
      orElse: () => ThemeMode.system,
    );
  }

  Future<void> choose(ThemeMode mode) async {
    state = mode;
    await ref.read(preferencesProvider)?.setString(_themeKey, mode.name);
  }
}
