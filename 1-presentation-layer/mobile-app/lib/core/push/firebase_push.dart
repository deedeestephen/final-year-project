import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../config/app_env.dart';
import 'push_messaging.dart';

/// Push notifications through Firebase Cloud Messaging (ADR-014). Firebase is
/// set up from the build settings (AppEnv), so no google-services.json is
/// needed. Returns null, and push stays off, when the app was built without
/// them or Firebase cannot start: the app works the same without push.
Future<PushMessaging?> startFirebasePush() async {
  if (!AppEnv.pushConfigured) return null;
  try {
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: AppEnv.firebaseApiKey,
        appId: AppEnv.firebaseAppId,
        messagingSenderId: AppEnv.firebaseSenderId,
        projectId: AppEnv.firebaseProjectId,
      ),
    );
    return FirebasePushMessaging(FirebaseMessaging.instance);
  } catch (e) {
    debugPrint('Push notifications are off: Firebase did not start ($e)');
    return null;
  }
}

class FirebasePushMessaging implements PushMessaging {
  FirebasePushMessaging(this._messaging);

  final FirebaseMessaging _messaging;

  @override
  Future<bool> requestPermission() async {
    final settings = await _messaging.requestPermission();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  @override
  Future<String?> token() => _messaging.getToken();

  @override
  Stream<String> get tokenRefreshes => _messaging.onTokenRefresh;

  @override
  Stream<PushNotice> get received => FirebaseMessaging.onMessage.map(_notice);

  @override
  Stream<PushNotice> get opened =>
      FirebaseMessaging.onMessageOpenedApp.map(_notice);

  @override
  Future<PushNotice?> initialNotice() async {
    final message = await _messaging.getInitialMessage();
    return message == null ? null : _notice(message);
  }

  @override
  Future<void> deleteToken() => _messaging.deleteToken();

  static PushNotice _notice(RemoteMessage message) => PushNotice(
    type: message.data['type'] as String?,
    notificationId: message.data['notificationId'] as String?,
  );
}
