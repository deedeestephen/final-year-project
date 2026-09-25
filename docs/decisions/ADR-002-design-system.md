# ADR-002: Mobile design system — Option 2 "Clinical Trust", with Option 1 legibility rules

- **Status:** Accepted (owner chose Option 2 with Option 1 legibility rules, 2026-09-23; implemented in Phase 7)
- **Inputs:** [design-option-1-clinical-field-health.md](../design/design-option-1-clinical-field-health.md),
  [design-option-2-clinical-trust.md](../design/design-option-2-clinical-trust.md)

## Comparison

| Criterion | Option 1 — Clinical Field Health | Option 2 — Clinical Trust |
|---|---|---|
| Fit to *this* project | Generic community-health mHealth (doses, vaccines, stock) | Written for prostate-cancer screening: PSA, Gleason, DRE, AI risk bar |
| AI safety UI | None | Mandatory AI disclaimer banner; a destructive "override AI" action style |
| Offline-first UI | Two sync states (amber/green banner) | Three explicit states (Synced / Offline-saved / Syncing N) |
| Clinical number legibility | Bold weights | Monospace (JetBrains Mono) for PSA values, IDs and lab ranges, so digits align in tables |
| Token consistency | YAML tokens (primary `#000000`, secondary `#006c4e`) contradict the prose (`#047857`, `#0f172a`) | YAML and prose largely agree (navy `#0A2540`, teal `#0D9488`) |
| Severity semantics | Green / amber / red | Crimson / amber / sky, plus a Level-3 critical overlay |
| Field legibility | Stronger: body ≥ 15 px, inputs 52 px | Weaker: body 14 px, small text 12 px |
| Font weight on the app | 1 family | 3 families (bundled offline adds ~600 KB) |

## Decision
Adopt **Option 2** as the base, and apply these Option 1 rules on top:
1. Body text minimum **15 px**; 13 px only for non-critical timestamps/meta; no text below 11 px (tags only).
2. Primary form inputs are **52 px** tall (Option 2's 48 px stays the minimum touch target).
3. Critical-card left accent border (4 px, severity colour), from Option 1.
4. Fonts are bundled as assets, not fetched at runtime, so the offline app never depends on Google Fonts.

## Rationale
Option 2 covers the things that are unique and risky in this system: AI disclaimers, explainability panels, risk scoring and
three-state sync. Option 1's advantage is legibility, and that can be carried over as rules without adopting its whole palette.

## Consequences
The Flutter `ThemeData` + `ThemeExtension` tokens (Phase 7) are generated from Option 2's colours. The contrast of every
text/background pair gets a WCAG AA check in a unit test.

**Implemented (Phase 7):** `1-presentation-layer/mobile-app/lib/app/theme/{tokens,app_theme}.dart`, tested in `1-presentation-layer/mobile-app/test/app/theme_test.dart`.
Design Option 2 teal `#0D9488` and amber `#D97706` fail 4.5:1 as text on white, so they are used only for icons and
accents; text uses the darker `#0F766E` and `#B45309`. The fonts are variable TTFs from the google/fonts repository
(SIL OFL 1.1, licences bundled and shown on the licence page).
