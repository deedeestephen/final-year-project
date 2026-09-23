---
name: Clinical Trust
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#43474d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#74777e'
  outline-variant: '#c4c6ce'
  surface-tint: '#49607e'
  primary: '#000f22'
  on-primary: '#ffffff'
  primary-container: '#0a2540'
  on-primary-container: '#768dad'
  inverse-primary: '#b0c8eb'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#000f25'
  on-tertiary: '#ffffff'
  tertiary-container: '#00244b'
  on-tertiary-container: '#6e8cbe'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d2e4ff'
  primary-fixed-dim: '#b0c8eb'
  on-primary-fixed: '#001c37'
  on-primary-fixed-variant: '#314865'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#d5e3ff'
  tertiary-fixed-dim: '#a9c8fc'
  on-tertiary-fixed: '#001b3c'
  on-tertiary-fixed-variant: '#274774'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  code-clinical:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
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
  gutter-desktop: 2rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 4rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system establishes a clinical-grade, high-integrity digital environment tailored for primary healthcare workers, clinical officers, and urology specialists navigating prostate cancer screening and diagnostic triage in Zambia. Operating in low-bandwidth, intermittent-connectivity, and field-station contexts, the visual interface conveys uncompromised precision, calm reassurance, and rapid readability under varied ambient lighting.

The design movement synthesizes **Modern Clinical Utility** with **Humanitarian Human-Centered Ergonomics**. It departs from generic consumer health aesthetics to deliver purposeful, high-contrast, distraction-free surfaces that elevate life-critical diagnostic insights.

- **Primary Persona:** Community health workers, nurses, and medical officers utilizing entry-level to mid-tier Android devices in decentralized clinics.
- **Emotional Atmosphere:** Authoritative, clinically sound, tranquil, and clear under duress.
- **Visual Tenets:** High data legibility, obvious state signifiers (sync/offline/online), explicit medical disclaimers, and generous tap targets that accommodate one-handed field interactions.

## Colors

The color architecture is built around calibrated contrast ratios, achieving strict WCAG 2.1 AA and AAA compliance across all critical diagnostic and triage pathways.

- **Deep Clinical Navy (`#0A2540`):** Anchors foundational structures, primary navigation, headers, and core action surfaces. Provides grounding authority and sharp text contrast against warm clinical neutrals.
- **Clinical Blue Accent (`#0F3460`):** Used for elevated cards, secondary containers, and focused state borders.
- **Teal / Emerald Accents (`#0D9488` / `#10B981`):** Represents positive diagnostic health indices, normal biopsy findings, confirmed synchronizations, and verified triage thresholds.
- **Warm Neutral Canvas (`#F8FAFC` to `#FFFFFF`):** Replaces sterile, harsh whites with daylight-friendly warm clinical whites that reduce eye fatigue during long shifts in clinical facilities.
- **Clinical Semantics & Safety Indicators:**
  - *Risk / Malignancy Alert:* Crimson Red (`#BE123C`), used strictly for PSA elevations, critical Gleason triage alerts, and overdue follow-ups.
  - *Warning / Inconclusive:* Warm Amber (`#D97706`), signaling borderline PSA test outcomes, low device storage, or pending specimen confirmations.
  - *Sync / Offline Notice:* Slate Cyan (`#0284C7`), indicating passive local queue processing and offline-first storage states.

## Typography

The typographic system couples the modern, geometric humanity of **Plus Jakarta Sans** with the structural legibility of **Inter** and the deterministic precision of **JetBrains Mono**.

- **Headlines (Plus Jakarta Sans):** Crafted with balanced, open apertures that maintain clarity at scanning speeds during triage. It prevents clinical fatigue while retaining institutional authority.
- **Body & Controls (Inter):** Serves as the primary workhorse for patient files, clinical decision narratives, medication instructions, and diagnostic rationales. Inter’s tall x-height guarantees optimal rendering across low-DPI Android screens under direct sunlight.
- **Clinical Data & Patient Identifiers (JetBrains Mono):** Monospaced numeric alignment ensures that PSA densities, Gleason score calculations, laboratory reference intervals, and national health IDs align precisely across tabular cards and intake summaries without visual drift.

## Layout & Spacing

The layout is optimized primarily for single-hand portrait mobile use on Android devices (360dp–412dp screen widths), adapting cleanly to regional clinic tablets (768dp) and desktop workstation dashboards (1024dp+).

- **Mobile Rhythm:** Strict 4-column layout on mobile, utilizing a `1rem` (16px) outer margin and gutter. Horizontal margins expand to `2rem` on tablets (8 columns) and `4rem` on desktop displays (12 columns).
- **Touch-First Ergonomics:** Interactive targets adhere to an uncompromising minimum hit boundary of 48×48dp, preventing erroneous taps during rapid clinical data capture in field conditions.
- **Vertical Spacing Scale:** Built upon an 8pt base grid with a 4pt sub-grid for badge padding and internal clinical chips. Gaps between related medical data rows default to `space-sm` (8px), while grouped diagnostic sections separate at `space-lg` (24px).

## Elevation & Depth

This system avoids heavy drop shadows, which can wash out under high ambient African sunlight and perform poorly on entry-level GPU hardware. Instead, depth is conveyed through **Tonal Layering and Crisp Low-Contrast Outlines**.

- **Level 0 (Canvas Base):** Surface tint `#F8FAFC`. Houses background content and scrollable triage records.
- **Level 1 (Card & Module Layer):** `#FFFFFF` surface accompanied by a crisp, hairline border (`1px solid #E2E8F0`). A gentle, cool tinted ambient drop (`box-shadow: 0 1px 3px rgba(10, 37, 64, 0.05), 0 1px 2px rgba(10, 37, 64, 0.03)`) supplies separation.
- **Level 2 (Active Sheets, Drawers, Sticky Modals):** `#FFFFFF` surface with an elevated border (`1px solid #CBD5E1`) and a directional ambient shadow (`0 10px 15px -3px rgba(10, 37, 64, 0.08), 0 4px 6px -2px rgba(10, 37, 64, 0.04)`).
- **Level 3 (Urgent Clinical Overlays & Critical Alerts):** Pure white container with a 2px high-visibility outline tinted to the respective semantic severity (e.g., `#BE123C` for high-risk flags) with a high-attenuation backdrop overlay (`rgba(10, 37, 64, 0.45)`).

## Shapes

The design system implements a controlled shape geometry that communicates clinical warmth without appearing whimsical or informal.

- **Base Corner Radius (`rounded-2xl` / 16px):** Standard for patient diagnostic cards, AI result insight containers, and clinical intake modals. The wide radius creates distinct visual grouping and minimizes UI harshness.
- **Intermediate Radius (`rounded-lg` / 8px):** Applied to form fields, primary input pickers, clinical dropdown selectors, and action buttons.
- **Micro Radius (`rounded` / 4px to 6px):** Reserved for technical data tables, monospaced lab values, and PSA gradient bars.
- **Full Pill (`rounded-full` / 9999px):** Exclusively utilized for status chips, sync indicators, urgency tags, and triage category labels.

## Components

### Buttons & Touch Triggers
- **Primary Clinical Action:** Background `#0A2540`, text `#FFFFFF`, 48px minimum height, `rounded-lg` (8px). Pressed state shifts to `#0F3460`. Displays an inline loading indicator during local SQLite or remote network sync operations.
- **Secondary / Operational:** Background `#F1F5F9`, text `#0A2540`, border `1px solid #CBD5E1`.
- **Destructive / Override Action:** Light background `#FFF1F2`, border `1px solid #FDA4AF`, text `#BE123C`. Used for manual overrides of AI recommendations.

### Network & Sync Badges (Offline-First State Indicators)
- **Online (Synced):** Emerald chip (`#ECFDF5`), dot `#10B981`, text `#065F46`, label: "Synced · Central Registry".
- **Offline (Local Cache):** Slate chip (`#F1F5F9`), dot `#64748B`, text `#334155`, label: "Offline Mode · Saved Locally".
- **Syncing (Active Push):** Sky chip (`#F0F9FF`), animated pulsing dot `#0284C7`, text `#075985`, label: "Syncing 3 Records...".

### Safety Disclaimers & Decision-Support Banners
- Prominently anchored below diagnostic summaries with a 1px border and soft tinted background (`#FEF3C7` amber or `#E0F2FE` cyan).
- Accompanied by a bold semantic icon and explicit clinical notice: "AI recommendation is an assistive screening tool and does not substitute histological biopsy confirmation or specialist clinical judgment."

### Clinical Cards & Assessment Panels
- Pure white container `#FFFFFF`, 16px corner radius (`rounded-2xl`), padded with `1.25rem`.
- Divided into structured sub-zones: Patient Demographics (Header), Monospaced Biomarkers (Body: PSA, Free/Total Ratio, DRE findings), and AI Risk Score Indicator (Gradient bar with Teal/Amber/Red delineations).

### Inputs & Assessment Form Controls
- Height 48px, background `#FFFFFF`, border `1.5px solid #CBD5E1`, text `#0A2540`.
- Focus state provides an immediate 2px outer ring in Deep Clinical Teal (`#0D9488`).
- Checkboxes and radio buttons maintain a 24×24px footprint with clear checked states for easy operation when wearing clinical examination gloves.