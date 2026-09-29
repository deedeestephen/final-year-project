import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

/// Whether voice messages can be used on this phone.
enum VoiceAvailability {
  ready,

  /// The person refused the microphone permission.
  noPermission,

  /// The phone has no speech recognition service.
  unavailable,
}

/// Turns speech into text with the phone's own speech service (ADR-012).
/// The app never receives or stores the sound: only the words come back,
/// and they are sent like a typed question.
abstract interface class SpeechService {
  /// Asks for the microphone the first time. Safe to call again.
  Future<VoiceAvailability> initialize();

  /// Starts listening. [onWords] gets the words so far; [onLevel] the sound
  /// level from 0 to 1; [onDone] is called once when listening ends: after
  /// [stop], a pause of 3 seconds, 60 seconds, or an error.
  Future<void> listen({
    required void Function(String words) onWords,
    required void Function(double level) onLevel,
    required void Function() onDone,
  });

  /// Stops and keeps the words heard so far.
  Future<void> stop();

  /// Stops and throws the words away.
  Future<void> cancel();
}

/// The phone's recognizer, through `speech_to_text`.
class PhoneSpeechService implements SpeechService {
  final _speech = stt.SpeechToText();
  bool _ready = false;
  void Function()? _onDone;

  @override
  Future<VoiceAvailability> initialize() async {
    if (_ready) return VoiceAvailability.ready;
    try {
      _ready = await _speech.initialize(
        onStatus: (status) {
          if (status == stt.SpeechToText.doneStatus ||
              status == stt.SpeechToText.notListeningStatus) {
            _finish();
          }
        },
        onError: (_) => _finish(),
      );
    } on PlatformException {
      _ready = false;
    }
    if (_ready) return VoiceAvailability.ready;
    return await _speech.hasPermission
        ? VoiceAvailability.unavailable
        : VoiceAvailability.noPermission;
  }

  void _finish() {
    final done = _onDone;
    _onDone = null;
    done?.call();
  }

  @override
  Future<void> listen({
    required void Function(String words) onWords,
    required void Function(double level) onLevel,
    required void Function() onDone,
  }) async {
    _onDone = onDone;
    // The answers are in English: use the phone's English locale, or
    // British English when the phone is set to another language.
    final system = await _speech.systemLocale();
    final locale = system != null && system.localeId.startsWith('en')
        ? system.localeId
        : 'en_GB';
    await _speech.listen(
      onResult: (result) {
        onWords(result.recognizedWords);
        if (result.finalResult) _finish();
      },
      // Android reports roughly -2 to 10 dB.
      onSoundLevelChange: (level) => onLevel(((level + 2) / 12).clamp(0, 1)),
      listenOptions: stt.SpeechListenOptions(
        listenFor: const Duration(seconds: 60),
        pauseFor: const Duration(seconds: 3),
        localeId: locale,
        partialResults: true,
        cancelOnError: true,
        listenMode: stt.ListenMode.dictation,
      ),
    );
  }

  @override
  Future<void> stop() => _speech.stop();

  @override
  Future<void> cancel() async {
    _onDone = null;
    await _speech.cancel();
  }
}

final speechServiceProvider = Provider<SpeechService>(
  (ref) => PhoneSpeechService(),
);
