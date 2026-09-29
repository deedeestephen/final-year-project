import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';

/// Reads text aloud with the phone's own text-to-speech voice (ADR-012), for
/// people who cannot read, or cannot read well. English voices work without
/// the internet on most Android phones. Nothing is sent to our server.
abstract interface class ReadAloud {
  /// Completes when the text has been read, or when [stop] is called.
  Future<void> speak(String text);

  Future<void> stop();

  /// 0.5 is the phone's normal speed.
  Future<void> setRate(double rate);
}

/// The phone's voice, through `flutter_tts`. The engine is only started on
/// first use, so screens that never read aloud never touch the plugin.
class PhoneReadAloud implements ReadAloud {
  FlutterTts? _tts;
  Completer<void>? _current;

  Future<FlutterTts> _engine() async {
    final existing = _tts;
    if (existing != null) return existing;
    final tts = FlutterTts();
    // Only a natural end or an error finishes a part. A stop finishes it in
    // [stop] itself: the engine's late "cancelled" event could otherwise end
    // the next part too early.
    tts.setCompletionHandler(_finish);
    tts.setErrorHandler((_) => _finish());
    await tts.awaitSpeakCompletion(false);
    // The content is English; a British voice first, as used in Zambia.
    for (final language in ['en-GB', 'en-US']) {
      if (await tts.isLanguageAvailable(language) == true) {
        await tts.setLanguage(language);
        break;
      }
    }
    return _tts = tts;
  }

  void _finish() {
    final current = _current;
    _current = null;
    if (current != null && !current.isCompleted) current.complete();
  }

  @override
  Future<void> speak(String text) async {
    final tts = await _engine();
    _finish();
    final done = _current = Completer<void>();
    final started = await tts.speak(text);
    if (started != 1) _finish();
    return done.future;
  }

  @override
  Future<void> stop() async {
    _finish();
    await _tts?.stop();
  }

  @override
  Future<void> setRate(double rate) async =>
      (await _engine()).setSpeechRate(rate);
}

final readAloudProvider = Provider<ReadAloud>((ref) {
  final voice = PhoneReadAloud();
  ref.onDispose(voice.stop);
  return voice;
});

/// Speeds for [ReadAloud.setRate].
const normalReadingRate = 0.5;
const slowReadingRate = 0.35;

/// What is being read aloud. Only one thing at a time in the whole app.
@immutable
class ReadAloudState {
  const ReadAloudState({
    this.id,
    this.part = 0,
    this.total = 0,
    this.paused = false,
    this.slow = false,
  });

  /// For example `article:psa-test` or `chat:a-1`; null when silent.
  final String? id;

  /// The part being read (or where a pause stopped), counted from 0.
  final int part;
  final int total;
  final bool paused;
  final bool slow;

  bool isReading(String what) => id == what && !paused;
  bool isActive(String what) => id == what;
}

/// Reads a list of parts in order (an article's summary, then each section)
/// so the screen can show which part is being read. A pause remembers the
/// part and starts it again from its beginning.
class ReadAloudController extends Notifier<ReadAloudState> {
  int _run = 0;
  List<String> _parts = const [];

  ReadAloud get _voice => ref.read(readAloudProvider);

  @override
  ReadAloudState build() => const ReadAloudState();

  Future<void> play(String id, List<String> parts, {int from = 0}) async {
    final run = ++_run;
    await _voice.stop();
    _parts = parts;
    if (!ref.mounted) return;
    await _voice.setRate(state.slow ? slowReadingRate : normalReadingRate);
    for (var i = from; i < parts.length; i++) {
      // Stopped, or another text started, or the app is closing.
      if (!ref.mounted || run != _run) return;
      state = ReadAloudState(
        id: id,
        part: i,
        total: parts.length,
        slow: state.slow,
      );
      await _voice.speak(parts[i]);
    }
    if (ref.mounted && run == _run) state = ReadAloudState(slow: state.slow);
  }

  Future<void> pause() async {
    if (!ref.mounted || state.id == null || state.paused) return;
    _run++;
    state = ReadAloudState(
      id: state.id,
      part: state.part,
      total: state.total,
      paused: true,
      slow: state.slow,
    );
    await _voice.stop();
  }

  Future<void> resume() async {
    if (!ref.mounted) return;
    final id = state.id;
    if (id == null) return;
    await play(id, _parts, from: state.part);
  }

  /// Stops reading. With [prefix], only when what is being read starts with
  /// it (for example a screen that closes stops only its own text).
  Future<void> stop({String? prefix}) async {
    if (!ref.mounted) return;
    final id = state.id;
    if (id == null || (prefix != null && !id.startsWith(prefix))) return;
    _run++;
    state = ReadAloudState(slow: state.slow);
    await _voice.stop();
  }

  /// Takes effect from the next part.
  Future<void> setSlow(bool slow) async {
    if (!ref.mounted) return;
    state = ReadAloudState(
      id: state.id,
      part: state.part,
      total: state.total,
      paused: state.paused,
      slow: slow,
    );
    await _voice.setRate(slow ? slowReadingRate : normalReadingRate);
  }
}

final readAloudControllerProvider =
    NotifierProvider<ReadAloudController, ReadAloudState>(
      ReadAloudController.new,
    );
