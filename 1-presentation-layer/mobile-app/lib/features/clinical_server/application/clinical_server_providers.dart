import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/db/app_database.dart';
import '../../../core/providers.dart';
import '../data/clinical_server_api.dart';
import '../data/clinical_server_models.dart';

final clinicalServerApiProvider = Provider<ClinicalServerApi>(
  (ref) => ClinicalServerApi(ref.watch(apiClientProvider)),
);

/// All keyed by the patient's SERVER id. Screens invalidate them after changes.
final staffConsentsProvider = FutureProvider.autoDispose
    .family<List<StaffConsent>, String>(
      (ref, patientId) =>
          ref.watch(clinicalServerApiProvider).consents(patientId),
    );

final imagingProvider = FutureProvider.autoDispose
    .family<List<ImagingStudy>, String>(
      (ref, patientId) =>
          ref.watch(clinicalServerApiProvider).imaging(patientId),
    );

final slidesProvider = FutureProvider.autoDispose
    .family<List<Specimen>, String>(
      (ref, patientId) =>
          ref.watch(clinicalServerApiProvider).slides(patientId),
    );

final analysesProvider = FutureProvider.autoDispose.family<List<AiJob>, String>(
  (ref, patientId) => ref.watch(clinicalServerApiProvider).analyses(patientId),
);

final recentAnalysesProvider = FutureProvider.autoDispose<List<AiJob>>(
  (ref) => ref.watch(clinicalServerApiProvider).recentAnalyses(),
);

final analysisProvider = FutureProvider.autoDispose.family<AiJob, String>(
  (ref, jobId) => ref.watch(clinicalServerApiProvider).analysis(jobId),
);

final reviewQueueProvider = FutureProvider.autoDispose<List<Specimen>>(
  (ref) => ref.watch(clinicalServerApiProvider).reviewQueue(),
);

final slideProvider = FutureProvider.autoDispose.family<Specimen, String>(
  (ref, id) => ref.watch(clinicalServerApiProvider).slide(id),
);

/// Files waiting to upload for one patient (server id), live.
final pendingUploadsProvider = StreamProvider.autoDispose
    .family<List<PendingUpload>, String>(
      (ref, patientId) =>
          ref.watch(uploadQueueProvider).watchForPatient(patientId),
    );

/// A chosen file: where it is now and what it is called.
class PickedFile {
  const PickedFile(this.path, this.name);
  final String path;
  final String name;
}

/// Opens the phone's file chooser. The device test overrides this with a
/// fixed synthetic file, because the system chooser cannot be driven.
final filePickerProvider = Provider<Future<PickedFile?> Function()>(
  (ref) => () async {
    final result = await FilePicker.pickFiles();
    final file = result?.files.singleOrNull;
    final path = file?.path;
    return path == null ? null : PickedFile(path, file!.name);
  },
);
