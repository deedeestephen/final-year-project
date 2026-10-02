/// What a push carries for the app: the in-app notification it announces.
class PushNotice {
  const PushNotice({this.type, this.notificationId});

  /// For example `clinical_record.created`.
  final String? type;
  final String? notificationId;
}

/// What the app needs from the phone's push service (Firebase Cloud
/// Messaging, ADR-014). Tests use a fake, so they need no Firebase.
abstract interface class PushMessaging {
  /// Asks to show notifications. Android 13 and later show a question the
  /// first time; older versions allow them already. False: the person said no.
  Future<bool> requestPermission();

  /// This install's push address, or null when there is none (no network).
  Future<String?> token();

  /// A new push address: Firebase renews them now and then.
  Stream<String> get tokenRefreshes;

  /// A push that arrived while the app was open (Android shows none then).
  Stream<PushNotice> get received;

  /// A push the person tapped while the app was in the background.
  Stream<PushNotice> get opened;

  /// The push whose tap started the app, if any.
  Future<PushNotice?> initialNotice();

  /// Drops this install's push address, so nothing more can reach it.
  Future<void> deleteToken();
}
