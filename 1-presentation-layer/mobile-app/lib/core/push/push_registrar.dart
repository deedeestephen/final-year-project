import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../features/auth/domain/current_user.dart';
import '../network/api_client.dart';
import 'push_messaging.dart';

/// What happened with a push, for the app to react to.
sealed class PushEvent {
  const PushEvent(this.notice);
  final PushNotice notice;
}

/// A push arrived while the app was open.
class PushReceived extends PushEvent {
  const PushReceived(super.notice);
}

/// The person tapped a push.
class PushOpened extends PushEvent {
  const PushOpened(super.notice);
}

/// Registers this phone for the signed-in patient's push notifications, and
/// stops them at sign-out (ADR-014). Only patients get notifications today.
/// Push is optional: every failure here is quiet, and the in-app list of
/// messages works the same without it.
class PushRegistrar {
  PushRegistrar(this._messaging, this._api);

  final PushMessaging? _messaging;
  final ApiClient _api;
  final _events = StreamController<PushEvent>.broadcast();
  final _subscriptions = <StreamSubscription<Object?>>[];

  /// The server's id for this phone, kept to stop its pushes at sign-out.
  String? _deviceId;

  Stream<PushEvent> get events => _events.stream;

  /// After a sign-in, or a session restored at start-up.
  Future<void> start(CurrentUser user) async {
    final messaging = _messaging;
    if (messaging == null || !user.roles.contains(UserRole.patient)) return;
    _cancel();
    try {
      if (!await messaging.requestPermission()) return;
      _subscriptions
        ..add(messaging.tokenRefreshes.listen(_register))
        ..add(messaging.received.listen((n) => _events.add(PushReceived(n))))
        ..add(messaging.opened.listen((n) => _events.add(PushOpened(n))));
      final initial = await messaging.initialNotice();
      if (initial != null) _events.add(PushOpened(initial));
      final token = await messaging.token().timeout(
        const Duration(seconds: 20),
      );
      if (token != null) await _register(token);
    } catch (e) {
      debugPrint('Push registration skipped: $e');
    }
  }

  Future<void> _register(String token) async {
    try {
      final body = await _api.post<Map<String, dynamic>>(
        '/notifications/devices',
        data: {
          'token': token,
          'platform': defaultTargetPlatform == TargetPlatform.iOS
              ? 'ios'
              : 'android',
        },
      );
      _deviceId = body['id'] as String;
    } catch (e) {
      // Offline or refused: registered again at the next start.
      debugPrint('Push registration failed: $e');
    }
  }

  /// Before signing out, while the session is still valid: the server stops
  /// pushing to this phone, and the phone drops its push address.
  Future<void> stop() async {
    _cancel();
    final id = _deviceId;
    _deviceId = null;
    if (id != null) {
      try {
        await _api.delete<void>('/notifications/devices/$id');
      } catch (_) {
        // Offline: dropping the address below still ends the pushes.
      }
    }
    await _dropAddress();
  }

  /// The session ended without a sign-out (it expired), so the server cannot
  /// be told. The phone drops its push address instead; Firebase then reports
  /// it as unknown, and the server forgets the phone at its next push.
  Future<void> forget() async {
    _cancel();
    _deviceId = null;
    await _dropAddress();
  }

  Future<void> _dropAddress() async {
    try {
      await _messaging?.deleteToken();
    } catch (_) {
      // Nothing more can be done offline; Firebase expires unused addresses.
    }
  }

  /// Stops listening at once. The futures that `cancel` returns are not
  /// awaited: nothing waits for them, and in widget tests' fake time they
  /// would never complete.
  void _cancel() {
    for (final s in _subscriptions) {
      unawaited(s.cancel());
    }
    _subscriptions.clear();
  }

  void dispose() {
    _cancel();
    unawaited(_events.close());
  }
}
