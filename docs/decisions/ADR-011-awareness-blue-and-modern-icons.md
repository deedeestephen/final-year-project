# ADR-011: Awareness blue, modern icons and an assistant you can see

- **Status:** Accepted (owner request, 2026-09-29). It supersedes [ADR-004](ADR-004-zambian-national-colours.md) (Zambian national colours) and the colour choices of [ADR-006](ADR-006-clinical-field-health-admin-design.md) (admin emerald) and [ADR-008](ADR-008-modern-health-app-look.md) (green gradient). The legibility rules of ADR-002, and the layout and components of ADR-006 and ADR-008, stay.
- **Context:** The owner looked at the app and the admin website after Phase 13 and asked for four things:
  - to leave the green Zambian theme;
  - modern icons on buttons;
  - a design that is less plain;
  - a real bot icon that shows people they can chat.

  The owner then chose **awareness blue** for both the app and the admin website, the flag stripe removed from both, and **Material Symbols Rounded** icons in the app.

## Decision

1. **Awareness blue, in the phone app and the admin website.**
   - Light blue is the prostate-cancer awareness ribbon colour. It is used only for decoration: the accent line under the headers, the bot's antenna and ears, and the recording glow.
   - Anything that carries text uses deeper blues:

     | | Phone app | Admin website |
     |---|---|---|
     | Buttons and bars | `#2563EB` (pressed `#1D4ED8`) | `#2563EB` (pressed `#1D4ED8`) |
     | Header gradient | `#1D4ED8 → #1E3A8A` | the dashboard hero card: `#2563EB → #1D4ED8` |
     | Links (light / dark mode) | `#1D4ED8` / `#93C5FD` | `#2563EB` |
     | Page (light / dark mode) | `#F5F8FF` / `#0B1220` | slate `#F8FAFC` |
     | Decoration only | `#38BDF8` | `#38BDF8` (`--accent`) |
   - **Meaning colours stay:** green for "synced" and "saved", amber for warnings, red for errors and urgent care.
   - **The green tile tone is replaced by a sky blue.** Tile colours still only tell tiles apart.
   - **Contrast is checked by tests:**
     - App: `theme_test.dart` checks 30 text pairs per mode against WCAG AA 4.5:1. The lowest is 4.86:1 in light mode (the teal tile) and 5.17:1 in dark mode (white on the primary blue).
     - Admin: `contrast.test.ts` checks every token pair.
     - The bright blues (`positive`, `--primary-accent`, `--accent`) are tested to stay *below* 4.5:1 on white, so they are never used for text.
2. **The flag stripe is removed** (`NationalStripe`, `AppColors.flag*` and the admin `.stripe` and `--flag-*` tokens).
   - A 4 px line from the primary blue to the awareness blue takes its place (`AccentLine` in both apps).
   - Tests check that no flag colour remains.
   - The notice "Not an official Government of the Republic of Zambia service" stays on every sign-in screen (`lib/shared/app_notice.dart`), and there is still no emblem.
3. **Modern icons: Material Symbols Rounded** (`material_symbols_icons`, Apache-2.0).
   - **Look:** every icon in the app is `Symbols.<name>_rounded`, at weight 400. Selected tabs and active states are filled (`fill: 1`), as in current Android apps. The framework's own back, menu and close buttons use the same set (`actionIconTheme`).
   - **Guard:** `test/app/icon_style_test.dart` fails if a Material `Icons.` icon or a non-rounded symbol comes back.
   - **Release builds** keep only the icons the app uses (icon tree-shaking).
   - **Admin website:** it keeps Lucide, which is already a modern rounded outline set.
4. **Less plain.**
   - Header gradients get two faint circles (`HeroDecorPainter`).
   - The person's chat messages are blue gradient bubbles; the assistant's answers are white cards next to the bot.
   - The empty chat greets people with a large bot.
5. **An assistant people can see: the PCa Assistant bot** (`lib/shared/widgets/assistant_avatar.dart`).
   - **The drawing:** a friendly robot whose head is a speech bubble, so it reads as "you can chat here". It has a blue gradient, a dark visor, white eyes, a light-blue smile and a light-blue antenna.
   - It is drawn in code (`CustomPainter`), so it is sharp at every size and needs no image files. Its colours are fixed, like an app icon.
   - **Motion:** it blinks now and then on the welcome screen, and never when the phone asks for less motion.
   - **Where it appears:**
     - a floating **Ask the assistant** button on the patient's Home and Learn tabs and on the clinician's home;
     - the chat tiles;
     - the chat header;
     - next to every answer;
     - the welcome screen.
   - Waiting shows "typing" dots instead of a spinner.

## Consequences

- The earlier decisions stay as the record of the national-colour version; their status lines point here.
- All tests that looked for the stripe or for `Icons.*` were updated. The accessibility suite now also covers:
  - the chat: empty, with an answer, and while recording;
  - the clinician chat;
  - Learn;
  - an article being read aloud.

  Each is checked in light and dark mode and at 200% text.
- A dependency is added, `material_symbols_icons`. Its three icon fonts are about 35 MB together (Rounded alone is 15 MB) and are all bundled in debug builds; release builds keep only the icons used (icon tree-shaking).
