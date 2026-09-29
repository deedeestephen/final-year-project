import '../../../core/network/api_client.dart';

/// Where a quoted answer comes from.
class ChatSource {
  const ChatSource({required this.name, required this.url});

  factory ChatSource.fromJson(Map<String, dynamic> j) =>
      ChatSource(name: j['name'] as String, url: (j['url'] as String?) ?? '');

  final String name;
  final String url;
}

/// How the server handled a question (see chat-contract.md).
enum ChatSafety {
  ok,
  urgentCare,
  declined,
  noSource;

  static ChatSafety parse(String? value) => switch (value) {
    'URGENT_CARE' => ChatSafety.urgentCare,
    'DECLINED' => ChatSafety.declined,
    'NO_SOURCE' => ChatSafety.noSource,
    _ => ChatSafety.ok,
  };
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.fromUser,
    required this.text,
    required this.at,
    this.sources = const [],
    this.safety = ChatSafety.ok,
    this.disclaimer,
    this.reviewStatus,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> j) => ChatMessage(
    id: j['id'] as String,
    fromUser: j['role'] == 'user',
    text: j['text'] as String,
    at: DateTime.parse(j['at'] as String),
    sources: [
      for (final s in (j['sources'] as List<dynamic>? ?? const []))
        ChatSource.fromJson(s as Map<String, dynamic>),
    ],
    safety: ChatSafety.parse(j['safety'] as String?),
    disclaimer: j['disclaimer'] as String?,
    reviewStatus: j['reviewStatus'] as String?,
  );

  final String id;
  final bool fromUser;
  final String text;
  final DateTime at;
  final List<ChatSource> sources;
  final ChatSafety safety;
  final String? disclaimer;
  final String? reviewStatus;
}

/// The assistant (Phase 13). Online only: answers come from the server.
class ChatApi {
  ChatApi(this._api);

  final ApiClient _api;

  /// Starts a conversation; returns its id.
  Future<String> start({String language = 'en'}) async =>
      (await _api.post<Map<String, dynamic>>(
            '/chat/conversations',
            data: {'language': language},
          ))['id']
          as String;

  /// Asks a question; returns the stored question and the answer.
  Future<(ChatMessage, ChatMessage)> ask(
    String conversationId,
    String text,
  ) async {
    final body = await _api.post<Map<String, dynamic>>(
      '/chat/conversations/$conversationId/messages',
      data: {'text': text},
    );
    return (
      ChatMessage.fromJson(body['question'] as Map<String, dynamic>),
      ChatMessage.fromJson(body['answer'] as Map<String, dynamic>),
    );
  }

  Future<void> delete(String conversationId) =>
      _api.delete<void>('/chat/conversations/$conversationId');
}
