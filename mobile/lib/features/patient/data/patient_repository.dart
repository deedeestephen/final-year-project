import 'dart:convert';

import '../../../core/db/local_store.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../domain/patient_models.dart';

/// The patient's own data (`/patients/me/...`, `/notifications`). The last
/// good copy of each is kept in the encrypted database so the app can show it
/// offline; it is wiped with everything else at sign-out.
class PatientRepository {
  PatientRepository(this._api, this._store, {DateTime Function()? now})
    : _now = now ?? DateTime.now;

  final ApiClient _api;
  final LocalStore _store;
  final DateTime Function() _now;

  static const _prefix = 'patient.';

  /// Null when the account is not linked to a patient record yet.
  Future<Cached<PatientProfile?>> profile() => _cached(
    'profile',
    () async {
      try {
        return await _api.get<Map<String, dynamic>>('/patients/me');
      } on ApiException catch (e) {
        if (e.code == 'NOT_FOUND') return null;
        rethrow;
      }
    },
    (json) => json == null
        ? null
        : PatientProfile.fromJson(json as Map<String, dynamic>),
  );

  Future<Cached<List<ScreeningRecord>>> records() => _cached(
    'records',
    () => _api.get<List<dynamic>>('/patients/me/clinical-records'),
    (json) => [
      for (final r in (json as List).cast<Map<String, dynamic>>())
        ScreeningRecord.fromJson(r),
    ],
  );

  Future<Cached<List<ConsentItem>>> consents() => _cached(
    'consents',
    () => _api.get<List<dynamic>>('/patients/me/consents'),
    (json) => [
      for (final c in (json as List).cast<Map<String, dynamic>>())
        ConsentItem.fromJson(c),
    ],
  );

  Future<Cached<Inbox>> inbox() => _cached(
    'inbox',
    () => _api.get<Map<String, dynamic>>(
      '/notifications',
      query: {'pageSize': 50},
    ),
    (json) => Inbox.fromJson(json as Map<String, dynamic>),
  );

  Future<void> markRead(String id) =>
      _api.post<Map<String, dynamic>>('/notifications/$id/read');

  Future<void> markAllRead() =>
      _api.post<Map<String, dynamic>>('/notifications/read-all');

  Future<void> withdrawConsent(String id) =>
      _api.post<Map<String, dynamic>>('/patients/me/consents/$id/withdraw');

  /// Creates a patient app account (`POST /auth/register`).
  Future<void> register({
    required String displayName,
    required String email,
    required String password,
    required String phone,
    required String idDocumentType,
    required String idNumber,
  }) => _api.post<Map<String, dynamic>>(
    '/auth/register',
    data: {
      'displayName': displayName.trim(),
      'email': email.trim(),
      'password': password,
      'phone': phone.trim(),
      'idDocumentType': idDocumentType,
      'idNumber': idNumber.trim(),
    },
  );

  Future<Cached<T>> _cached<T>(
    String key,
    Future<Object?> Function() fetch,
    T Function(Object? json) parse,
  ) async {
    try {
      final json = await fetch();
      final now = _now();
      await _store.setMeta(
        '$_prefix$key',
        jsonEncode({'at': now.toUtc().toIso8601String(), 'data': json}),
      );
      return Cached(parse(json), fetchedAt: now);
    } on ApiException catch (e) {
      if (!e.isNetwork) rethrow;
      final saved = await _store.meta('$_prefix$key');
      if (saved == null) rethrow;
      final decoded = jsonDecode(saved) as Map<String, dynamic>;
      return Cached(
        parse(decoded['data']),
        fetchedAt: DateTime.parse(decoded['at'] as String).toLocal(),
        offline: true,
      );
    }
  }
}
