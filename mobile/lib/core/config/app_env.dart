/// Build-time configuration. No secrets are ever compiled into the app:
/// only the API address, set with `--dart-define=API_BASE_URL=...`.
abstract final class AppEnv {
  /// Defaults to the host machine as seen from the Android emulator.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  static String get apiRoot =>
      '${apiBaseUrl.replaceAll(RegExp(r'/+$'), '')}/api/v1';
}
