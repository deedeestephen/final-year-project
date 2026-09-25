@Tags(['live'])
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/core/network/api_client.dart';
import 'package:pca_mhealth/features/auth/data/auth_repository.dart';
import 'package:pca_mhealth/features/auth/domain/current_user.dart';

import '../support/fakes.dart';

/// Opt-in check of the app's auth layer against a running local backend.
/// Skipped unless LIVE_API_URL and LIVE_API_PASSWORD are set, e.g.
///   LIVE_API_URL=http://localhost:3000 LIVE_API_PASSWORD=... \
///     flutter test test/live
/// It never changes the demo password, so the seeded accounts stay usable.
void main() {
  final baseUrl = Platform.environment['LIVE_API_URL'];
  final password = Platform.environment['LIVE_API_PASSWORD'];
  final email =
      Platform.environment['LIVE_API_EMAIL'] ??
      'clinician@demo.pca-mhealth.test';
  final skip = baseUrl == null || password == null
      ? 'set LIVE_API_URL and LIVE_API_PASSWORD to run'
      : null;

  test('sign in, load profile, rotate tokens, sign out', () async {
    final store = InMemoryTokenStore();
    var expired = false;
    final api = ApiClient(
      baseUrl: '$baseUrl/api/v1',
      tokenStore: store,
      onSessionExpired: () => expired = true,
    );
    final repo = AuthRepository(api, store);

    final user = await repo.login(email, password!);
    expect(user.email, email);
    expect(user.roles, contains(UserRole.clinician));

    final before = store.tokens!;
    expect(await api.refreshSession(), isNotNull);
    expect(store.tokens!.refreshToken, isNot(before.refreshToken));
    expect((await repo.currentUser()).id, user.id);

    await repo.logout();
    expect(store.tokens, isNull);
    expect(expired, isFalse);
  }, skip: skip);
}
