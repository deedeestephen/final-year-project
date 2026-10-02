import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import 'push_messaging.dart';
import 'push_registrar.dart';

/// The phone's push service; null (push off) unless `main()` started
/// Firebase from the build settings. Tests supply a fake.
final pushMessagingProvider = Provider<PushMessaging?>((ref) => null);

final pushRegistrarProvider = Provider<PushRegistrar>((ref) {
  final registrar = PushRegistrar(
    ref.watch(pushMessagingProvider),
    ref.watch(apiClientProvider),
  );
  ref.onDispose(registrar.dispose);
  return registrar;
});

/// Pushes that arrive while the app is open, and taps on pushes.
final pushEventsProvider = StreamProvider<PushEvent>(
  (ref) => ref.watch(pushRegistrarProvider).events,
);
