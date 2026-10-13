---
name: Academic Neo-Vibrant
colors:
  surface: '#fbf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#fbf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ef'
  surface-container: '#efeeea'
  surface-container-high: '#e9e8e4'
  surface-container-highest: '#e4e2de'
  on-surface: '#1b1c1a'
  on-surface-variant: '#464834'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f1ed'
  outline: '#767961'
  outline-variant: '#c7c9ad'
  surface-tint: '#586400'
  primary: '#586400'
  on-primary: '#ffffff'
  primary-container: '#c0d901'
  on-primary-container: '#515c00'
  inverse-primary: '#bad200'
  secondary: '#5f5e5c'
  on-secondary: '#ffffff'
  secondary-container: '#e5e2de'
  on-secondary-container: '#656461'
  tertiary: '#006c47'
  on-tertiary: '#ffffff'
  tertiary-container: '#77e1ac'
  on-tertiary-container: '#006341'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5ef2b'
  primary-fixed-dim: '#bad200'
  on-primary-fixed: '#191e00'
  on-primary-fixed-variant: '#424b00'
  secondary-fixed: '#e5e2de'
  secondary-fixed-dim: '#c8c6c3'
  on-secondary-fixed: '#1c1c1a'
  on-secondary-fixed-variant: '#474744'
  tertiary-fixed: '#8df7c1'
  tertiary-fixed-dim: '#71dba6'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005235'
  background: '#fbf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2de'
  surface-canvas: '#ffffff'
  surface-subtle: '#f7f7f8'
  surface-dark: '#121212'
  accent-soft-blue: '#bccdfc'
  border-subtle: '#e5e5e7'
  text-on-primary: '#121212'
  text-on-dark: '#ffffff'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
  space-2xl: 4rem
---

## Brand & Style

This design system expresses a forward-looking, high-energy academic identity tailored for prospective students, faculty, and administrative portals. It blends the solemn prestige of higher education with a high-contrast digital posture driven by modern energy.

The aesthetic fuses **Corporate / Modern structure** with **High-Contrast kinetic accents**:
- High structure and discipline through dark architectural framing and generous clean whitespace.
- Electric visual pacing driven by high-visibility chartreuse/lime interactions that direct user intent.
- Editorial legibility designed for dense academic offerings, program catalogs, admissions workflows, and scholarly announcements.

## Colors

The palette balances deep graphite anchors against an electric institutional lime:

- **Primary (`#c0d901`)**: The high-voltage brand signature. Reserved strictly for key conversion points, interactive focus indicators, badge highlights, and primary calls to action. Always pair with `#121212` text to maintain WCAG AAA compliance.
- **Secondary (`#1d1d1b` / `#121212`)**: Serves as the bedrock of structural weight—used across mega-nav headers, hero section backdrops, primary typography, and dark thematic cards.
- **Tertiary (`#00875a`)**: Emerald green dedicated to verification, admission clearance indicators, success banners, and sustainability/research badges.
- **Accent Soft Blue (`#bccdfc`)**: Extracted secondary tone for auxiliary tags, campus event markers, and informational callout backgrounds.
- **Neutral Surface Foundations**: Pure canvas (`#ffffff`) layered over soft architectural gray (`#f7f7f8`) with crisp dividers (`#e5e5e7`).

## Typography

The typographic hierarchy pairs **Plus Jakarta Sans** for expressive, geometric, and authoritative headers with **Inter** for neutral, utilitarian body copy.

- **Headings & Badges**: Set in Plus Jakarta Sans with negative letter tracking (`-0.01em` to `-0.03em`) and heavy weights (`700`, `800`) to evoke modern institutional presence and clear scanability across degree listings.
- **Body & Data**: Relies on Inter (`400`, `500`) to maximize legibility across academic regulations, curriculum tables, and multi-paragraph institutional articles.
- **Responsive Scaling**: Display headers automatically collapse to mobile counterparts under 768px screen widths to prevent awkward word wraps.

## Layout & Spacing

The layout model utilizes a standard 12-column responsive fluid grid with strict container constraints:

- **Desktop (>= 1280px)**: 12 columns, max-width `1320px`, centered with `margin: 3rem` and `gutter: 1.5rem`.
- **Tablet (768px - 1279px)**: 8 columns, `margin: 2rem`, `gutter: 1.25rem`. Academic program filter bars convert into collapsible side-drawers.
- **Mobile (< 768px)**: 4 columns, full viewport width with `margin-mobile: 1.25rem` and `gutter-mobile: 1rem`. Multi-column card sets fold into single-column vertical stacks.
- **Rhythm**: Internal card and module spacing adheres to an 8pt base grid (`space-sm` to `space-2xl`).

## Elevation & Depth

Visual hierarchy uses sharp architectural surfaces, subtle borders, and low-opacity ambient shadows:

- **Level 0 (Flat / Structural Canvas)**: `#ffffff` or `#f7f7f8` surfaces bounded by `1px solid #e5e5e7`. Used for foundational sections and nested tabular views.
- **Level 1 (Interactive Cards & Content Blocks)**: Surface `#ffffff` framed with a subtle border (`#e5e5e7`) and an ambient shadow: `0px 4px 16px -2px rgba(18, 18, 18, 0.05)`.
- **Level 2 (Hover States & Program Highlights)**: Elevated shadow `0px 12px 28px -4px rgba(18, 18, 18, 0.08)`. Subtle accent offset: on hover, cards may display a top border accent strip of 3px in `#c0d901`.
- **Level 3 (Modals, Overlays, Floating Nav)**: `#ffffff` or `#121212` with `0px 20px 40px -8px rgba(0, 0, 0, 0.16)`. Dark navigation headers use clean edge separation without blurry glows.

## Shapes

The design system incorporates a high-radius curve language (pill-shaped elements for micro-interactions and large rounded corners for structural containers):

- **Buttons & Pills**: Fully rounded pill shapes (`rounded-full` / `9999px`) provide high tactile affordance and contrast against rigid editorial grid lines.
- **Cards & Banners**: Bounded by `1rem` (`16px`) corners to soften large surface areas.
- **Modals & Hero Modules**: Feature `1.5rem` (`24px`) curvature for modern containment.
- **Form Inputs**: Scaled at `0.75rem` (`12px`) to strike a balance between friendly touch areas and administrative efficiency.

## Components

### Buttons
- **Primary CTA**: Full pill shape (`border-radius: 9999px`), background `#c0d901`, text `#121212`, typography `label-lg`. Hover: brightness shift (`#b3ca00`) with subtle lift.
- **Secondary (Dark)**: Full pill shape, background `#1d1d1b`, text `#ffffff`. Hover: background `#333330`.
- **Tertiary / Ghost**: Transparent fill, 1.5px border `#1d1d1b`, text `#1d1d1b`. On dark backgrounds: border `#ffffff`, text `#ffffff`. Hover fills surface with 10% opacity tint.

### Badges & Chips
- **Academic Tag (Undergraduate, Postgraduate, Event)**: Full pill shape, `height: 28px`, padding `0.25rem 0.875rem`, text `label-md`. 
  - Standard: Background `#f7f7f8`, border `1px solid #e5e5e7`, text `#1d1d1b`.
  - Highlight / Anniversary / Milestone: Background `#c0d901`, text `#121212`.
  - Status Approved: Background `#e6f4ea`, text `#00875a`.

### Cards (Academic Program & News)
- **Structure**: Background `#ffffff`, border `1px solid #e5e5e7`, radius `1rem`, padding `1.5rem`.
- **Interactivity**: Clean lift to Level 2 elevation on hover. Image containers inside have `0.75rem` radius with overflow hidden.
- **Featured Variant**: Dark card style using `#1d1d1b` background, `#ffffff` heading text, and `#c0d901` badge placement for flagship degrees and institutional announcements.

### Inputs & Form Controls
- **Text Inputs**: Height `48px`, border `1.5px solid #e5e5e7`, radius `0.75rem`, padding `0 1rem`, text `body-md`. Focus state uses `border-color: #1d1d1b` with a `2px` ring in `#c0d901`.
- **Checkboxes & Radios**: 20px dimension, border `2px solid #71716e`. Checked state: background `#1d1d1b` with checkmark icon in `#c0d901`.

### Navigation Bars & Banners
- **Institutional Topbar**: Dark `#121212` background, white links with active underlines rendered in `#c0d901`.
- **Utility / Alert Ribbon**: Background `#c0d901`, text `#121212` (weight 700), used for admissions deadlines and academic calendar notices.