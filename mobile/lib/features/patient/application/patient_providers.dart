import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/patient_repository.dart';
import '../domain/patient_models.dart';

/// No automatic retries: screens show the offline state and a Try again
/// button, and pull-to-refresh reloads.
Duration? _noRetry(int retryCount, Object error) => null;

final patientRepositoryProvider = Provider<PatientRepository>(
  (ref) => PatientRepository(
    ref.watch(apiClientProvider),
    ref.watch(localStoreProvider),
  ),
);

final myProfileProvider = FutureProvider<Cached<PatientProfile?>>(
  (ref) => ref.watch(patientRepositoryProvider).profile(),
  retry: _noRetry,
);

final myRecordsProvider = FutureProvider<Cached<List<ScreeningRecord>>>(
  (ref) => ref.watch(patientRepositoryProvider).records(),
  retry: _noRetry,
);

final myConsentsProvider = FutureProvider<Cached<List<ConsentItem>>>(
  (ref) => ref.watch(patientRepositoryProvider).consents(),
  retry: _noRetry,
);

final inboxProvider = FutureProvider<Cached<Inbox>>(
  (ref) => ref.watch(patientRepositoryProvider).inbox(),
  retry: _noRetry,
);
