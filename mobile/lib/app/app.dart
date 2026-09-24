import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/sync/sync_providers.dart';
import 'router.dart';
import 'theme/app_theme.dart';

class PcaApp extends ConsumerWidget {
  const PcaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Background sync for clinical users (no-op for others).
    ref.watch(syncSchedulerProvider);
    return MaterialApp.router(
      title: 'PCa mHealth',
      theme: buildAppTheme(),
      routerConfig: ref.watch(routerProvider),
      debugShowCheckedModeBanner: false,
    );
  }
}
