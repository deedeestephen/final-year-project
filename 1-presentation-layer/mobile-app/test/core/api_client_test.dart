import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/core/network/api_client.dart';
import 'package:pca_mhealth/core/network/api_exception.dart';
import 'package:pca_mhealth/core/storage/token_store.dart';

import '../support/fakes.dart';

void main() {
  late InMemoryTokenStore store;
  late FakeHttpAdapter server;
  late ApiClient client;
  late int expiredCalls;

  const oldTokens = StoredTokens(
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
  );

  ApiClient build() => ApiClient(
    baseUrl: 'http://test/api/v1',
    tokenStore: store,
    adapter: server,
    onSessionExpired: () => expiredCalls++,
  );

  setUp(() {
    store = InMemoryTokenStore()..tokens = oldTokens;
    expiredCalls = 0;
    server = FakeHttpAdapter((_) async => const FakeResponse(200, {}));
    client = build();
  });

  test('sends the access token as a bearer header', () async {
    server.handler = (r) async =>
        FakeResponse(200, {'auth': r.headers['Authorization']});
    final body = await client.get<Map<String, dynamic>>('/users/me');
    expect(body['auth'], 'Bearer access-1');
  });

  test('tells the server it is the phone app (and nothing more)', () async {
    await client.get<Map<String, dynamic>>('/users/me');
    await client.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': 'a', 'password': 'b'},
    );
    for (final r in server.requests) {
      expect(r.headers['X-Client'], 'mobile');
    }
  });

  test('does not attach the token to public auth routes', () async {
    await client.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': 'a', 'password': 'b'},
    );
    expect(
      server.requests.single.headers.containsKey('Authorization'),
      isFalse,
    );
  });

  test('parses the backend error envelope into ApiException', () async {
    server.handler = (_) async => const FakeResponse(400, {
      'error': {
        'status': 400,
        'code': 'VALIDATION_FAILED',
        'message': 'Request validation failed',
        'details': [
          {
            'field': 'psaNgMl',
            'errors': ['psaNgMl must not be less than 0'],
          },
        ],
        'requestId': 'req-42',
      },
    });
    final error = await client
        .post<dynamic>('/patients/x/clinical-records', data: {})
        .then<Object?>((_) => null, onError: (Object e) => e);
    expect(error, isA<ApiException>());
    final api = error! as ApiException;
    expect(api.code, 'VALIDATION_FAILED');
    expect(api.status, 400);
    expect(api.requestId, 'req-42');
    expect(api.fieldErrors, {
      'psaNgMl': ['psaNgMl must not be less than 0'],
    });
  });

  test('reports a network failure distinctly (offline)', () async {
    server.handler = offline;
    await expectLater(
      client.get<dynamic>('/users/me'),
      throwsA(
        isA<ApiException>().having((e) => e.isNetwork, 'isNetwork', isTrue),
      ),
    );
  });

  test(
    'refreshes an expired session once, rotates the tokens and retries',
    () async {
      server.handler = (r) async {
        if (r.path == '/auth/refresh') {
          expect(r.body, {'refreshToken': 'refresh-1'});
          return const FakeResponse(200, {
            'accessToken': 'access-2',
            'refreshToken': 'refresh-2',
          });
        }
        return r.headers['Authorization'] == 'Bearer access-2'
            ? const FakeResponse(200, {'ok': true})
            : FakeResponse.error(401, 'INVALID_TOKEN');
      };
      final body = await client.get<Map<String, dynamic>>('/users/me');
      expect(body, {'ok': true});
      expect(store.tokens!.accessToken, 'access-2');
      expect(store.tokens!.refreshToken, 'refresh-2');
      expect(
        server.requests.where((r) => r.path == '/auth/refresh'),
        hasLength(1),
      );
    },
  );

  test('concurrent 401s share a single refresh', () async {
    var refreshes = 0;
    server.handler = (r) async {
      if (r.path == '/auth/refresh') {
        refreshes++;
        return const FakeResponse(200, {
          'accessToken': 'access-2',
          'refreshToken': 'refresh-2',
        });
      }
      return r.headers['Authorization'] == 'Bearer access-2'
          ? FakeResponse(200, {'path': r.path})
          : FakeResponse.error(401, 'INVALID_TOKEN');
    };
    final results = await Future.wait([
      client.get<Map<String, dynamic>>('/users/me'),
      client.get<Map<String, dynamic>>('/patients'),
      client.get<Map<String, dynamic>>('/notifications'),
    ]);
    expect(results.map((r) => r['path']), [
      '/users/me',
      '/patients',
      '/notifications',
    ]);
    expect(refreshes, 1);
  });

  test('signs out when the refresh token is rejected', () async {
    server.handler = (r) async => r.path == '/auth/refresh'
        ? FakeResponse.error(401, 'INVALID_TOKEN')
        : FakeResponse.error(401, 'INVALID_TOKEN');
    await expectLater(
      client.get<dynamic>('/users/me'),
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', 'INVALID_TOKEN'),
      ),
    );
    expect(store.tokens, isNull);
    expect(expiredCalls, 1);
  });

  test(
    'keeps the session when the refresh fails only because the device is offline',
    () async {
      server.handler = (r) async {
        if (r.path == '/auth/refresh') offline(r);
        return FakeResponse.error(401, 'INVALID_TOKEN');
      };
      await expectLater(
        client.get<dynamic>('/users/me'),
        throwsA(
          isA<ApiException>().having((e) => e.isNetwork, 'isNetwork', isTrue),
        ),
      );
      expect(store.tokens, isNotNull);
      expect(expiredCalls, 0);
    },
  );

  test(
    'does not refresh on other 401s, such as wrong login credentials',
    () async {
      server.handler = (_) async =>
          FakeResponse.error(401, 'INVALID_CREDENTIALS');
      await expectLater(
        client.post<dynamic>('/auth/login', data: {}),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'INVALID_CREDENTIALS',
          ),
        ),
      );
      expect(server.requests.where((r) => r.path == '/auth/refresh'), isEmpty);
    },
  );

  test('retries only once if the refreshed token is still rejected', () async {
    server.handler = (r) async => r.path == '/auth/refresh'
        ? const FakeResponse(200, {
            'accessToken': 'access-2',
            'refreshToken': 'refresh-2',
          })
        : FakeResponse.error(401, 'INVALID_TOKEN');
    await expectLater(
      client.get<dynamic>('/users/me'),
      throwsA(isA<ApiException>()),
    );
    expect(server.requests.where((r) => r.path == '/users/me'), hasLength(2));
  });

  test('handles non-envelope server errors safely', () async {
    server.handler = (_) async => const FakeResponse(502, 'Bad Gateway');
    await expectLater(
      client.get<dynamic>('/users/me'),
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', ApiException.unknown),
      ),
    );
  });
}
