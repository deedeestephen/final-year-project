import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/app/app.dart';
import 'package:pca_mhealth/core/connectivity/connectivity_service.dart';
import 'package:pca_mhealth/core/db/app_database.dart';
import 'package:pca_mhealth/core/providers.dart';
import 'package:pca_mhealth/core/storage/token_store.dart';

import 'fakes.dart';
import 'test_db.dart';

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
  AppDatabase? database,
}) => [
  appDatabaseProvider.overrideWithValue(database ?? memoryDatabase()),
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
  AppDatabase? database,
}) async {
  final db = database ?? memoryDatabase();
  addTearDown(db.close);
  // Same logical screen as a Galaxy S9+ at its default resolution.
  tester.view.physicalSize = const Size(1080, 2220);
  tester.view.devicePixelRatio = 2.625;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: testOverrides(
        backend: backend,
        store: store,
        connectivity: connectivity,
        database: db,
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
  /// Scrolls lazily built lists until the widget exists and is on screen.
  Future<Finder> reveal(String key) async {
    final finder = find.byKey(Key(key));
    if (finder.evaluate().isEmpty) {
      await scrollUntilVisible(
        finder,
        200,
        scrollable: find.byType(Scrollable).first,
      );
    }
    await ensureVisible(finder);
    await pump();
    return finder;
  }

  Future<void> enter(String key, String text) async =>
      enterText(await reveal(key), text);

  Future<void> tapKey(String key) async {
    final target = await reveal(key);
    // Let page transitions finish: a route that is still animating in
    // ignores taps.
    await pump(const Duration(milliseconds: 400));
    await tap(target);
    await settle(this);
  }
}
