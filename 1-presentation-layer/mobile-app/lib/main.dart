import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/app.dart';
import 'core/db/open_database.dart';
import 'core/providers.dart';
import 'features/settings/appearance.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  _registerFontLicences();
  final database = await openAppDatabase();
  final preferences = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(database),
        preferencesProvider.overrideWithValue(preferences),
      ],
      child: const PcaApp(),
    ),
  );
}

/// The bundled fonts are SIL OFL 1.1; their licences appear on the
/// Flutter licence page ("View licences").
void _registerFontLicences() {
  const fonts = {
    'Plus Jakarta Sans': 'assets/fonts/OFL-PlusJakartaSans.txt',
    'Inter': 'assets/fonts/OFL-Inter.txt',
    'JetBrains Mono': 'assets/fonts/OFL-JetBrainsMono.txt',
  };
  LicenseRegistry.addLicense(() async* {
    for (final entry in fonts.entries) {
      yield LicenseEntryWithLineBreaks([
        entry.key,
      ], await rootBundle.loadString(entry.value));
    }
  });
}
