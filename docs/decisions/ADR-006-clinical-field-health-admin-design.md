# ADR-006: "Clinical Field Health" design system for the admin website

- **Status:** Accepted (owner request, 2026-09-24). Applies to `1-presentation-layer/admin-panel-web/` only. **Its colours are superseded by [ADR-011](ADR-011-awareness-blue-and-modern-icons.md) (2026-09-29):** awareness blue replaces Clinical Emerald, and the flag stripe is removed. The layout, borders, type and components below stay.
- **Context:** The owner supplied a design specification, "Clinical Field Health", and asked for the admin page to follow it. It is written for clinical field work in Zambia:
  - high contrast
  - crisp borders instead of soft shadows (these wash out in sunlight)
  - Plus Jakarta Sans
  - 48 px touch targets and 52 px inputs

## Decision
- **Colours** follow the specification's written sections:
  - Slate ink on a Slate 50 canvas (`#f8fafc`), with white cards and `#e2e8f0` borders.
  - **Clinical Emerald `#047857`** for primary actions, links and positive states.
  - Amber for warnings and pending states.
  - Red `#b91c1c` for critical states.
  - Slate 900 for structural (secondary) buttons.
  The specification's front-matter tokens (a Material-style palette with a black primary) contradict its written sections, so the written sections were used because they define every component.
- **Accessibility adjustments:**
  - The specification's bright Clinical Emerald `#059669` and Amber `#d97706` do not reach WCAG AA as text on white (about 3.8:1 and 3.2:1). They are used only for decoration: accent borders and marks.
  - Text uses `#047857` (5.5:1) and `#b45309` (5.0:1).
  - `1-presentation-layer/admin-panel-web/src/design/contrast.test.ts` reads the tokens from `index.css` and fails the build if any text/background pair drops below 4.5:1.
- **Typography:**
  - Plus Jakarta Sans everywhere.
  - Body text is 15 px. 13 px is used only for descriptors and timestamps.
  - Numbers (counts) are bold with tabular figures.
  - Badges are 11 px uppercase with 0.05em tracking.
  - JetBrains Mono is kept only for one-time passwords, permission codes and record numbers, where `0/O` and `1/l` must not be confused. Inter was removed.
- **Shape and depth:**
  - 8 px radius for inputs and buttons, 12 px for cards and tables, 16 px for dialogs.
  - 1–1.5 px borders.
  - The only shadow is the specification's "floating" shadow on dialogs.
- **Controls:**
  - 48 px buttons, 52 px inputs with labels outside and hints below, 24 px checkboxes in 48 px rows, pill status chips.
  - 4 px left accents on notices and on the active menu item.
  - Destructive actions (Reset password, Unlink) use a red outline.
- **Layout:**
  - maximum content width 1120 px
  - margins of 16 px (phone), 32 px (tablet) and 48 px (desktop)
  - the sidebar collapses behind a Menu button under 900 px
  - tables become record cards under 700 px
  - under 480 px the top bar shows only the brand mark and "Admin"
- **Connection banner.** Following the specification's sync-indicator rule, a sticky banner appears at the top:
  - Amber while offline: "You are offline. Changes cannot be saved until the connection returns." The portal keeps nothing on the device, so it does not claim to save offline.
  - Emerald for 4 seconds after reconnecting: "Back online."
- **Kept from ADR-004:**
  - the thin Zambian flag stripe, as a decorative national accent
  - no emblem
  - the "not an official Government of the Republic of Zambia service" notice

## Consequences
- The admin website and the mobile app now look different: flag green in the app, emerald in the portal. They share the typeface, the stripe and the notice. The app can be moved to this design later if the owner wants.
- All visual decisions live in CSS custom properties in `1-presentation-layer/admin-panel-web/src/index.css`, so a future change of palette is a token edit, checked by the contrast test.
