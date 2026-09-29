import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../app/theme/tokens.dart';
import '../application/voice_input.dart';

/// The question box: type, or tap the microphone and speak (ADR-012). The
/// words appear in the box as they are heard; the person checks them, then
/// sends, as with dictation in other chat apps.
class ChatComposer extends ConsumerStatefulWidget {
  const ChatComposer({
    super.key,
    required this.controller,
    required this.enabled,
    required this.onSend,
  });

  final TextEditingController controller;

  /// False while offline or while an answer is on its way.
  final bool enabled;
  final VoidCallback onSend;

  static const noPermission =
      'Allow the microphone to talk to the assistant: open your phone\'s '
      'Settings, then Apps, PCa mHealth, Permissions, Microphone. You can '
      'always type instead.';
  static const unavailable =
      'Voice messages need a speech service on this phone (for example '
      'Google\'s). You can type your question instead.';
  static const heardNothing =
      'I did not hear anything. Tap the microphone and try again.';

  @override
  ConsumerState<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends ConsumerState<ChatComposer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  SpeechService? _speech;
  bool _listening = false;
  bool _voiceHidden = false;
  double _level = 0;
  String? _note;

  /// Text typed before speaking; the spoken words are added after it.
  String _before = '';

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
  }

  @override
  void dispose() {
    if (_listening) _speech?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _startVoice() async {
    final SpeechService speech = _speech ?? ref.read(speechServiceProvider);
    _speech = speech;
    setState(() => _note = null);
    final availability = await speech.initialize();
    if (!mounted) return;
    if (availability != VoiceAvailability.ready) {
      setState(() {
        _note = availability == VoiceAvailability.noPermission
            ? ChatComposer.noPermission
            : ChatComposer.unavailable;
        _voiceHidden = availability == VoiceAvailability.unavailable;
      });
      return;
    }
    _before = widget.controller.text.trim();
    setState(() {
      _listening = true;
      _level = 0;
    });
    if (!(MediaQuery.maybeDisableAnimationsOf(context) ?? false)) {
      _pulse.repeat(reverse: true);
    }
    await speech.listen(
      onWords: _setWords,
      onLevel: (level) {
        if (mounted && _listening) setState(() => _level = level);
      },
      onDone: _finished,
    );
  }

  void _setWords(String words) {
    if (!mounted || !_listening) return;
    final text = [_before, words.trim()].where((s) => s.isNotEmpty).join(' ');
    widget.controller.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }

  void _finished() {
    if (!mounted || !_listening) return;
    _pulse.stop();
    setState(() {
      _listening = false;
      if (widget.controller.text.trim() == _before) {
        _note = ChatComposer.heardNothing;
      }
    });
  }

  Future<void> _done() async {
    await _speech?.stop();
    _finished();
  }

  Future<void> _cancel() async {
    await _speech?.cancel();
    if (!mounted) return;
    _pulse.stop();
    widget.controller.text = _before;
    setState(() => _listening = false);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    final theme = Theme.of(context);
    final canSpeak = widget.enabled && !_listening;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_note != null)
          Container(
            key: const Key('chat.voice.note'),
            color: p.infoBg,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSizes.md,
              vertical: AppSizes.sm,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Symbols.mic_off_rounded, size: 20, color: p.infoText),
                const SizedBox(width: AppSizes.sm),
                Expanded(
                  child: Text(
                    _note!,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: p.infoText,
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (_listening)
          _RecordingBar(
            level: _level,
            pulse: _pulse,
            onCancel: _cancel,
            onDone: _done,
          ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(AppSizes.sm + 4),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    key: const Key('chat.input'),
                    controller: widget.controller,
                    readOnly: _listening,
                    maxLength: 1000,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onSubmitted: widget.enabled && !_listening
                        ? (_) => widget.onSend()
                        : null,
                    decoration: InputDecoration(
                      hintText: _listening
                          ? 'Listening…'
                          : _voiceHidden
                          ? 'Type your question'
                          : 'Type or speak your question',
                      counterText: '',
                      suffixIcon: _voiceHidden || _listening
                          ? null
                          : IconButton(
                              key: const Key('chat.mic'),
                              tooltip: 'Speak your question',
                              onPressed: canSpeak ? _startVoice : null,
                              icon: Icon(
                                Symbols.mic_rounded,
                                color: canSpeak ? p.linkText : null,
                              ),
                            ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSizes.sm),
                ValueListenableBuilder(
                  valueListenable: widget.controller,
                  builder: (context, value, _) => IconButton.filled(
                    key: const Key('chat.send'),
                    tooltip: 'Send',
                    onPressed:
                        widget.enabled &&
                            !_listening &&
                            value.text.trim().isNotEmpty
                        ? widget.onSend
                        : null,
                    icon: const Icon(Symbols.arrow_upward_rounded, weight: 600),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Shown while listening: a pulsing red dot, the sound level, and buttons
/// to throw the recording away or to finish.
class _RecordingBar extends StatelessWidget {
  const _RecordingBar({
    required this.level,
    required this.pulse,
    required this.onCancel,
    required this.onDone,
  });

  final double level;
  final Animation<double> pulse;
  final VoidCallback onCancel;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    final theme = Theme.of(context);
    return Container(
      key: const Key('chat.voice.recording'),
      margin: const EdgeInsets.fromLTRB(
        AppSizes.sm + 4,
        AppSizes.sm,
        AppSizes.sm + 4,
        0,
      ),
      padding: const EdgeInsets.symmetric(horizontal: AppSizes.xs),
      decoration: BoxDecoration(
        color: p.surfaceMuted,
        borderRadius: const BorderRadius.all(AppRadii.chip),
        border: Border.all(color: p.border),
      ),
      child: Row(
        children: [
          IconButton(
            key: const Key('chat.voice.cancel'),
            tooltip: 'Cancel voice message',
            onPressed: onCancel,
            icon: const Icon(Symbols.close_rounded),
          ),
          FadeTransition(
            opacity: Tween(begin: 1.0, end: 0.3).animate(pulse),
            child: Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: p.danger,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: AppSizes.sm),
          Expanded(
            child: Semantics(
              liveRegion: true,
              child: Text(
                'Listening… speak now',
                key: const Key('chat.voice.status'),
                style: theme.textTheme.bodyMedium,
              ),
            ),
          ),
          _LevelBars(level: level),
          const SizedBox(width: AppSizes.sm),
          IconButton.filled(
            key: const Key('chat.voice.done'),
            tooltip: 'Done speaking',
            onPressed: onDone,
            icon: const Icon(Symbols.check_rounded, weight: 600),
          ),
        ],
      ),
    );
  }
}

/// Five bars that grow with the voice, so people can see they are heard.
class _LevelBars extends StatelessWidget {
  const _LevelBars({required this.level});

  final double level;

  static const _shape = [0.45, 0.75, 1.0, 0.75, 0.45];

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    return ExcludeSemantics(
      child: SizedBox(
        height: 28,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            for (final s in _shape)
              AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                margin: const EdgeInsets.symmetric(horizontal: 1.5),
                width: 4,
                height: 4 + 22 * level * s,
                decoration: BoxDecoration(
                  color: p.primary,
                  borderRadius: const BorderRadius.all(Radius.circular(2)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
