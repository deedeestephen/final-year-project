import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/app/app.dart';
import 'package:pca_mhealth/core/connectivity/connectivity_service.dart';
import 'package:pca_mhealth/core/providers.dart';
import 'package:pca_mhealth/core/storage/token_store.dart';

import 'fakes.dart';

/// Connectivity that tests switch on and off.
class FakeConnectivity implements ConnectivityService {
  FakeConnectivity({this.online = true});

  bool online;
  final _changes = StreamController<bool>.broadcast();

  void set(bool value) {
    online = value;
    _changes.add(value);
  }

  @override
  Future<bool> isOnline() async => online;

  @override
  Stream<bool> watchOnline() => _changes.stream;
}

/// Synthetic demo user as returned by `GET /users/me`.
Map<String, dynamic> userJson({
  List<String> roles = const ['CLINICIAN'],
  bool mustChangePassword = false,
}) => {
  'id': 'u-1',
  'email': 'clinician@demo.pca-mhealth.test',
  'displayName': 'Demo Clinician',
  'status': 'ACTIVE',
  'roles': roles,
  'facilityId': 'f-1',
  'mustChangePassword': mustChangePassword,
};

Map<String, dynamic> loginJson(Map<String, dynamic> user) => {
  'accessToken': 'access-new',
  'refreshToken': 'refresh-new',
  'tokenType': 'Bearer',
  'expiresIn': 900,
  'user': user,
};

const savedTokens = StoredTokens(
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
);

/// A fake backend keyed by "METHOD /path". Unscripted routes return 404.
class FakeBackend {
  FakeBackend() {
    adapter = FakeHttpAdapter(_handle);
  }

  late final FakeHttpAdapter adapter;
  final routes = <String, FakeHandler>{};
  bool isOffline = false;

  void on(String route, FakeResponse response) =>
      routes[route] = (_) async => response;

  Future<FakeResponse> _handle(RecordedRequest r) async {
    if (isOffline) offline(r);
    final handler = routes['${r.method} ${r.path}'];
    return handler == null
        ? FakeResponse.error(404, 'NOT_FOUND')
        : await handler(r);
  }

  List<String> get calls =>
      adapter.requests.map((r) => '${r.method} ${r.path}').toList();

  RecordedRequest last(String route) =>
      adapter.requests.lastWhere((r) => '${r.method} ${r.path}' == route);
}

List<Override> testOverrides({
  required FakeBackend backend,
  required InMemoryTokenStore store,
  FakeConnectivity? connectivity,
}) => [
  tokenStoreProvider.overrideWithValue(store),
  httpAdapterProvider.overrideWithValue(backend.adapter),
  connectivityServiceProvider.overrideWithValue(
    connectivity ?? FakeConnectivity(),
  ),
];

/// Pumps the full app (router, theme, session) against the fake backend.
Future<void> pumpApp(
  WidgetTester tester, {
  required FakeBackend backend,
  required InMemoryTokenStore store,
  FakeConnectivity? connectivity,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: testOverrides(
        backend: backend,
        store: store,
        connectivity: connectivity,
      ),
      child: const PcaApp(),
    ),
  );
  await settle(tester);
}

/// pumpAndSettle with a bound: spinners animate forever.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 20; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

extension FormHelpers on WidgetTester {
  Future<void> enter(String key, String text) =>
      enterText(find.byKey(Key(key)), text);

  Future<void> tapKey(String key) async {
    await ensureVisible(find.byKey(Key(key)));
    await tap(find.byKey(Key(key)));
    await settle(this);
  }
}
