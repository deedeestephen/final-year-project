import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../../../core/push/push_providers.dart';
import '../domain/current_user.dart';

/// Where the app is in the sign-in lifecycle.
sealed class SessionState {
  const SessionState();
}

/// Checking for a saved session at start-up.
class SessionRestoring extends SessionState {
  const SessionRestoring();
}

class SignedOut extends SessionState {
  const SignedOut({this.reason});

  /// Why the user was signed out, shown on the login screen (e.g. session expired).
  final String? reason;
}

class SignedIn extends SessionState {
  const SignedIn(this.user);
  final CurrentUser user;
}

class SessionController extends Notifier<SessionState> {
  @override
  SessionState build() {
    Future.microtask(_restore);
    return const SessionRestoring();
  }

  Future<void> _restore() async {
    final auth = ref.read(authRepositoryProvider);
    try {
      final user = await auth.restore();
      if (user == null) {
        state = const SignedOut();
        // A sign-out made offline could not stop this phone's pushes: its
        // push address is dropped now instead (ADR-014).
        unawaited(ref.read(pushRegistrarProvider).forget());
        return;
      }
      await _remember(user);
      state = SignedIn(user);
      _startPush(user);
    } on ApiException catch (e) {
      // A refused refresh has already signed out with its own message.
      if (state is SignedOut) return;
      if (e.isNetwork) {
        // Offline start: continue with the profile saved at the last sign-in,
        // so work can go on without a connection (FR-03).
        final cached = await ref.read(localStoreProvider).cachedUser();
        if (cached != null && await auth.hasSavedSession()) {
          final user = CurrentUser.fromJson(cached);
          state = SignedIn(user);
          _startPush(user);
          return;
        }
      }
      state = SignedOut(
        reason: e.isNetwork ? 'You are offline. Connect to sign in.' : null,
      );
    }
  }

  /// Keeps the device's data for this user only, and remembers the profile
  /// for starting offline.
  Future<void> _remember(CurrentUser user) async {
    final store = ref.read(localStoreProvider);
    await store.prepareFor(user.id);
    await store.cacheUser(user.toJson());
  }

  /// Push notifications for patients (ADR-014), in the background: signing
  /// in never waits for them.
  void _startPush(CurrentUser user) =>
      unawaited(ref.read(pushRegistrarProvider).start(user));

  /// Throws [ApiException] so the login screen can show the exact reason.
  Future<void> signIn(String email, String password) async {
    final user = await ref.read(authRepositoryProvider).login(email, password);
    await _remember(user);
    state = SignedIn(user);
    _startPush(user);
  }

  Future<void> changePassword(String current, String next) async {
    await ref.read(authRepositoryProvider).changePassword(current, next);
    final s = state;
    if (s is SignedIn) {
      final user = s.user.copyWith(mustChangePassword: false);
      await ref.read(localStoreProvider).cacheUser(user.toJson());
      state = SignedIn(user);
    }
  }

  /// Signs out and removes this user's data from the device. The screen
  /// warns first when changes have not been sent yet.
  Future<void> signOut() async {
    // Pushes stop first, while the session can still tell the server.
    await ref.read(pushRegistrarProvider).stop();
    await ref.read(authRepositoryProvider).logout();
    await ref.read(localStoreProvider).wipe();
    state = const SignedOut();
  }

  /// Called by the API client when the server refuses to refresh the session.
  void sessionExpired() {
    unawaited(ref.read(pushRegistrarProvider).forget());
    state = const SignedOut(
      reason: 'Your session has ended. Please sign in again.',
    );
  }
}

final sessionControllerProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);
