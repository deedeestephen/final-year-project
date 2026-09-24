import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Whether the device has a network interface. This does not prove the API is
/// reachable; requests still handle `NETWORK_UNAVAILABLE` themselves.
abstract interface class ConnectivityService {
  Future<bool> isOnline();
  Stream<bool> watchOnline();
}

class PlatformConnectivityService implements ConnectivityService {
  PlatformConnectivityService([Connectivity? connectivity])
    : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  static bool _online(List<ConnectivityResult> results) =>
      results.any((r) => r != ConnectivityResult.none);

  @override
  Future<bool> isOnline() async =>
      _online(await _connectivity.checkConnectivity());

  @override
  Stream<bool> watchOnline() =>
      _connectivity.onConnectivityChanged.map(_online).distinct();
}

final connectivityServiceProvider = Provider<ConnectivityService>(
  (ref) => PlatformConnectivityService(),
);

/// Current online state; starts with a one-off check, then follows changes.
final onlineProvider = StreamProvider<bool>((ref) async* {
  final service = ref.watch(connectivityServiceProvider);
  yield await service.isOnline();
  yield* service.watchOnline();
});
