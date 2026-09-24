import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/db/app_database.dart';
import '../../../core/providers.dart';

final patientsProvider = StreamProvider.family<List<LocalPatient>, String>(
  (ref, query) => ref.watch(localStoreProvider).watchPatients(query: query),
);

final patientProvider = StreamProvider.family<LocalPatient?, String>(
  (ref, id) => ref.watch(localStoreProvider).watchPatient(id),
);

final recordsProvider =
    StreamProvider.family<List<LocalClinicalRecord>, String>((ref, id) {
      final patient = ref.watch(patientProvider(id)).value;
      if (patient == null) return Stream.value(const []);
      return ref.watch(localStoreProvider).watchRecords(patient);
    });

final rejectedChangesProvider = StreamProvider<List<OutboxData>>(
  (ref) => ref.watch(localStoreProvider).watchRejected(),
);

final conflictsProvider = StreamProvider<List<SyncConflict>>(
  (ref) => ref.watch(localStoreProvider).watchConflicts(),
);
