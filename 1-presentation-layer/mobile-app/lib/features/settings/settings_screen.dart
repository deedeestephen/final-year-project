import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../app/theme/tokens.dart';
import 'appearance.dart';

/// Settings for this phone. Today: appearance (light, dark, or as the phone).
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  static const _choices = [
    (
      ThemeMode.system,
      Symbols.brightness_auto_rounded,
      'Same as the phone',
      'Follows the phone\'s own light or dark setting',
    ),
    (
      ThemeMode.light,
      Symbols.light_mode_rounded,
      'Light',
      'Dark text on light',
    ),
    (
      ThemeMode.dark,
      Symbols.dark_mode_rounded,
      'Dark',
      'Light text on dark; easier on the eyes at night',
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(themeModeProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(AppSizes.md),
        children: [
          Text('Appearance', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSizes.sm),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (final (mode, icon, title, subtitle) in _choices)
                  ListTile(
                    key: Key('settings.theme.${mode.name}'),
                    leading: Icon(icon),
                    title: Text(title),
                    subtitle: Text(subtitle),
                    selected: mode == current,
                    trailing: mode == current
                        ? Icon(
                            Symbols.check_rounded,
                            color: context.colors.linkText,
                            semanticLabel: 'Selected',
                          )
                        : null,
                    onTap: () =>
                        ref.read(themeModeProvider.notifier).choose(mode),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSizes.sm),
          Text(
            'Saved on this phone. Clinical values and warnings keep the same '
            'meaning and readable contrast in both modes.',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
