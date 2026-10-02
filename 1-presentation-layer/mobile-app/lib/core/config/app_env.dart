/// Build-time configuration. No secrets are ever compiled into the app: only
/// the API address (`--dart-define=API_BASE_URL=...`) and, for push
/// notifications, the public identifiers of the owner's Firebase project.
abstract final class AppEnv {
  /// Defaults to the host machine as seen from the Android emulator.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  /// Where administrators manage the system (a separate web app).
  static const adminPortalUrl = String.fromEnvironment(
    'ADMIN_PORTAL_URL',
    defaultValue: 'http://localhost:5173',
  );

  static String get apiRoot =>
      '${apiBaseUrl.replaceAll(RegExp(r'/+$'), '')}/api/v1';

  /// Push notifications (ADR-014): the app's settings from the Firebase
  /// console, given with `--dart-define-from-file=firebase-app.json`. They
  /// identify the app to Firebase and are not secrets. Empty: push is off.
  static const firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const firebaseAppId = String.fromEnvironment('FIREBASE_APP_ID');
  static const firebaseSenderId = String.fromEnvironment('FIREBASE_SENDER_ID');
  static const firebaseProjectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
  );

  static bool get pushConfigured => [
    firebaseApiKey,
    firebaseAppId,
    firebaseSenderId,
    firebaseProjectId,
  ].every((v) => v.isNotEmpty);
}
