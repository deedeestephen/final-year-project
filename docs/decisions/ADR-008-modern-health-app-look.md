# ADR-008: "Modern health app" look for the phone app

- **Status:** Accepted (owner request, 2026-09-28). Applies to `1-presentation-layer/mobile-app/`. It builds on ADR-002 (legibility) and ADR-004 (Zambian national colours); both still apply.
- **Context:** The owner found the phone app "too plain" and chose, from three options, a **modern health app** style for **every screen**, in light and dark mode:
  - a green gradient header with a greeting and the person's initials
  - colourful icon tiles
  - soft shadows and rounded cards

## Decision

- **Home header (`HeroHeader`):**
  - A diagonal gradient from `heroStart` to `heroEnd` (flag-derived greens).
  - It contains the menu button, the screen title and the sync badge.
  - Below them: the date, a greeting ("Welcome, …" for staff, "Hello, …" for patients), and an initials avatar.
  - The header has a 28 px rounded lower edge, and the flag stripe follows it, so the national accent (ADR-004) stays.
  - The sign-in, sign-up and password screens use the same header, with the app mark ("PCa" on white) and the screen title.
- **Colourful tiles (`ActionTile`, `TintedIcon`):**
  - Six tones in `AccentTone`: green, blue, orange, purple, teal and grey. Each has its own light and dark colours.
  - **A tone only tells tiles apart. It never means good or bad**, and tones are not used on clinical values. Results keep neutral ink and the monospaced value font (ADR-002).
  - Items that are not available yet are grey and carry a "Coming in build phase …" label.
  - Avatars never use orange, so they cannot be mistaken for the amber "saved on device" sync badge.
- **Depth and shape:**
  - Cards have a 20 px radius and a soft, green-tinted shadow in light mode, plus a faint hairline border. The border keeps edges visible in bright sunlight, the concern behind the admin website's border-only style (ADR-006).
  - In dark mode, borders carry the edges and shadows are off.
  - Buttons and inputs have a 12 px radius. Inner-screen app bars have rounded lower corners.
  - The patient tab bar uses a pill indicator.
- **Readable in both modes:** `theme_test.dart` checks 30 text/background pairs per mode (60 in all) at WCAG AA 4.5:1. The pairs include:
  - white and pale-green text on both ends of the gradient
  - the icon and label colour of every tile tone
  Body text stays at 15 px or more, and touch targets stay at 48 dp or more.
- **Nothing clinical changed:**
  - The AI disclaimer banner is still the first thing on every AI screen.
  - Mock output is still labelled "DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT."
  - Every widget key used by the tests and the device test is unchanged.

## Consequences

- The redesign lives mostly in the theme (`app_theme.dart`, `tokens.dart`) and in one shared file, `shared/widgets/hero_header.dart`. The screens use these pieces, so later screens get the same look for free.
- Screens were checked by eye from renders at Galaxy S9+ size, with the real fonts and synthetic data only, in light and dark mode. The render scripts are kept out of the repository (`tool/render/`, git-ignored locally), because pixel comparisons differ between machines.
