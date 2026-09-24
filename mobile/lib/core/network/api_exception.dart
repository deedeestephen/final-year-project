import 'package:dio/dio.dart';

/// A typed error from the backend's envelope
/// `{ "error": { status, code, message, details?, requestId } }`,
/// or a local network failure.
class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.message,
    this.status,
    this.details,
    this.requestId,
  });

  /// No response from the server (offline, DNS failure, refused connection, timeout).
  static const networkUnavailable = 'NETWORK_UNAVAILABLE';
  static const unknown = 'UNKNOWN';

  final String code;
  final String message;
  final int? status;
  final Object? details;
  final String? requestId;

  bool get isNetwork => code == networkUnavailable;

  /// Field-level messages from a VALIDATION_FAILED response, keyed by field.
  Map<String, List<String>> get fieldErrors {
    final result = <String, List<String>>{};
    final list = details;
    if (list is List) {
      for (final item in list) {
        if (item is Map && item['field'] is String) {
          final errors = item['errors'];
          result[item['field'] as String] = errors is List
              ? errors.whereType<String>().toList()
              : const [];
        }
      }
    }
    return result;
  }

  factory ApiException.fromDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return const ApiException(
          code: networkUnavailable,
          message: 'Cannot reach the server. Check your connection.',
        );
      default:
        break;
    }
    final response = e.response;
    final data = response?.data;
    if (data is Map && data['error'] is Map) {
      final error = data['error'] as Map;
      return ApiException(
        code: error['code'] is String ? error['code'] as String : unknown,
        message: error['message'] is String
            ? error['message'] as String
            : 'Something went wrong',
        status: error['status'] is int
            ? error['status'] as int
            : response?.statusCode,
        details: error['details'],
        requestId: error['requestId'] is String
            ? error['requestId'] as String
            : null,
      );
    }
    return ApiException(
      code: unknown,
      message: 'Something went wrong. Please try again.',
      status: response?.statusCode,
    );
  }

  @override
  String toString() => 'ApiException($code, $status): $message';
}
