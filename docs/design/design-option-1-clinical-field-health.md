---
name: Clinical Field Health
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006c4e'
  on-secondary: '#ffffff'
  secondary-container: '#97f5cc'
  on-secondary-container: '#007353'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2f1500'
  on-tertiary-container: '#c76c00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#97f5cc'
  secondary-fixed-dim: '#7bd8b1'
  on-secondary-fixed: '#002115'
  on-secondary-fixed-variant: '#00513a'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an uncompromised, highly functional clinical utility tailored for community health workers, clinical officers, and patients navigating mobile health workflows across Zambia. The visual style balances approachable warmth with institutional authority: reliable, high-contrast, and strictly free of visual noise or tech-futuristic tropes. 

Every view respects low-connectivity, varied-lighting field environments (from direct midday sun to low-light rural clinics). Rather than relying on soft decorative gradients or translucent layers, the system utilizes clear physical bounding boxes, crisp neutral borders, solid high-contrast text, and generous spacing. The emotional posture is calm, dependable, reassuring, and immediate—minimizing cognitive fatigue during critical triage, patient intake, and medication tracking.

## Colors

The palette establishes clinical clarity through high-contrast solid tones:

- **Primary Canvas & Surfaces**: The base canvas is `#f8fafc` (Slate 50), providing a soft, glare-reducing medical white. Card and panel surfaces rest on pure `#ffffff` with structural `#e2e8f0` (Slate 200) borders.
- **Primary Ink & Headings**: Text and primary structural controls use deep Slate `#0f172a` (Slate 900) and `#1e293b` (Slate 800), guaranteeing AAA contrast ratings against white backgrounds.
- **Clinical Emerald Accents**: Deep Forest Green `#047857` and vibrant Clinical Emerald `#059669` represent positive clinical states, completed doses, successful syncs, vitals in normal range, and primary progression actions.
- **Amber Alerts**: Amber `#d97706` is reserved for pending syncs, non-critical vitals deviations, stock replenishment notices, and observational warnings.
- **Critical Red**: Emergency alerts and critical clinical contraindications use `#b91c1c` (Red 700) on soft `#fef2f2` backgrounds.
- **Secondary Slate Tint**: Subdued clinical meta-information, timestamps, and secondary identifiers utilize `#64748b` (Slate 500) and `#475569` (Slate 600), ensuring legibility remains sharp without dominating the visual hierarchy.

## Typography

Plus Jakarta Sans is employed universally across headlines, body copy, and UI microcopy. Its generous x-height, clear open apertures, and friendly geometric clarity offer maximum legibility on low-cost Android displays, cracked glass screens, and outdoor sunlight conditions.

- Clinical numeric readouts (dosages, patient age, temperature, blood pressure) prioritize semi-bold to bold weights to prevent misinterpretation.
- Avoid using weights below `400`. Body sizes remain strictly at or above `15px` for reading ease, with `13px` reserved solely for non-critical timestamps or field descriptors.
- All capitalizations in tags/badges (`label-sm`) include explicit tracking (`0.05em`) to avoid character collisions.

## Layout & Spacing

The layout model is driven by vertical flow, thumb-driven interaction, and high touch-target clearance:

- **Grid Architecture**: Mobile viewports utilize a 4-column fluid layout with a mandatory `1rem` (16px) margin and gutter. Tablets scale to 8 columns with `1.5rem` gutters. Maximum desktop layout width for administrative views is bounded at `1120px` to maintain focused visual scanning.
- **Vertical Rhythm**: Clinical cards and grouped information blocks stack with a minimum vertical separation of `space-md` (16px). Related metadata rows within cards maintain tight `space-xs` (4px) to `space-sm` (8px) associations.
- **Touch Target Integrity**: All interactive touch surfaces strictly maintain a minimum physical target size of 48px × 48px.

## Elevation & Depth

This system avoids ambient blurry shadows, skeuomorphic bevels, or colored diffuse glows, which degrade under high outdoor ambient light.

- **Crisp Structural Outlines**: Depth is achieved primarily through pure white surfaces resting on `#f8fafc` canvas, delineated by solid `1px` or `1.5px` borders using `#e2e8f0` (Slate 200).
- **Active Focus & Selection**: Selected cards or focused fields substitute the neutral border with a prominent `2px` stroke of `#047857` (Clinical Green) or `#0f172a` (Slate 900), paired with an optional flat inset tint.
- **Floating Modals & Drawers**: When a modal, offline status banner, or triage drawer appears above the main viewport, it uses a subtle, grounded drop outline: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)`, anchored by a 1px border of `#cbd5e1`.

## Shapes

The design system implements a consistent **Level 2 (Rounded)** shape scale.

- Standard inputs, buttons, and action sheets utilize an `8px` (`0.5rem`) corner radius. This conveys approachable, humane care without feeling juvenile or overly bubble-like.
- Patient summary cards, medical record tiles, and dialog containers use `12px` to `16px` (`rounded-lg` / `rounded-xl`) corner radiuses to soften large functional modules.
- Pill badges and status indicators (`rounded-full`) are used exclusively for compact clinical status markers (e.g., "Active", "Referred", "Vaccinated").

## Components

### Buttons
- **Primary Clinical Action**: Solid `#047857` background with pure `#ffffff` text, minimum height 48px, horizontal padding `1.25rem`, bold label (`label-lg`). Hover/active states darken to `#065f46`.
- **Secondary Structural Action**: Solid `#0f172a` background with `#ffffff` text, used for primary navigation steps, triage routing, or data submission.
- **Neutral Outlined Action**: Pure `#ffffff` background with `1.5px` solid `#cbd5e1` border and `#1e293b` text.

### Form Inputs & Selectors
- Background is crisp `#ffffff` with a `1.5px` `#cbd5e1` border. Active/focused state shifts to a `2px` `#047857` border.
- Input fields have an internal height of 52px to facilitate rapid text or numeric entry with one-hand field operation. Labels sit outside the field in `#1e293b` (`label-md`), accompanied by explicit micro-instructions or units (e.g., "kg", "mg/dL", "DD/MM/YYYY") in `#64748b`.

### Clinical Cards & Record Modules
- Containers are rendered with `#ffffff` backgrounds, an `8px` corner radius, and a 1px `#e2e8f0` border.
- Critical patient alerts within cards use an unmissable left accent border (4px solid `#047857`, `#d97706`, or `#b91c1c`).

### Status Badges & Chips
- Designed for zero ambiguity. Status chips feature a solid high-contrast tinted background with a matching dark foreground text:
  - Normal / Verified: `#ecfdf5` background, `#047857` text, `#a7f3d0` border.
  - Follow-up Needed / Warning: `#fffbeb` background, `#b45309` text, `#fde68a` border.
  - Urgent / Overdue: `#fef2f2` background, `#b91c1c` text, `#fecaca` border.

### Checkboxes & Radio Buttons
- High-visibility square (checkbox) and round (radio) selectors with a minimum dimension of 24px × 24px within a 48px interactive touch container. Checked states feature solid `#047857` fills with bold white check/dot glyphs.

### Offline & Sync Indicators
- A dedicated sticky banner at the top of the viewport indicates sync status: offline entries saved locally display an amber state (`#fef3c7` background, `#92400e` text), switching to solid `#047857` when connected and verified.