import 'package:dio/dio.dart';

import '../storage/token_store.dart';
import 'api_exception.dart';

/// Called when the session cannot be refreshed and the user must sign in again.
typedef SessionExpiredCallback = void Function();

/// HTTP client for the PCa mHealth API (`/api/v1`).
///
/// - Adds the access token to every request.
/// - On `401 INVALID_TOKEN`, refreshes the session once (refresh-token
///   rotation) and retries the request. Concurrent failures share a single
///   refresh because [QueuedInterceptor] handles errors one at a time.
/// - If the refresh fails, clears the stored tokens and reports session expiry.
/// - Errors are converted to [ApiException].
class ApiClient {
  ApiClient({
    required String baseUrl,
    required TokenStore tokenStore,
    SessionExpiredCallback? onSessionExpired,
    HttpClientAdapter? adapter,
  }) : _tokens = tokenStore {
    final options = BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      contentType: Headers.jsonContentType,
      responseType: ResponseType.json,
    );
    dio = Dio(options);
    // A client with no interceptors: token refresh and the single retry after
    // it. Retrying through `dio` would queue behind the QueuedInterceptor that
    // is handling the error and deadlock.
    _plainDio = Dio(options);
    if (adapter != null) {
      dio.httpClientAdapter = adapter;
      _plainDio.httpClientAdapter = adapter;
    }
    dio.interceptors.add(_AuthInterceptor(this, onSessionExpired ?? () {}));
  }

  late final Dio dio;
  late final Dio _plainDio;
  final TokenStore _tokens;

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) =>
      _send(() => dio.get<T>(path, queryParameters: query));

  Future<T> post<T>(String path, {Object? data}) =>
      _send(() => dio.post<T>(path, data: data));

  Future<T> patch<T>(String path, {Object? data}) =>
      _send(() => dio.patch<T>(path, data: data));

  Future<T> put<T>(String path, {Object? data}) =>
      _send(() => dio.put<T>(path, data: data));

  Future<T> _send<T>(Future<Response<T>> Function() request) async {
    try {
      final response = await request();
      return response.data as T;
    } on DioException catch (e) {
      final inner = e.error;
      if (inner is ApiException) throw inner;
      throw ApiException.fromDio(e);
    }
  }

  /// Exchanges the stored refresh token for a new pair. Returns the new
  /// access token, or null when the session is no longer valid.
  Future<String?> refreshSession() async {
    final stored = await _tokens.read();
    if (stored == null) return null;
    try {
      final res = await _plainDio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': stored.refreshToken},
      );
      final body = res.data!;
      final access = body['accessToken'] as String;
      await _tokens.save(
        StoredTokens(
          accessToken: access,
          refreshToken: body['refreshToken'] as String,
        ),
      );
      return access;
    } on DioException catch (e) {
      final error = ApiException.fromDio(e);
      // Keep the session when merely offline; drop it when the server refused it.
      if (error.isNetwork) throw error;
      await _tokens.clear();
      return null;
    }
  }
}

class _AuthInterceptor extends QueuedInterceptor {
  _AuthInterceptor(this.client, this.onSessionExpired);

  final ApiClient client;
  final SessionExpiredCallback onSessionExpired;
  static const _retried = 'pca.retriedAfterRefresh';

  /// Public auth routes: a 401 there means bad credentials, not an expired session.
  static const _publicAuthPaths = {
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
  };

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final tokens = await client._tokens.read();
    if (tokens != null && !_publicAuthPaths.contains(options.path)) {
      options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final request = err.requestOptions;
    final data = err.response?.data;
    final code = data is Map && data['error'] is Map
        ? (data['error'] as Map)['code']
        : null;
    final shouldRefresh =
        err.response?.statusCode == 401 &&
        code == 'INVALID_TOKEN' &&
        request.extra[_retried] != true &&
        !_publicAuthPaths.contains(request.path);
    if (!shouldRefresh) return handler.next(err);

    try {
      // If another request already refreshed while this one waited, reuse it.
      final sentWith = request.headers['Authorization'];
      final current = await client._tokens.read();
      String? access;
      if (current != null && sentWith != 'Bearer ${current.accessToken}') {
        access = current.accessToken;
      } else {
        access = await client.refreshSession();
      }
      if (access == null) {
        onSessionExpired();
        return handler.next(err);
      }
      request.headers['Authorization'] = 'Bearer $access';
      request.extra[_retried] = true;
      final retried = await client._plainDio.fetch<dynamic>(request);
      return handler.resolve(retried);
    } on ApiException catch (e) {
      return handler.next(
        DioException(
          requestOptions: request,
          error: e,
          type: DioExceptionType.unknown,
        ),
      );
    } on DioException catch (e) {
      return handler.next(e);
    }
  }
}
