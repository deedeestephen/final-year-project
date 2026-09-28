import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/theme/tokens.dart';
import 'national_stripe.dart';

/// Up to two capital letters from a name ("Demo Clinician" → "DC").
String initialsOf(String name) {
  final words = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  return words.take(2).map((w) => w.characters.first.toUpperCase()).join();
}

/// "Monday 28 September" (the phone's own date; no locale data needed).
String longDate(DateTime d) {
  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return '${days[d.weekday - 1]} ${d.day} ${months[d.month - 1]}';
}

/// A stable tone for a name, so the same person always gets the same colour.
/// It only tells people apart and means nothing clinically.
AccentTone toneFor(String name) {
  const tones = [
    AccentTone.green,
    AccentTone.blue,
    AccentTone.purple,
    AccentTone.teal,
  ];
  // Orange is left out: next to the amber sync badges it could read as a
  // warning.
  final sum = name.codeUnits.fold<int>(0, (a, b) => a + b);
  return tones[sum % tones.length];
}

/// A circle with someone's initials. Decorative: the name is always written
/// next to it, so screen readers skip it.
class InitialsAvatar extends StatelessWidget {
  const InitialsAvatar({
    super.key,
    required this.name,
    this.size = 48,
    this.onHero = false,
    this.tone = AccentTone.green,
  });

  final String name;
  final double size;

  /// White-on-glass style for the green header.
  final bool onHero;
  final AccentTone tone;

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    final bg = onHero ? Colors.white.withAlpha(0x2E) : tone.background(p);
    final fg = onHero ? p.onPrimary : tone.foreground(p);
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          shape: BoxShape.circle,
          border: onHero
              ? Border.all(color: Colors.white.withAlpha(0x66), width: 1.5)
              : null,
        ),
        child: Text(
          initialsOf(name),
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: fg,
            fontSize: size * 0.36,
            height: 1,
          ),
        ),
      ),
    );
  }
}

/// The green gradient header of the home screens: menu, title and actions
/// on top; below them the date, a greeting and the person's initials. A thin
/// band in the flag's colours follows its rounded lower edge.
class HeroHeader extends StatelessWidget {
  const HeroHeader({
    super.key,
    required this.title,
    required this.greeting,
    this.name,
    this.subtitle,
    this.leading,
    this.actions = const [],
    this.date,
  });

  final String title;
  final String greeting;

  /// Shown as initials on the right when given.
  final String? name;
  final String? subtitle;
  final Widget? leading;
  final List<Widget> actions;

  /// Defaults to today.
  final DateTime? date;

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    final text = Theme.of(context).textTheme;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(bottom: AppRadii.hero),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [p.heroStart, p.heroEnd],
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSizes.xs,
                    AppSizes.xs,
                    AppSizes.xs,
                    AppSizes.lg,
                  ),
                  child: IconTheme(
                    data: IconThemeData(color: p.onPrimary),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(
                          height: AppSizes.minTouchTarget + 8,
                          child: Row(
                            children: [
                              if (leading != null)
                                leading!
                              else
                                const SizedBox(width: AppSizes.md - 4),
                              Expanded(
                                child: Semantics(
                                  header: true,
                                  child: Text(
                                    title,
                                    style: text.titleLarge?.copyWith(
                                      color: p.onPrimary,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ),
                              ...actions,
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSizes.md - 4,
                            AppSizes.sm,
                            AppSizes.md - 4,
                            0,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      longDate(date ?? DateTime.now()),
                                      style: text.bodyMedium?.copyWith(
                                        color: p.onHeroMuted,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      greeting,
                                      style: text.headlineSmall?.copyWith(
                                        color: p.onPrimary,
                                      ),
                                    ),
                                    if (subtitle != null) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        subtitle!,
                                        style: text.bodyMedium?.copyWith(
                                          color: p.onHeroMuted,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              if (name != null) ...[
                                const SizedBox(width: AppSizes.md),
                                InitialsAvatar(
                                  name: name!,
                                  size: 56,
                                  onHero: true,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const NationalStripe(height: 4),
          ],
        ),
      ),
    );
  }
}

/// A heading above a group of tiles.
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSizes.xs,
        AppSizes.md,
        AppSizes.xs,
        AppSizes.sm,
      ),
      child: Semantics(
        header: true,
        child: Text(text, style: Theme.of(context).textTheme.titleMedium),
      ),
    );
  }
}

/// A small rounded label, e.g. "Coming in build phase 13".
class SoftChip extends StatelessWidget {
  const SoftChip(this.text, {super.key, this.tone = AccentTone.grey});

  final String text;
  final AccentTone tone;

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: tone.background(p),
        borderRadius: const BorderRadius.all(AppRadii.chip),
      ),
      child: Text(
        text,
        style: Theme.of(
          context,
        ).textTheme.labelMedium?.copyWith(color: tone.foreground(p)),
      ),
    );
  }
}

/// An icon in a rounded, tinted square (the "colourful tile" look).
class TintedIcon extends StatelessWidget {
  const TintedIcon(
    this.icon, {
    super.key,
    this.tone = AccentTone.green,
    this.size = 52,
  });

  final IconData icon;
  final AccentTone tone;
  final double size;

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: tone.background(p),
        borderRadius: BorderRadius.all(Radius.circular(size * 0.27)),
      ),
      child: Icon(icon, color: tone.foreground(p), size: size / 2),
    );
  }
}

/// A rounded card with a colourful icon square, a title, a description and
/// an arrow when it opens something. The colour only tells tiles apart.
class ActionTile extends StatelessWidget {
  const ActionTile({
    super.key,
    required this.icon,
    required this.title,
    this.description,
    this.tone = AccentTone.green,
    this.onTap,
    this.badge,
    this.descriptionKey,
  });

  final IconData icon;
  final String title;
  final String? description;
  final AccentTone tone;
  final VoidCallback? onTap;

  /// A short label under the description, e.g. "Coming in build phase 13".
  final String? badge;
  final Key? descriptionKey;

  @override
  Widget build(BuildContext context) {
    final p = context.colors;
    final text = Theme.of(context).textTheme;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSizes.md),
          child: Row(
            children: [
              TintedIcon(icon, tone: tone),
              const SizedBox(width: AppSizes.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: text.titleMedium),
                    if (description != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        description!,
                        key: descriptionKey,
                        style: text.bodyMedium?.copyWith(
                          color: p.textSecondary,
                        ),
                      ),
                    ],
                    if (badge != null) ...[
                      const SizedBox(height: AppSizes.sm),
                      SoftChip(badge!),
                    ],
                  ],
                ),
              ),
              if (onTap != null) ...[
                const SizedBox(width: AppSizes.sm),
                Icon(Icons.chevron_right, color: p.textSecondary),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
