import 'dart:typed_data';

import '../../../core/network/api_client.dart';
import 'clinical_server_models.dart';

/// Online-only server calls for consent, imaging, AI analysis and review.
/// (Uploads go through the upload queue so they survive being offline.)
/// `patientId` is always the patient's SERVER id.
class ClinicalServerApi {
  ClinicalServerApi(this._api);

  final ApiClient _api;

  // Consent -------------------------------------------------------------------

  Future<List<StaffConsent>> consents(String patientId) async => [
    for (final c in (await _api.get<List<dynamic>>(
      '/patients/$patientId/consents',
    )).cast<Map<String, dynamic>>())
      StaffConsent.fromJson(c),
  ];

  Future<StaffConsent> grantConsent(
    String patientId, {
    required String type,
    required String method,
    required String textVersion,
  }) async => StaffConsent.fromJson(
    await _api.post<Map<String, dynamic>>(
      '/patients/$patientId/consents',
      data: {'type': type, 'method': method, 'consentTextVersion': textVersion},
    ),
  );

  Future<StaffConsent> withdrawConsent(
    String patientId,
    String consentId,
  ) async => StaffConsent.fromJson(
    await _api.post<Map<String, dynamic>>(
      '/patients/$patientId/consents/$consentId/withdraw',
    ),
  );

  // Imaging and slides -----------------------------------------------------------

  Future<List<ImagingStudy>> imaging(String patientId) async => [
    for (final s in (await _api.get<List<dynamic>>(
      '/patients/$patientId/imaging',
    )).cast<Map<String, dynamic>>())
      ImagingStudy.fromJson(s),
  ];

  Future<List<Specimen>> slides(String patientId) async => [
    for (final s in (await _api.get<List<dynamic>>(
      '/patients/$patientId/histopathology',
    )).cast<Map<String, dynamic>>())
      Specimen.fromJson(s),
  ];

  // AI analysis ----------------------------------------------------------------------

  Future<AiJob> requestAnalysis(String patientId) async => AiJob.fromJson(
    await _api.post<Map<String, dynamic>>('/patients/$patientId/ai-jobs'),
  );

  Future<List<AiJob>> analyses(String patientId) async => [
    for (final j in (await _api.get<List<dynamic>>(
      '/patients/$patientId/ai-jobs',
    )).cast<Map<String, dynamic>>())
      AiJob.fromJson(j),
  ];

  /// Recent analyses in the user's facility.
  Future<List<AiJob>> recentAnalyses() async => [
    for (final j in (await _api.get<List<dynamic>>(
      '/ai-jobs',
    )).cast<Map<String, dynamic>>())
      AiJob.fromJson(j),
  ];

  Future<AiJob> analysis(String jobId) async =>
      AiJob.fromJson(await _api.get<Map<String, dynamic>>('/ai-jobs/$jobId'));

  Future<Uint8List> explanationImage(String artifactId) =>
      _api.download('/explanations/$artifactId/content');

  // Pathologist review ------------------------------------------------------------------

  Future<List<Specimen>> reviewQueue() async => [
    for (final s in (await _api.get<List<dynamic>>(
      '/histopathology/review-queue',
    )).cast<Map<String, dynamic>>())
      Specimen.fromJson(s),
  ];

  Future<Specimen> slide(String id) async => Specimen.fromJson(
    await _api.get<Map<String, dynamic>>('/histopathology/$id'),
  );

  Future<Specimen> review(
    String id, {
    required int primary,
    required int secondary,
  }) async => Specimen.fromJson(
    await _api.post<Map<String, dynamic>>(
      '/histopathology/$id/review',
      data: {'gleasonPrimary': primary, 'gleasonSecondary': secondary},
    ),
  );
}
