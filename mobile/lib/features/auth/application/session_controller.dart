import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
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
    try {
      final user = await ref.read(authRepositoryProvider).restore();
      state = user == null ? const SignedOut() : SignedIn(user);
    } on ApiException catch (e) {
      // A refused refresh has already signed out with its own message.
      if (state is SignedOut) return;
      // Offline at start-up: the saved session is kept but cannot be verified yet.
      state = SignedOut(
        reason: e.isNetwork ? 'You are offline. Connect to sign in.' : null,
      );
    }
  }

  /// Throws [ApiException] so the login screen can show the exact reason.
  Future<void> signIn(String email, String password) async {
    final user = await ref.read(authRepositoryProvider).login(email, password);
    state = SignedIn(user);
  }

  Future<void> changePassword(String current, String next) async {
    await ref.read(authRepositoryProvider).changePassword(current, next);
    final s = state;
    if (s is SignedIn) {
      state = SignedIn(s.user.copyWith(mustChangePassword: false));
    }
  }

  Future<void> signOut() async {
    await ref.read(authRepositoryProvider).logout();
    state = const SignedOut();
  }

  /// Called by the API client when the server refuses to refresh the session.
  void sessionExpired() {
    state = const SignedOut(
      reason: 'Your session has ended. Please sign in again.',
    );
  }
}

final sessionControllerProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);
