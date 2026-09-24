# ADR-004: Zambian national colours for the app theme

- **Status:** Accepted (owner request, 2026-09-24). Supersedes the colour palette of ADR-002; ADR-002's legibility rules stay.
- **Context:** The owner asked for the app to follow the style of Zambian government public applications.

## Decision
- Use the **Zambian flag colours** as the theme:
  - green for bars and main buttons
  - red for errors
  - black for text
  - orange (copper) for warnings and highlights
- A thin **national stripe** (green, red, black, orange) appears under the top bar of the sign-in and home screens.
- **No national emblem, coat of arms or government name is used.**
  - The app is a research prototype, not a government service.
  - Using official emblems would make people think it is an official service. That would be misleading, and it is not the owner's to use.
- Every sign-in screen carries: "Research prototype. Not a medical device. Not an official Government of the Republic of Zambia service."

## Accessibility
The exact flag colours do not all reach WCAG AA contrast when used behind or as text:

| Flag colour | Contrast problem | Colour used for text and buttons |
|---|---|---|
| Green `#198A00` | about 4.49:1 with white | deep green `#146E00` (about 6.5:1) |
| Red `#DE2010` | about 4.5:1 on its tint | deep red `#B81A0D` |
| Orange `#EF7D00` | about 2.6:1 on white | deep copper `#A04A00` |

The exact flag colours stay for the stripe and for icons. Every text/background pair is checked in `mobile/test/app/theme_test.dart`.

ADR-002's legibility rules are unchanged:
- body text ≥ 15 px
- 48 dp touch targets
- 52 px inputs
- 4 px severity accent
- states always written in words

## Consequences
- Tokens were renamed from navy/teal to `primary`, `positive` and `linkText` (`mobile/lib/app/theme/tokens.dart`). The flag colours are exposed as `flagGreen`, `flagRed`, `flagBlack` and `flagOrange`.
- `NationalStripe` (`mobile/lib/shared/widgets/national_stripe.dart`) is purely decorative and excluded from screen readers.
