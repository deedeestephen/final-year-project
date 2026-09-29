import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/routes.dart';
import '../../app/theme/tokens.dart';

/// The assistant's face: a friendly robot whose head is a speech bubble, so
/// it reads as "you can chat here". It is drawn in code, so it stays sharp
/// at every size. Its colours are fixed (the same in light and dark mode),
/// like an app icon.
class AssistantAvatar extends StatefulWidget {
  const AssistantAvatar({
    super.key,
    this.size = 40,
    this.animate = false,
    this.onBadge = false,
    this.semanticLabel,
  });

  final double size;

  /// Blinks now and then, unless the phone asks for less motion.
  final bool animate;

  /// Drawn on a white disc, for use on a blue background.
  final bool onBadge;

  /// Null when a visible text already names the assistant.
  final String? semanticLabel;

  static const name = 'PCa Assistant';

  @override
  State<AssistantAvatar> createState() => _AssistantAvatarState();
}

class _AssistantAvatarState extends State<AssistantAvatar>
    with SingleTickerProviderStateMixin {
  AnimationController? _blink;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (widget.animate && !still) {
      _blink ??= AnimationController(
        vsync: this,
        duration: const Duration(seconds: 4),
      )..repeat();
    } else {
      _blink?.dispose();
      _blink = null;
    }
  }

  @override
  void dispose() {
    _blink?.dispose();
    super.dispose();
  }

  /// Eyes open (1) most of the time; a quick blink near the end of each cycle.
  static double _openness(double t) {
    if (t < 0.9 || t > 0.96) return 1;
    return 1 - math.sin((t - 0.9) / 0.06 * math.pi) * 0.88;
  }

  @override
  Widget build(BuildContext context) {
    final blink = _blink;
    Widget face = blink == null
        ? CustomPaint(painter: const AssistantPainter())
        : AnimatedBuilder(
            animation: blink,
            builder: (_, _) => CustomPaint(
              painter: AssistantPainter(eyesOpen: _openness(blink.value)),
            ),
          );
    face = SizedBox.square(dimension: widget.size, child: face);
    if (widget.onBadge) {
      face = Container(
        padding: EdgeInsets.all(widget.size * 0.1),
        decoration: const BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
        ),
        child: SizedBox.square(dimension: widget.size * 0.8, child: face),
      );
    }
    final label = widget.semanticLabel;
    return label == null
        ? ExcludeSemantics(child: face)
        : Semantics(label: label, image: true, child: face);
  }
}

/// Draws the robot in a 100 x 100 box, scaled to the canvas.
class AssistantPainter extends CustomPainter {
  const AssistantPainter({this.eyesOpen = 1});

  final double eyesOpen;

  static final _head = [AppPalette.light.primary, AppPalette.light.heroEnd];
  static final _accent = AppPalette.light.accent;
  static const _visor = Color(0xFF0F1E4A);

  @override
  void paint(Canvas canvas, Size size) {
    final u = size.shortestSide / 100;
    Offset o(double x, double y) => Offset(x * u, y * u);
    Rect box(double l, double t, double r, double b) =>
        Rect.fromLTRB(l * u, t * u, r * u, b * u);

    // Antenna with a glowing awareness-blue tip.
    canvas.drawLine(
      o(50, 25),
      o(50, 13),
      Paint()
        ..color = _head.last
        ..strokeWidth = 4.5 * u
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(
      o(50, 10),
      9.5 * u,
      Paint()..color = _accent.withValues(alpha: 0.3),
    );
    canvas.drawCircle(o(50, 10), 6 * u, Paint()..color = _accent);

    // Ears.
    final ear = Paint()..color = _accent;
    for (final (l, r) in [(5.0, 13.0), (87.0, 95.0)]) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(box(l, 44, r, 62), Radius.circular(4 * u)),
        ear,
      );
    }

    // Head and speech-bubble tail, one shape with a blue gradient.
    final head = Path()
      ..addRRect(
        RRect.fromRectAndRadius(box(11, 23, 89, 81), Radius.circular(22 * u)),
      );
    final tail = Path()
      ..moveTo(24 * u, 74 * u)
      ..lineTo(17 * u, 96 * u)
      ..lineTo(44 * u, 79 * u)
      ..close();
    canvas.drawPath(
      Path.combine(PathOperation.union, head, tail),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: _head,
        ).createShader(Offset.zero & size),
    );
    // A soft shine on the top edge.
    canvas.drawRRect(
      RRect.fromRectAndRadius(box(24, 27, 60, 31), Radius.circular(2 * u)),
      Paint()..color = Colors.white.withValues(alpha: 0.22),
    );

    // Visor, eyes and smile.
    canvas.drawRRect(
      RRect.fromRectAndRadius(box(21, 35, 79, 71), Radius.circular(16 * u)),
      Paint()..color = _visor,
    );
    final eye = Paint()..color = Colors.white;
    final eyeHeight = math.max(12 * eyesOpen, 1.8);
    for (final x in [38.0, 62.0]) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(
            center: o(x, 48),
            width: 9 * u,
            height: eyeHeight * u,
          ),
          Radius.circular(4.5 * u),
        ),
        eye,
      );
    }
    canvas.drawArc(
      box(40, 50, 60, 64),
      0.35,
      math.pi - 0.7,
      false,
      Paint()
        ..color = _accent
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.8 * u
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(AssistantPainter old) => old.eyesOpen != eyesOpen;
}

/// The floating "Ask the assistant" button with the bot, on the patient's
/// Home and Learn tabs and the clinician's home.
class AssistantFab extends StatelessWidget {
  const AssistantFab({super.key});

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton.extended(
      key: const Key('assistant.fab'),
      heroTag: 'assistant-fab',
      tooltip: 'Chat with the ${AssistantAvatar.name}',
      onPressed: () => context.push(Routes.chat),
      icon: const AssistantAvatar(size: 34, onBadge: true),
      label: Text(
        'Ask the assistant',
        style: Theme.of(
          context,
        ).textTheme.labelLarge?.copyWith(color: context.colors.onPrimary),
      ),
    );
  }
}
