import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../data/chat_api.dart';

final chatApiProvider = Provider<ChatApi>(
  (ref) => ChatApi(ref.watch(apiClientProvider)),
);

class ChatState {
  const ChatState({
    this.conversationId,
    this.messages = const [],
    this.sending = false,
    this.loading = false,
    this.error,
  });

  final String? conversationId;
  final List<ChatMessage> messages;
  final bool sending;

  /// True while an earlier conversation is being opened.
  final bool loading;

  /// Plain words about the last failure, shown above the input.
  final String? error;

  ChatState copyWith({
    String? conversationId,
    List<ChatMessage>? messages,
    bool? sending,
    bool? loading,
    String? error,
    bool clearError = false,
  }) => ChatState(
    conversationId: conversationId ?? this.conversationId,
    messages: messages ?? this.messages,
    sending: sending ?? this.sending,
    loading: loading ?? this.loading,
    error: clearError ? null : error ?? this.error,
  );
}

/// Plain words for the chat's error codes.
String chatErrorText(Object error) {
  if (error is! ApiException) return 'Something went wrong. Please try again.';
  if (error.isNetwork) {
    return 'No connection. The assistant needs the internet; try again when online.';
  }
  return switch (error.code) {
    'RATE_LIMITED' =>
      'You have asked many questions in the last hour. Please try again '
          '${_later(error.retryAfter)}.',
    'CHAT_UNAVAILABLE' =>
      'The assistant is not available right now. Please try again later.',
    'LANGUAGE_NOT_AVAILABLE' =>
      'The assistant is only available in English for now.',
    'NOT_FOUND' => 'That chat is no longer there. It may have been deleted.',
    _ => error.message,
  };
}

String _later(Duration? wait) {
  if (wait == null) return 'later';
  final minutes = (wait.inSeconds / 60).ceil();
  return minutes <= 1 ? 'in a minute' : 'in $minutes minutes';
}

/// The person's earlier chats, most recent first (from the server; nothing
/// is kept on the phone). Refreshed after every question and deletion.
final chatHistoryProvider = FutureProvider.autoDispose<List<ChatSummary>>(
  (ref) => ref.watch(chatApiProvider).list(),
  // No automatic retries: offline, the list says so at once, and opening
  // Past chats again is the retry.
  retry: (_, _) => null,
);

/// The open conversation. It starts with the first question; "New chat"
/// starts again, and an earlier chat can be opened and continued.
class ChatController extends Notifier<ChatState> {
  @override
  ChatState build() => const ChatState();

  Future<void> ask(String text) async {
    final question = text.trim();
    if (question.isEmpty || state.sending || state.loading) return;
    state = state.copyWith(sending: true, clearError: true);
    final api = ref.read(chatApiProvider);
    try {
      final id = state.conversationId ?? await api.start();
      final (asked, answer) = await api.ask(id, question);
      state = state.copyWith(
        conversationId: id,
        messages: [...state.messages, asked, answer],
        sending: false,
      );
      ref.invalidate(chatHistoryProvider);
    } catch (e) {
      state = state.copyWith(sending: false, error: chatErrorText(e));
    }
  }

  /// Opens an earlier conversation so it can be read and continued.
  Future<void> open(String conversationId) async {
    if (state.sending || conversationId == state.conversationId) return;
    state = ChatState(conversationId: conversationId, loading: true);
    try {
      final messages = await ref.read(chatApiProvider).messages(conversationId);
      if (state.conversationId != conversationId) return;
      state = ChatState(conversationId: conversationId, messages: messages);
    } catch (e) {
      if (state.conversationId != conversationId) return;
      state = ChatState(error: chatErrorText(e));
    }
  }

  /// A new, empty chat. With [delete], the current conversation is deleted
  /// on the server first.
  Future<void> startOver({bool delete = false}) async {
    final id = state.conversationId;
    state = const ChatState();
    if (delete && id != null) {
      try {
        await ref.read(chatApiProvider).delete(id);
        ref.invalidate(chatHistoryProvider);
      } catch (e) {
        state = state.copyWith(error: chatErrorText(e));
      }
    }
  }
}

final chatControllerProvider =
    NotifierProvider.autoDispose<ChatController, ChatState>(ChatController.new);
