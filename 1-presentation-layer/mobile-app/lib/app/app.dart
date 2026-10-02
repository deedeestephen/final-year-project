import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/push/push_providers.dart';
import '../core/push/push_registrar.dart';
import '../core/sync/sync_providers.dart';
import '../features/patient/application/patient_providers.dart';
import '../features/settings/appearance.dart';
import 'router.dart';
import 'routes.dart';
import 'theme/app_theme.dart';
import 'theme/tokens.dart';

class PcaApp extends ConsumerWidget {
  const PcaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Background sync for clinical users (no-op for others).
    ref.watch(syncSchedulerProvider);
    // A push (ADR-014) means a new message: the inbox and its badge are read
    // again, and a tapped push opens the messages.
    ref.listen(pushEventsProvider, (_, next) {
      final event = next.value;
      if (event == null) return;
      ref.invalidate(inboxProvider);
      if (event is PushOpened) ref.read(routerProvider).go(Routes.messages);
    });
    return MaterialApp.router(
      title: 'PCa mHealth',
      theme: buildAppTheme(),
      darkTheme: buildAppTheme(AppPalette.dark),
      themeMode: ref.watch(themeModeProvider),
      routerConfig: ref.watch(routerProvider),
      debugShowCheckedModeBanner: false,
    );
  }
}
