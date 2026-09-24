import '../../../core/network/api_client.dart';
import '../../../core/storage/token_store.dart';
import '../domain/current_user.dart';

/// Authentication against the backend (`/api/v1/auth`, `/api/v1/users/me`).
class AuthRepository {
  AuthRepository(this._api, this._tokens);

  final ApiClient _api;
  final TokenStore _tokens;

  Future<CurrentUser> login(String email, String password) async {
    final body = await _api.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': email.trim(), 'password': password},
    );
    await _tokens.save(
      StoredTokens(
        accessToken: body['accessToken'] as String,
        refreshToken: body['refreshToken'] as String,
      ),
    );
    // The login response carries a summary; /users/me has the full profile.
    return currentUser();
  }

  /// Restores a previous session on app start, or returns null if there is none.
  Future<CurrentUser?> restore() async {
    if (await _tokens.read() == null) return null;
    return currentUser();
  }

  Future<CurrentUser> currentUser() async =>
      CurrentUser.fromJson(await _api.get<Map<String, dynamic>>('/users/me'));

  /// Revokes the session on the server when reachable; always clears the device.
  Future<void> logout() async {
    try {
      if (await _tokens.read() != null) await _api.post<void>('/auth/logout');
    } catch (_) {
      // Offline or already expired: the local sign-out still happens.
    } finally {
      await _tokens.clear();
    }
  }

  Future<void> changePassword(String currentPassword, String newPassword) =>
      _api.post<void>(
        '/auth/change-password',
        data: {'currentPassword': currentPassword, 'newPassword': newPassword},
      );

  Future<void> forgotPassword(String email) =>
      _api.post<void>('/auth/forgot-password', data: {'email': email.trim()});
}
