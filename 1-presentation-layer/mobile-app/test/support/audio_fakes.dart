import 'dart:async';

import 'package:pca_mhealth/features/chat/application/voice_input.dart';
import 'package:pca_mhealth/shared/audio/read_aloud.dart';

/// The phone's speech-to-text, scripted by the test.
class FakeSpeech implements SpeechService {
  FakeSpeech({this.availability = VoiceAvailability.ready});

  VoiceAvailability availability;
  int initializeCalls = 0;
  bool listening = false;
  bool cancelled = false;
  void Function(String)? _onWords;
  void Function(double)? _onLevel;
  void Function()? _onDone;

  @override
  Future<VoiceAvailability> initialize() async {
    initializeCalls++;
    return availability;
  }

  @override
  Future<void> listen({
    required void Function(String words) onWords,
    required void Function(double level) onLevel,
    required void Function() onDone,
  }) async {
    listening = true;
    cancelled = false;
    _onWords = onWords;
    _onLevel = onLevel;
    _onDone = onDone;
  }

  /// The recognizer hears [words] (all the words so far).
  void hear(String words, {double level = 0.7}) {
    _onLevel?.call(level);
    _onWords?.call(words);
  }

  /// Listening ends by itself (a pause, or the time limit).
  void finish() {
    listening = false;
    final done = _onDone;
    _onDone = null;
    done?.call();
  }

  @override
  Future<void> stop() async => finish();

  @override
  Future<void> cancel() async {
    listening = false;
    cancelled = true;
    _onDone = null;
  }
}

/// The phone's text-to-speech. Each [speak] waits until the test calls
/// [finishPart], so tests can see which part is being read.
class FakeReadAloud implements ReadAloud {
  final spoken = <String>[];
  final rates = <double>[];
  int stops = 0;
  Completer<void>? _current;

  bool get speaking => _current != null && !_current!.isCompleted;

  @override
  Future<void> speak(String text) {
    spoken.add(text);
    return (_current = Completer<void>()).future;
  }

  void finishPart() => _current?.complete();

  @override
  Future<void> stop() async {
    stops++;
    if (speaking) _current!.complete();
  }

  @override
  Future<void> setRate(double rate) async => rates.add(rate);
}
