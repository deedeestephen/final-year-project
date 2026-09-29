import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../shared/audio/read_aloud.dart';
import '../application/patient_providers.dart';

/// Bottom tabs for the patient app: Home · Results · Learn · Messages · Profile.
class PatientShell extends ConsumerWidget {
  const PatientShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(inboxProvider).value?.value.unreadCount ?? 0;
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        onDestinationSelected: (i) {
          // Changing tab stops anything being read aloud.
          ref.read(readAloudControllerProvider.notifier).stop();
          shell.goBranch(i, initialLocation: i == shell.currentIndex);
        },
        destinations: [
          const NavigationDestination(
            icon: Icon(Symbols.home_rounded),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Symbols.assignment_rounded),
            label: 'Results',
          ),
          const NavigationDestination(
            icon: Icon(Symbols.menu_book_rounded),
            label: 'Learn',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Symbols.mail_rounded),
            ),
            label: 'Messages',
            tooltip: unread > 0 ? 'Messages, $unread unread' : 'Messages',
          ),
          const NavigationDestination(
            icon: Icon(Symbols.person_rounded),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
