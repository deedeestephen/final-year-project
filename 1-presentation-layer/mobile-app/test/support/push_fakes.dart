import 'dart:async';

import 'package:pca_mhealth/core/push/push_messaging.dart';

/// The phone's push service, played by the test.
class FakePushMessaging implements PushMessaging {
  FakePushMessaging({this.allow = true, this.address = 'phone-token-1'});

  /// Whether the person allows notifications when asked.
  bool allow;
  String? address;
  PushNotice? initial;
  int permissionAsks = 0;
  int deletedTokens = 0;

  final _refreshes = StreamController<String>.broadcast();
  final _received = StreamController<PushNotice>.broadcast();
  final _opened = StreamController<PushNotice>.broadcast();

  /// Firebase gives the app a new push address.
  void renew(String token) {
    address = token;
    _refreshes.add(token);
  }

  /// A push arrives while the app is open.
  void arrive(PushNotice notice) => _received.add(notice);

  /// The person taps a push.
  void tapPush(PushNotice notice) => _opened.add(notice);

  @override
  Future<bool> requestPermission() async {
    permissionAsks++;
    return allow;
  }

  @override
  Future<String?> token() async => address;

  @override
  Stream<String> get tokenRefreshes => _refreshes.stream;

  @override
  Stream<PushNotice> get received => _received.stream;

  @override
  Stream<PushNotice> get opened => _opened.stream;

  @override
  Future<PushNotice?> initialNotice() async => initial;

  @override
  Future<void> deleteToken() async {
    deletedTokens++;
    // Like Firebase: the next request gets a new address.
    address = 'phone-token-${deletedTokens + 1}';
  }
}
