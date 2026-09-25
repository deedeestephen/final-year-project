import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:pca_mhealth/core/storage/token_store.dart';

/// In-memory [TokenStore] for tests.
class InMemoryTokenStore implements TokenStore {
  StoredTokens? tokens;

  @override
  Future<StoredTokens?> read() async => tokens;

  @override
  Future<void> save(StoredTokens value) async => tokens = value;

  @override
  Future<void> clear() async => tokens = null;
}

/// A recorded request as seen by the fake server.
class RecordedRequest {
  RecordedRequest(this.method, this.path, this.headers, this.body);
  final String method;
  final String path;
  final Map<String, dynamic> headers;
  final Object? body;
}

class FakeResponse {
  const FakeResponse(this.status, [this.body, this.headers = const {}]);
  final int status;
  final Object? body;
  final Map<String, String> headers;

  static FakeResponse error(
    int status,
    String code, [
    String message = 'error',
  ]) => FakeResponse(status, {
    'error': {
      'status': status,
      'code': code,
      'message': message,
      'requestId': 'req-1',
    },
  });
}

typedef FakeHandler = Future<FakeResponse> Function(RecordedRequest request);

/// A scripted HTTP backend for Dio. Throwing [DioExceptionType.connectionError]
/// from the handler simulates being offline.
class FakeHttpAdapter implements HttpClientAdapter {
  FakeHttpAdapter(this.handler);

  FakeHandler handler;
  final requests = <RecordedRequest>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    Object? body;
    if (requestStream != null) {
      final bytes = await requestStream.expand((c) => c).toList();
      body = bytes.isEmpty ? null : jsonDecode(utf8.decode(bytes));
    }
    final request = RecordedRequest(
      options.method,
      options.path,
      Map.of(options.headers),
      body,
    );
    requests.add(request);
    final response = await handler(request);
    return ResponseBody.fromString(
      response.body == null ? '' : jsonEncode(response.body),
      response.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
        for (final h in response.headers.entries) h.key: [h.value],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Never offline(RecordedRequest request) => throw DioException(
  requestOptions: RequestOptions(path: request.path),
  type: DioExceptionType.connectionError,
  message: 'offline',
);
