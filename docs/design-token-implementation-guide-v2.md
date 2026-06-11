# Design Token System - Implementation Guide

> A structured design token network for scalable, maintainable UI. This document serves as the single reference for designers understanding the system's mental model and for developers onboarding to the token-driven CSS architecture.

**Document version:** 2.0
**Last updated:** 2026-02-20
**Author:** Mark Andrassy, UX/UI Designer
**Export plugin:** [Variable to CSS](https://github.com/amarkkk/figma-variable-to-css/tree/experimental) (v1.9)

---

## Links & Resources

| Resource | Link |
|----------|------|
| Design token spreadsheet (Google Sheets) | `[placeholder]` |
| Token architecture Miro board | `[placeholder]` |
| Figma file | `[placeholder]` |
| Variable to CSS plugin | [github.com/amarkkk/figma-variable-to-css](https://github.com/amarkkk/figma-variable-to-css/tree/experimental) |
| Variable Network Explorer | [github.com/amarkkk/figma-variable-network](https://github.com/amarkkk/figma-variable-network) |
| Variable Mover | [github.com/amarkkk/figma-variable-mover](https://github.com/amarkkk/figma-variable-mover) |
| Variable Remapper | [github.com/amarkkk/figma-variable-remapper](https://github.com/amarkkk/figma-variable-remapper) |

---

## Table of Contents

0. [Glossary - Key Concepts](#0-glossary---key-concepts)
1. [Executive Summary - Why This Exists](#1-executive-summary---why-this-exists)
2. [Quick Start by Role](#2-quick-start-by-role)
3. [System Architecture - The Three-Plus-One Layer Model](#3-system-architecture---the-three-plus-one-layer-model)
4. [The Pipeline - From Spreadsheet to Browser](#4-the-pipeline---from-spreadsheet-to-browser)
5. [Token Categories](#5-token-categories)
   - [5.1 Colors](#51-colors)
   - [5.2 Typography](#52-typography)
   - [5.3 Spacing](#53-spacing)
   - [5.4 Dimensions](#54-dimensions)
   - [5.5 Radius](#55-radius)
6. [The Aliases Extended Layer - When Four Modes Aren't Enough](#6-the-aliases-extended-layer---when-four-modes-arent-enough)
7. [Design Intent vs. CSS Output](#7-design-intent-vs-css-output)
8. [Exceptions and Known Shortcuts](#8-exceptions-and-known-shortcuts)
9. [Plugin Tooling Reference](#9-plugin-tooling-reference)
10. [Testing and Validation](#10-testing-and-validation)

---

## 0. Glossary - Key Concepts

This section introduces the terminology used throughout this document. Reading it first will help contextualize the sections that follow.

| Term | Definition |
|------|------------|
| **Token** | A named design value (color, size, spacing, etc.) stored as a Figma Variable and exported as a CSS custom property. |
| **Foundation** | The bottom layer. Raw design primitives - the actual px values, color hex codes, font families. These are calculated in a spreadsheet and imported into Figma. |
| **Alias** | Middle layer. Semantic grouping of foundation values (e.g., `micro-space`, `primary-color`, `typo-size-h1`). Provides meaningful naming and in some categories groups values by scale (micro, meso, macro). |
| **Aliases Extended** | Optional intermediate layer (between Alias and Mapping) for component-scoped tokens that need responsive behavior beyond what Foundation modes provide. Currently used in Space and Dimension only. |
| **Mapping** | Top layer. The developer-facing endpoint. Component-specific, flattened names that drop the category prefix. This is what goes into component CSS. |
| **Composite token** | A token that combines multiple properties into one definition. In Typography, Figma Text Styles serve as composite tokens by bundling family, weight, size, and line-height. |
| **Mode** | A variant axis on a Figma Variable collection. Responsive modes = Desktop/Laptop/Tablet/Mobile. Each mode stores a different value for the same variable. |
| **VR / Vertical Rhythm** | A proportional spacing unit derived from body line height. All VR multiples scale together across breakpoints, providing consistent vertical proportions. |
| **Fixed export** | The CSS export mode currently in use - outputs discrete values at each breakpoint via `@media` queries. |
| **Fluid export** | Alternative CSS export mode - outputs `clamp()` values for continuous viewport-based scaling. Available but not deployed. |
| **Grid proportions** | Pre-calculated fractional widths (whole, three-quarters, two-thirds, half, third, quarter) derived from column count on a 12-column grid. In the CSS export, these are automatically detected and output as column span numbers (12, 9, 8, 6, 4, 3) and `fr` unit variants, not pixel values. |
| **Cross-collection reference** | When a token in one collection (e.g., Space) references a token in another collection (e.g., Dimension). Used for sharing Vertical Rhythm values between spacing and dimension contexts. |
| **Detached variable** | A Figma Variable that holds a literal value instead of referencing another variable. Sometimes necessary due to Figma limitations (e.g., opacity modification). |
| **Piecewise scaling** | An approach to fluid CSS where different linear interpolations are used between each breakpoint pair (Desktop-Laptop, Laptop-Tablet, Tablet-Mobile), rather than a single linear slope across all viewports. |
| **Mobile-first** | CSS output direction. The smallest breakpoint values go in `:root`, with ascending `@media (min-width: ...)` queries for larger viewports. |
| **Desktop-first** | CSS output direction. The largest breakpoint values go in `:root`, with descending `@media (max-width: ...)` queries for smaller viewports. |
| **Dynamic breakpoints** | Breakpoint values automatically extracted from Figma Variables (the viewport variable in the Dimension Foundations collection) rather than hardcoded in the plugin. |

---

## 1. Executive Summary - Why This Exists

### The problem

During Phase 1 of this project, scalable design tokens were proposed on the foundation layer to support a large UI overhaul. The design intent was that foundation variables would propagate to all components, providing built-in responsive scaling. The design was completed and handed off to development.

However, when the design was implemented, the variable-based approach was not adopted. Fixed desktop values were hardcoded instead. The project went to production with 1920px-width desktop values applied across all viewport sizes, with no scaling or breakpoint-specific adjustments.

Ten months later, during a project review, we received client feedback that the UI had a "zoomed-in" feel - proportions across typography, spacing, and component sizing were off, and the site only felt balanced when manually scaling the browser to roughly 80%. This happened for two reasons:

1. **Implementation side:** Desktop-only fixed values were used across all viewports. No variables, no responsive scaling.
2. **Design side:** The original foundation values were calibrated for full-width desktop (1920px) without sufficient testing across viewport sizes. Some of the base values were simply too large.

Fixing this required more than adjusting individual values. It required visibility into what values exist, what they affect, and how they relate to each other. That infrastructure did not exist.

### The solution

Phase 2 introduced a structured design token network - a layered system where every design value (color, spacing, typography, dimensions, radii) flows through a defined chain from raw primitives to component-specific endpoints. This gives us:

**Traceability.** Every value on every component can be traced back to its origin. Change a foundation value, and every downstream consumer updates.

**Proportional control.** Typography, spacing, and dimensions scale together across breakpoints because they share foundation relationships, not because someone eyeballed matching values.

**Safe iteration.** Previously, card template 1 used `space-500` for its horizontal padding, but adjusting that value was risky because we had no visibility into what else referenced `space-500` - it could affect horizontal gaps, vertical margins, or entirely different components. Now that card has its own scoped mapping token (`card-template-1-padding-x`), and adjusting it only affects that card. Need to scale everything down for a breakpoint? Adjust the foundation layer. No component-by-component hunting.

**Smaller component base.** The token system significantly trims the Figma file because we no longer need endless component variants just to accommodate different numeric values. Layout-related changes are stored in component variants; value-related changes are handled by modes. This means the component library stays lean even as the system covers more breakpoints. Design testing happens not during component building, but through instances where applied modes reflect specific viewport circumstances.

**Reusability.** This system and methodology can be applied to other projects. The plugins, the spreadsheet workflow, and the layered token architecture are project-agnostic.

Without this token system, adjusting values was blind work. Seeing that a card used `space-500` and deciding to reduce it meant not knowing what else referenced that same value, whether horizontally or vertically, across which components. The six custom Figma plugins were built for exactly these kinds of structural challenges that Figma alone cannot solve.

### What changed from Phase 1

| Aspect | Phase 1 | Phase 2 |
|--------|---------|---------|
| Token depth | Foundation only | Foundation - Alias - Mapping (3 layers + optional Aliases Extended) |
| Component coupling | Components referenced raw primitives (e.g., `space-500`) | Components reference named endpoints (e.g., `card-template-1-padding-x`) |
| Scaling control | Per-value, manual | Systematic - shared foundation values ripple through |
| Breakpoint management | Not implemented (desktop values everywhere) | Explicit - 4 Figma modes (Desktop, Laptop, Tablet, Mobile) |
| Restructuring tools | Manual Figma work | 6 custom Figma plugins for bulk operations |

### What this means for the team

This is a substantial change from how the team currently works. That needs to be acknowledged upfront.

It is also worth acknowledging that this change would have been smaller if Phase 1 had been implemented as designed. The original design proposed scalable foundation-level variables that would propagate to all components. If that had been delivered, the current step would be upgrading from foundation-level variables to the three-layer mapping structure - a meaningful but incremental step, and the variable-based mindset would already be established. Since Phase 1 was implemented with hardcoded desktop values instead, the gap is larger now. To be fair, at the time, design did not provide a custom plugin for translating Figma variables to CSS - solving that export workflow would have been a development-side challenge.

Currently, frontend developers inspect Figma components and see fixed pixel values (e.g., "padding: 30px"). With the token system, they will see variable references with fallback values (e.g., `var(--card-template-3-padding-x, 27px)`). The fixed fallback value is for the specific Figma mode the component is displayed in - developers should use only the CSS variable name, not the fallback.

The existing codebase has hardcoded values that need to be replaced with the corresponding token variables from the Mapping layer. This is a migration effort - the `tokens.css` file declares the variables, but components need to be updated to reference them.

The investment pays off in iteration speed and in true responsivity, which we have proposed to the client. Once implemented, recalibrating the entire page for a different viewport or proportion set means updating the spreadsheet and re-exporting. No component-by-component adjustment needed.

---

## 2. Quick Start by Role

### For Designers

**Relevant sections:** 3, 5, and 6.

The core mental model: a large portion of design values now live in Figma Variables, organized into collections by category (Colors, Typography, Spacing, Dimensions, Radius). This does not cover everything - shadows, gradients, and image guidelines, for example, are not part of the variable system. But the categories covered represent a substantial portion of the visual foundation.

Within each collection, variables are layered: Foundations hold the raw values, Aliases add semantic meaning and grouping, and Mappings flatten everything to component-specific endpoints. Not all categories use all layers equally - see Section 5 for the specifics.

**When you design a new component:**

1. Check if appropriate mapping tokens already exist for the component or a similar one.
2. For quick prototyping, reuse mapping tokens from related components. For example, when creating a carousel element for the homepage, using page-level layout gaps and call-to-action padding values from the mapping layer is a practical approach. This lets you experiment while staying within the established rhythm, since those values originate from the same foundation. Only the mapping layer is exposed for selection by default - foundation and alias collections are hidden from publishing and scoping.
3. Every new component should ultimately have its own mapping tokens - these are the endpoints that frontend developers will use. If you are designing a carousel or an accordion, its mapping tokens need to be defined. For experimenting and prototyping, you can reuse any variable from the corresponding mapping layer, since those are already part of the system and will keep your prototype within the established rhythm.
4. If no suitable Alias exists, trace what you need back to Foundations and create the Alias first.
5. Avoid applying Foundation tokens directly to components where possible. In practice, this is a guideline rather than a hard rule - the color collection, for example, has mapping tokens that point directly back to foundation values because the alias layer is not fully built out. The main benefit of routing through aliases is avoiding name collisions: foundation and alias tokens can share similar names, and accidentally referencing the wrong layer is easy when they are identically named.

### For Frontend Developers

**Relevant sections:** 4, 5, and 7. Skim 3 for context.

The following is the intended design workflow. These are suggestions from the design side - the team should adapt the specifics to fit the existing development process.

1. **Import `tokens.css` globally** in the project, before any component styles.
2. **Extract token names from Figma components.** In Figma DevMode, inspect component properties to find the variable references. You will see values like `var(--card-template-3-padding-x, 27px)`. Use the variable name (`--card-template-3-padding-x`); the numeric fallback is only the value for the currently displayed Figma mode and is not needed in CSS.
3. **Apply tokens in component CSS** using `var(--token-name)`. The Mapping layer tokens are your primary interface - these are the component-scoped names.
4. **Value-based responsivity is handled automatically.** You do not need to add media queries for value scaling (font sizes, spacing, padding, dimensions). The tokens.css file already contains breakpoint-specific overrides for values that change across viewports. Values update automatically. The exported CSS uses mobile-first `@media (min-width: ...)` queries by default - see Section 4 for details on breakpoint direction.
5. **Layout-based responsivity is your responsibility.** When a component's structure changes between viewports, you add the media queries. For example, a card that has a vertical layout on mobile (image on top, content below) but switches to a horizontal layout on larger screens (image taking one-quarter width, content taking three-quarters). In Figma, these layout changes typically correspond to component variants - especially when the component property is "Orientation" with values "Horizontal" and "Vertical." When you see these orientation variants in Figma, that is a signal that a layout media query is needed in CSS.

What a component stylesheet looks like:

```css
.accordion__header {
  padding: var(--accordion-header-padding-y) var(--accordion-header-padding-x);
  gap: var(--accordion-header-gap);
  min-height: var(--accordion-min-height);
  background: var(--accordion-header-surface-normal-enabled);
  color: var(--accordion-header-title-normal-enabled);
  border: 1px solid var(--accordion-header-border-normal-enabled);
  border-radius: var(--radius-accordion-faq);
}

.accordion__header:hover {
  background: var(--accordion-header-surface-normal-hovered);
  border-color: var(--accordion-header-border-normal-hovered);
}
```

### For Testers

**Relevant sections:** 7 and 10.

The following are suggestions from the design perspective on how the token system might affect testing workflows. These are not instructions - the testing team should evaluate what makes sense for their process.

Previously, manual testing required checking exact pixel values at each breakpoint, with testing hours adding up quickly for each media query.

With the token system, design values are defined in the CSS file and applied via variables. This may shift what needs manual verification:

- **Layout breakpoints:** Does the layout change correctly at the defined viewport widths? (e.g., does a card switch from vertical to horizontal layout at the right breakpoint?)
- **Interactive states:** Do hover, focus, pressed, and disabled states apply the correct visual treatment?
- **Token presence:** Are components using `var(--token-name)` references rather than hardcoded values? This can be spot-checked in browser DevTools.
- **Container width and proportions:** Do content areas occupy the intended proportion of the page at each breakpoint?

The principle is that if a component correctly references a token and the tokens.css file is current, the value is correct by definition - it comes directly from the Figma export.

---

## 3. System Architecture - The Three-Plus-One Layer Model

### The layers

The token system uses a three-layer architecture with an optional intermediate layer:

```
+---------------------------------------------------------------------------+
|  1. FOUNDATIONS                                                            |
|                                                                            |
|  Raw design primitives. The actual values, calculated in a spreadsheet.    |
|  - Colors: brand/neutral/accent/utility/fancy scales                      |
|  - Typography: font families, weights, sizes, line heights                |
|  - Spacing: fixed scale (2px-96px), gutter, site margin                  |
|  - Dimensions: grid values, vertical rhythm multiples, fixed sizes        |
|  - Radius: base scale (4px-200px)                                         |
|                                                                            |
|  Modes: 4 breakpoints (Desktop, Laptop, Tablet, Mobile)                   |
|  Exception: Colors have a single mode (no responsive variation)            |
|  Exception: Radius has modes but values are nearly identical               |
|                                                                            |
|  Note: Some foundation tokens reference other foundation tokens            |
|  (e.g., tag-height references vertical-rhythm-020). These are named        |
|  values within the foundation layer, not strict raw primitives.            |
+---------------------------------------------------------------------------+
                                   |
                                   | references
                                   v
+---------------------------------------------------------------------------+
|  2. ALIASES                                                                |
|                                                                            |
|  Semantic grouping and flattening of Foundation values.                    |
|  - Colors: planned [role]/[element]/[strength]/[context]/[state]          |
|    structure (currently incomplete - see Section 8)                        |
|  - Typography: role-based names (hero, h1-h6, body, label, etc.)         |
|  - Spacing: micro/meso/macro grouping                                     |
|  - Dimensions: content width, header height, page dimensions              |
|  - Radius: combined with Mappings (single collection)                     |
|                                                                            |
|  1 mode - references Foundation values that already carry their own        |
|  mode-specific responsive values.                                          |
+---------------------------------------------------------------------------+
                                   |
                                   | references
                                   v
+- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
|  2.1 ALIASES EXTENDED  (optional - Space and Dimension only)               |
|                                                                            |
|  Component-scoped tokens that need responsive overrides beyond what        |
|  Foundation modes provide. Used when the built-in responsive scaling       |
|  of foundation values is not sufficient for a specific component.          |
|                                                                            |
|  Example: Card template 2 padding-x needs space-600 on Desktop,           |
|  space-400 on Laptop, space-250 on Tablet and Mobile. No single           |
|  foundation token scales this way, and introducing a new foundation        |
|  value just for this would bloat the system. Instead, this layer           |
|  reuses existing values with per-breakpoint overrides.                     |
|                                                                            |
|  4 modes (breakpoints) because the applied value changes per               |
|  breakpoint - not just the underlying foundation value.                    |
+- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
                                   |
                                   | references
                                   v
+---------------------------------------------------------------------------+
|  3. MAPPINGS                                                               |
|                                                                            |
|  The endpoint. Component-specific, flattened token names.                  |
|  This is what frontend developers consume.                                 |
|                                                                            |
|  For heavily interactive elements (buttons, inputs, cards), the            |
|  intended naming structure is:                                             |
|  [component]/[role]/[variant]/[element]/[context]/[state]                  |
|  Example: button/brand/filled/surface/normal/enabled                       |
|                                                                            |
|  For simpler or section-level elements, a shorter structure is used:       |
|  [component]-[property]-[qualifier]                                        |
|  Example: cta-padding-y, page-site-margin                                  |
|                                                                            |
|  1 mode - references Alias or Alias Extended values that already           |
|  carry responsive behavior.                                                |
|                                                                            |
|  Typography note: Typography does not have a Mapping collection.           |
|  Composite tokens (Text Styles in Figma) serve as the mapping layer,       |
|  bundling family + weight + size + line-height into named styles.          |
+---------------------------------------------------------------------------+
```

### About the Color layers specifically

The Color Foundations and Aliases need extra context. The foundation layer contains:

- `brand/*` - the primary brand palette (50-950 scale)
- `neutral/*` - grayscale (0-950)
- `accent/*` - secondary accent colors (50-950)
- `utility/*` - semantic colors (red, green, blue, yellow, link, etc.)
- `fancy/*` - the client's decorative brand palette, with primary and secondary groupings. "Fancy" is a working name for the sake of time; these are the client's secondary brand colors.

The Alias layer currently contains:

- `fancy/solid/*` - a subset (4 out of 16) of the fancy palette that are actually used in components
- `fancy/transparent/*` - opacity-modified variants of those 4 colors (detached from foundations due to Figma limitations)
- Various groupings (action, primary, neutral, gold, utility, border, etc.) - **these are largely obsolete or incomplete.** Most are near-duplications of the foundation layer, not proper semantic mappings. They exist because there was not enough time to build out the intended alias structure.

The intended Alias structure (for a future iteration) would follow a `[role]/[element]/[strength]/[context]/[state]` pattern - see the token architecture Miro board. Currently, the Mapping layer sometimes bypasses the Alias layer and references Foundations directly.

### How a value travels through the layers

Values can flow through different paths depending on the category and complexity:

**Path 1: Foundation - Alias - Mapping** (standard)
```
Foundation:     --space-200: 16px
                    |
Alias:          --space-micro-space-200: var(--space-200)
                    |
Mapping:        --accordion-header-gap: var(--space-micro-space-200)
```

**Path 2: Foundation - Alias - Alias Extended - Mapping** (when extra responsivity is needed)

This is the most complex path. At the Aliases Extended layer, each breakpoint mode can reference a *different* alias value. Combined with the fact that those alias values themselves reference foundation values that scale across breakpoints, there are two dimensions of responsive change happening simultaneously.

A simplified view for card template 2 horizontal padding:

```
Alias Extended modes:
  Desktop → var(--space-macro-space-600)  → resolves to space-600 Desktop value (48px)
  Laptop  → var(--space-meso-space-400)   → resolves to space-400 Laptop value (32px)
  Tablet  → var(--space-meso-space-250)   → resolves to space-250 Tablet value (20px)
  Mobile  → var(--space-meso-space-250)   → resolves to space-250 Mobile value (20px)
```

In reality, across all four modes, this single Aliases Extended token references three different alias tokens (macro-600, meso-400, meso-250), which in turn reference three different foundation tokens, each with their own four-mode values. The Alias layer provides the convenience of semantic grouping (macro vs. meso vs. micro) even within the Aliases Extended overrides.

The Mapping layer then provides the clean endpoint:
```
Mapping:  --card-template-2-padding-x: var(--space-card-template-2-padding-x)
```

**Path 3: Foundation - Alias - Alias Extended - Mapping with cross-collection references**

Same structure as Path 2, but the Aliases Extended token references values from a different collection. Spacing tokens commonly reference Dimension Vertical Rhythm values:

```
Dimension Foundation: --dimension-vertical-rhythm-015: 27px (Desktop) / 24px (Tablet/Mobile)

Space Alias Extended modes:
  Desktop → var(--dimension-vertical-rhythm-015)  → 27px
  Tablet  → var(--dimension-vertical-rhythm-010)  → 16px
```

Here, both the foundation values themselves change (VR-015 is 27px on Desktop, 24px on Mobile) *and* the component switches from VR-015 to VR-010 at tablet. Two dimensions of responsive change, same as Path 2.

**Path 4: Foundation - Mapping (direct)** (common in colors due to incomplete alias layer)
```
Foundation:     --colors-brand-700: #766158
                    |
Mapping:        --button-filled-surface-normal-enabled: var(--colors-primary-700)
```

### Naming conventions

**Figma collection names** follow the pattern `"Category - Layer"`:
- `Space - 1. Foundations`
- `Space - 2. Aliases`
- `Space - 2.1 Aliases Extended`
- `Space - 3. Mappings`

**CSS custom property naming:**
- Foundation: `--category-value-path` (e.g., `--space-300`, `--colors-brand-500`)
- Alias: `--category-semantic-group-value` (e.g., `--space-meso-space-300`)
- Alias Extended: `--category-component-property` (e.g., `--space-card-template-1-padding-x`)
- Mapping: `--component-property-qualifier` (e.g., `--card-template-1-padding-x`)

Mapping tokens drop the category prefix. At the mapping layer, the developer does not need to know whether the value originates from spacing, dimensions, or colors.

**Color Mapping naming** for interactive elements follows a deeper structure:

| Dimension | Examples |
|-----------|----------|
| Component | button, card, accordion, tag, header... |
| Role | brand, accent, neutral, status/error... |
| Variant | filled, outlined, text, ghost... |
| Element | surface, border, text, icon |
| Context | normal, inverse |
| State | enabled, hovered, pressed, focused, disabled |

Not all dimensions are needed for every token. Section-level or simpler mappings use shorter names (e.g., `--cta-padding-y`, `--page-site-margin`).

### Collection inventory

| Collection | Foundations | Aliases | Aliases Extended | Mappings |
|------------|:-----------:|:-------:|:----------------:|:--------:|
| Colors     | Single mode | Incomplete (see Section 8) | - | Full |
| Typography | 4 modes | 1 mode (flattening) | - | Via Text Styles (composite tokens) |
| Spacing    | 4 modes | 1 mode (micro/meso/macro) | 4 modes | Full |
| Dimensions | 4 modes | 1 mode (flattening) | 4 modes | Full |
| Radius     | 4 modes (near-identical values) | Combined with Mappings | - | Combined with Aliases |

---

## 4. The Pipeline - From Spreadsheet to Browser

### The flow

```
  Google Spreadsheet
  |  Complex mathematical calculations
  |  (scaling curves, VR multiples, grid proportions)
  |  Only foundation values are stored here.
  |
  v
  Download each tab as .csv
  |
  v
  Figma Variables  <--- Custom Import Plugin
  |  Source of truth for DESIGN INTENT
  |  Collections x 4 responsive modes
  |  Referenced values (aliases, mappings) are built in Figma, not the spreadsheet.
  |
  v
  Variable to CSS Plugin  (v1.9, experimental branch)
  |  Exports all variables as CSS custom properties
  |  Fixed mode: discrete values per breakpoint in media queries
  |  Fluid mode: clamp() values for continuous scaling
  |  Breakpoints: auto-detected from Figma Variables (editable)
  |  Direction: mobile-first (min-width) or desktop-first (max-width)
  |  Grid proportions: automatically detected, always-on
  |
  v
  tokens.css
  |  Single file
  |  Contains all layers, all breakpoints
  |
  v
  Component Styles
  |  Reference tokens via var(--token-name)
  |  (existing hardcoded values need to be replaced with token references)
  |
  v
  Browser
     Renders final values at current viewport width
```

### The spreadsheet

Foundation values originate in a Google Spreadsheet where complex calculations are performed - scaling curves, vertical rhythm multiples, grid proportional calculations. Each tab (Color, Typography, Space, Dimension, Radius) is downloaded as CSV and imported to Figma via a custom plugin.

The spreadsheet is the **calculation engine**. Once values are imported into Figma, the Figma Variables become the source of truth. Only foundation-layer values are stored in the spreadsheet - all referenced values (aliases, aliases extended, mappings) are built directly in Figma.

The spreadsheet exists because:
- Figma Variables do not support formulas or calculated relationships.
- Values like grid proportions (whole, three-quarters, two-thirds, half, third, quarter) involve compound calculations across column count, column size, and gutter size.
- Scaling curves and VR (vertical rhythm) multiples are easier to validate in a spreadsheet environment.

### The export

The CSS export uses the [Variable to CSS plugin](https://github.com/amarkkk/figma-variable-to-css/tree/experimental) (v1.9, experimental branch). It reads all Figma Variable collections and generates a single CSS file.

Two export modes are available:

| Mode | Output | Current Use |
|------|--------|-------------|
| **Fixed** (current) | Discrete values per breakpoint in `@media` blocks | Active - used for this project |
| **Fluid** | `clamp()` values with piecewise scaling between segments | Available but not deployed |

**Why fixed mode for this project:**

1. **Non-linear scaling needs.** The slope between Desktop and Laptop may be different from the slope between Tablet and Mobile. A single `clamp()` across all viewports assumes linear interpolation, which does not match the design intent. Piecewise clamp (different interpolation per segment pair) would require significantly more calculation and testing overhead.

2. **Safety.** The original problem was that the UI felt too large. Staying at smaller values on larger viewports is safer than introducing continuous scaling that might overshoot. Fixed values are predictable and verifiable.

3. **Testing reality.** We do not extensively test in browsers during the design phase. The client will test during implementation. Fixed mode is familiar and produces values that match exactly what is visible in Figma at each breakpoint mode. No surprises.

4. **Incremental adoption.** The layered token system is already a significant change. Adding fluid scaling on top of that would compound the learning curve. The fluid mode is available and tested for when the team is ready.

### Breakpoint system

The plugin supports two breakpoint directions, configured via a toggle in the Options panel:

| Direction | Default `:root` | Media Queries | Use Case |
|-----------|-----------------|---------------|----------|
| **Mobile-first** (default) | Smallest breakpoint (Mobile) | Ascending `@media (min-width: ...)` | Modern progressive enhancement |
| **Desktop-first** | Largest breakpoint (Desktop) | Descending `@media (max-width: ...)` | Legacy compatibility |

**Dynamic breakpoints from Figma Variables:** The plugin auto-detects breakpoint values at startup by scanning the Dimension Foundations collection for a variable with "viewport" in its name (preferring "viewport--min" over plain "viewport"). The per-mode values of that variable become the breakpoint widths. The detected source variable name is shown in the plugin UI.

If no viewport variable is found, the plugin falls back to editable defaults (Desktop: 1680, Laptop: 1366, Tablet: 840, Mobile: 480). Regardless of the source, breakpoint values are always editable in the UI before generating CSS.

**Mobile-first breakpoint reference (default):**

| Mode | Viewport Width | Media Query |
|------|---------------|-------------|
| Mobile | 360px | (default, no query - `:root`) |
| Tablet | 840px | `@media (min-width: 840px)` |
| Laptop | 1366px | `@media (min-width: 1366px)` |
| Desktop | 1680px | `@media (min-width: 1680px)` |

**Desktop-first breakpoint reference:**

| Mode | Viewport Width | Media Query |
|------|---------------|-------------|
| Desktop | 1680px | (default, no query - `:root`) |
| Laptop | 1366px | `@media (max-width: 1679px)` |
| Tablet | 840px | `@media (max-width: 1365px)` |
| Mobile | 360px | `@media (max-width: 839px)` |

### Fixed mode output structure

The default export uses mobile-first direction with `min-width` media queries:

```css
/* Foundation values - Mobile (default) */
:root {
  --dimension-vertical-rhythm-020: 32px;
  --dimension-grid-margin: 24px;
}

/* Tablet */
@media (min-width: 840px) {
  :root {
    --dimension-vertical-rhythm-020: 32px;
    --dimension-grid-margin: 60px;
  }
}

/* Laptop */
@media (min-width: 1366px) {
  :root {
    --dimension-vertical-rhythm-020: 36px;
    --dimension-grid-margin: 84.38px;
  }
}

/* Desktop */
@media (min-width: 1680px) {
  :root {
    --dimension-vertical-rhythm-020: 36px;
    --dimension-grid-margin: 121.5px;
  }
}
```

### One-way flow

Values always flow downward: Spreadsheet - Figma - Plugin - tokens.css - Components - Browser.

If a developer discovers a value needs changing, the change happens in Figma first (or in the spreadsheet if it involves a calculated foundation value), then propagates down through a re-export. The tokens.css file should not be manually edited - it will be overwritten on the next export.

---

## 5. Token Categories

Each category has unique characteristics in its layer depth, mode usage, and how values reach the final CSS output.

### 5.1 Colors

**Layer structure:** Foundation - Alias (incomplete) - Mapping
**Responsive modes:** None (single mode; colors are viewport-independent)

**Foundations** contain the raw color scales organized by role:

| Group | Contents |
|-------|----------|
| `brand/*` | Primary brand palette (50-950 scale) |
| `neutral/*` | Grayscale (0-950) |
| `accent/*` | Secondary accent colors (50-950) |
| `utility/*` | Semantic colors (red, green, blue, yellow, link, turquoise, purple, dark-blue) |
| `fancy/primary/*` | Client's decorative brand palette - primary set (red, gold, black) |
| `fancy/secondary/*` | Client's decorative brand palette - secondary set (16 colors) |

"Fancy" is a working name for the client's decorative palette. These are the complete sets from the brand guidelines, though not all values are used in the current UI.

**Aliases** are partially built. The layer currently contains:

- `fancy/solid/*` - a curated subset (4 of the 16 secondary colors) actually used in components
- `fancy/transparent/*` - opacity-modified variants of those 4 colors (detached from foundations because Figma does not support opacity modification while maintaining a variable reference)
- Various groupings (`action/*`, `primary/*`, `neutral/*`, `gold/*`, etc.) that are largely duplications of the foundation layer, not yet serving as proper semantic mappings

The **intended** Alias structure (documented in the token architecture Miro board) would follow:

```
[role] / [element] / [strength] / [context] / [state]

Where:
  Role     = brand / accent / neutral / status-error / status-success / status-warning
  Element  = surface / text / border / icon
  Strength = strong / subtle (sometimes medium)
  Context  = normal / inverse
  State    = enabled / hovered / pressed / focused / disabled

Example: brand/surface/strong/normal/enabled
```

This structure is the target for a future iteration. Aliases would be role-pure: `brand/*` references only brand foundations, `neutral/*` only neutral foundations, and so on.

**Mappings** are the most complete layer for colors. They are fully component-scoped with state variants:

```
[component] / [role] / [variant] / [element] / [context] / [state]

Example: button/brand/filled/surface/normal/enabled
```

The Mapping layer is where cross-role mixing happens. For example, a brand button might combine `brand/surface` (background) with `neutral/text` (label color).

In the current CSS output, the naming is flattened with dashes:
```css
--button-filled-surface-normal-enabled: var(--colors-primary-700);
--button-filled-text-and-icon-normal-enabled: var(--colors-primary-50);
--accordion-header-surface-normal-hovered: var(--colors-primary-100);
```

States follow a consistent pattern: `enabled`, `hovered`, `focused`, `pressed`, `disabled`.

### 5.2 Typography

**Layer structure:** Foundation - Alias - (Mappings via Text Styles)
**Responsive modes:** 4 breakpoints (Desktop, Laptop, Tablet, Mobile)

**Foundations** contain individual typographic properties across four responsive modes:

- `type/family/*` - font families (Primary, Secondary, Code)
- `type/weight/*` - font weights (Light 300 through Heavy 900, plus Italic)
- `type/size/*` - font sizes organized by scale name (display, title, body, label, code)
- `type/line-height/*` - corresponding line heights

Foundation values across breakpoints:

| Foundation token | Desktop | Laptop | Tablet | Mobile |
|-----------------|---------|--------|--------|--------|
| `type/size/display-01` | 50px | 44px | 36px | 34px |
| `type/size/title-01` | 38px | 34px | 30px | 30px |
| `type/size/title-02` | 36px | 32px | 30px | 28px |
| `type/size/title-03` | 28px | 28px | 24px | 24px |
| `type/size/title-04` | 26px | 24px | 22px | 22px |
| `type/size/title-05` | 24px | 22px | 20px | 20px |
| `type/size/title-06` | 22px | 20px | 18px | 18px |
| `type/size/body-01` | 18px | 18px | 16px | 16px |
| `type/size/body-02` | 16px | 16px | 14px | 14px |
| `type/size/label-01` | 18px | 18px | 16px | 16px |
| `type/size/label-02` | 16px | 16px | 14px | 14px |
| `type/size/code-01` | 16px | 16px | 16px | 16px |

These names are inherited from the existing UI kit and company conventions. Having familiar names (e.g., `body-02` for "small text") helps the team identify styles without needing a lookup table.

**Aliases** flatten foundations into role-specific names:

```
--typo-size-hero       -> var(--typo-type-size-display-01)
--typo-size-h1         -> var(--typo-type-size-title-01)
--typo-size-h2         -> var(--typo-type-size-title-02)
--typo-size-body       -> var(--typo-type-size-body-01)
--typo-size-button-text -> var(--typo-type-size-label-01)
```

Multiple alias tokens can reference the same foundation. For example, `--typo-size-body`, `--typo-size-lead`, `--typo-size-link`, and `--typo-size-footer-text` all reference `body-01`. This provides semantic clarity and future flexibility if these roles diverge.

**Composite tokens / Text Styles:** In Figma, Text Styles combine family + weight + size + line-height into named styles. These serve as the Mapping layer for typography - there is no separate Mapping collection. The plugin can export Text Styles as CSS classes, SCSS mixins, or CSS custom properties. Whether the frontend team creates SCSS mixins from these is a developer-side decision.

**Not yet in the system:** Letter spacing, list spacing, and paragraph spacing are not currently managed as variables. These may need to be added to the Figma styles separately.

### 5.3 Spacing

**Layer structure:** Foundation - Alias - Alias Extended - Mapping
**Responsive modes:** 4 breakpoints at Foundation level; 4 breakpoints at Alias Extended level
**Cross-collection references:** Alias Extended references Dimension tokens (Vertical Rhythm)

**Foundations** define the raw spacing scale:

| Token | Desktop | Laptop | Tablet | Mobile | Behavior |
|-------|---------|--------|--------|--------|----------|
| `space-025` | 2px | 2px | 2px | 2px | Fixed |
| `space-050` | 4px | 4px | 4px | 4px | Fixed |
| `space-100` | 8px | 8px | 8px | 8px | Fixed |
| `space-200` | 16px | 16px | 16px | 16px | Fixed |
| `space-300` | 24px | 24px | 24px | 24px | Fixed |
| `space-500` | 40px | 32px | 28px | 20px | Scaling |
| `space-600` | 48px | 42px | 38px | 36px | Scaling |
| `space-800` | 64px | 64px | 48px | 48px | Scaling |
| `gutter` | - | - | - | - | References Dimension grid gutter |
| `half-gutter` | 20.25px | 20.25px | 15px | 12px | Scaling |
| `site-margin` | - | - | - | - | References Dimension grid margin |

Values up to `space-400` are fixed across all breakpoints. Larger values scale down at smaller viewports.

**Aliases** group foundations into three semantic tiers:

- `micro-space-*` (0-16px): icon gaps, inner padding, between closely related elements
- `meso-space-*` (20-40px): component padding, content gaps
- `macro-space-*` (48px+): section margins, structural gaps, gutter and site margin

The grouping into micro/meso/macro also helps prevent accidental mis-references: a foundation token `space-300` and its alias `meso-space-300` carry different names, making it clear which layer you are referencing.

**Aliases Extended** is where component-scoped spatial tokens live with their own responsive overrides. This layer exists because some components need *different* foundation/alias values at different breakpoints, not just the scaled version of a single value.

For example, card template 2 horizontal padding:

| Breakpoint | Alias Extended value | Resolves to |
|------------|---------------------|-------------|
| Desktop | `var(--space-macro-space-600)` | 48px |
| Laptop | `var(--space-meso-space-400)` | 32px |
| Tablet | `var(--space-meso-space-250)` | 20px |
| Mobile | `var(--space-meso-space-250)` | 20px |

Without Aliases Extended, achieving this behavior would require introducing a new foundation value that scales exactly this way - which would add overhead to the foundation layer for a single component's needs.

Many Alias Extended spacing tokens reference Vertical Rhythm values from the Dimension collection (e.g., `var(--dimension-vertical-rhythm-015)`). This is a cross-collection dependency - VR values are defined once in Dimensions and consumed by both Dimension and Space tokens.

**Mappings** are the developer-facing endpoints:

```css
--card-template-1-padding-x: var(--space-card-template-1-padding-x);
--accordion-header-padding-y: var(--space-micro-space-100);
--footer-padding-y: var(--space-footer-padding-y);
--page-site-margin: var(--space-macro-site-margin);
```

Some mapping tokens reference alias values directly (when no extended override is needed), while others route through Aliases Extended.

### 5.4 Dimensions

**Layer structure:** Foundation - Alias - Alias Extended - Mapping
**Responsive modes:** 4 breakpoints at Foundation level; 4 breakpoints at Alias Extended level

Dimensions is the most structurally complex category, containing grid system values, proportions, vertical rhythm, and fixed component sizes.

**Foundations** contain several groups:

**Grid system:**

| Token | Desktop | Laptop | Tablet | Mobile |
|-------|---------|--------|--------|--------|
| `grid/margin` | 121.5px | 84.38px | 60px | 24px |
| `grid/column/count` | 12 | 12 | 12 | 12 |
| `grid/column/size` | 81px | 60.75px | 24px | 5px |
| `grid/column/gutter` | 40.5px | 33.75px | 30px | 24px |

**Grid proportions** - fractional layout values based on the 12-column grid:

| Proportion | Column span | Desktop (whole) | Mobile (whole) |
|------------|-------------|-----------------|----------------|
| `whole` | 12/12 | 1417.5px | 324px |
| `three-quarters` | 9/12 | 1053px | 237px |
| `two-thirds` | 8/12 | 931.5px | 208px |
| `half` | 6/12 | 688.5px | 150px |
| `third` | 4/12 | 445.5px | 92px |
| `quarter` | 3/12 | 324px | 63px |

Each proportion has `--min` and `--max` suffixes. These exist for mockup purposes: min represents the smallest value within a breakpoint range, max represents the largest. This allows creating mockups at viewport edge cases (e.g., tablet minimum width vs. tablet maximum width) to verify content behavior. At Desktop, min equals max because the content is capped at a container width.

In the CSS export, these proportions are **automatically detected** (any variable with "proportion" in its name) and output as **column span numbers** and **fr units**, not pixel values:

```css
/* Proportion: 12/12 columns (flex/grid-ready) */
--dimension-grid-proportions-whole--min: 12;
--dimension-grid-proportions-whole--min--fr: 12fr;

/* Proportion: 6/12 columns (flex/grid-ready) */
--dimension-grid-proportions-half--min: 6;
--dimension-grid-proportions-half--min--fr: 6fr;

/* Proportion: 3/12 columns (flex/grid-ready) */
--dimension-grid-proportions-quarter--min: 3;
--dimension-grid-proportions-quarter--min--fr: 3fr;
```

This automatic detection means proportion variables never output as pixel-based `clamp()` values or per-breakpoint media queries. The column count is semantic - "half" is always 6/12 regardless of viewport width. The plugin recognizes the following proportion names:

| Proportion name | Column count |
|----------------|-------------|
| `whole` | 12 |
| `three-quarters` | 9 |
| `two-thirds` | 8 |
| `half` | 6 |
| `third` | 4 |
| `quarter` | 3 |

These values directly translate to CSS `grid-column: span` or flexbox proportions. The design uses a 12-column grid across all viewports, and these proportions express "this element should occupy N out of 12 columns."

**Vertical Rhythm multiples:**

Vertical Rhythm values are derived from the body text. The body font size is 18px (Desktop) with a line-height ratio of 1.5, making the base line-height 27px. The VR scale is built from the body font size (18px) as the base unit:

- `rhythm-005` = 0.5x body font size (9px Desktop)
- `rhythm-010` = 1x body font size (18px Desktop)
- `rhythm-015` = 1.5x body font size (27px Desktop) - exactly equal to the body line-height
- `rhythm-020` = 2x body font size (36px Desktop)
- and so on...

| Token | Desktop | Tablet/Mobile |
|-------|---------|---------------|
| `vertical-rhythm-005` | 9px | 8px |
| `vertical-rhythm-010` | 18px | 16px |
| `vertical-rhythm-020` | 36px | 32px |
| `vertical-rhythm-040` | 72px | 64px |
| `vertical-rhythm-100` | 180px | 160px |
| `vertical-rhythm-200` | 360px | 320px |

VR values scale proportionally across breakpoints, maintaining consistent vertical proportions. These are consumed by both Dimension tokens (for heights) and Space tokens (for vertical padding/gaps).

**Named foundation values:** The foundation layer also contains values like `button-filled-height`, `divider-thickness-thick`, `tag-height` (which references `vertical-rhythm-020`), and `form-field-4-borders`. These are named references within the foundation layer rather than strict raw primitives. This is a pragmatic concession - having semantically named tokens at the foundation level simplifies component work even if it is not architecturally pure.

**Aliases** flatten foundation values (e.g., `content-width--min`, `header-height`, `page-page--min`).

**Aliases Extended** encodes layout intent that changes proportionally across breakpoints. With mobile-first output, these are expressed as ascending `min-width` queries:

```css
/* Mobile (default): CTA content takes full width */
:root {
  --dimension-cta-content-horizontal-width:
    var(--dimension-grid-proportions-whole--min);
}

/* Tablet: CTA content narrows to two-thirds */
@media (min-width: 840px) {
  :root {
    --dimension-cta-content-horizontal-width:
      var(--dimension-grid-proportions-two-thirds--min);
  }
}

/* Desktop: CTA content narrows to one-third */
@media (min-width: 1680px) {
  :root {
    --dimension-cta-content-horizontal-width:
      var(--dimension-grid-proportions-third--min);
  }
}
```

This is about the *content area within* CTAs and similar sections. The sections themselves run full container width; the Aliases Extended layer controls how much of that width the content occupies at each breakpoint.

**Mappings** are the developer endpoints:

```css
--cta-content-horizontal-width: var(--dimension-cta-content-horizontal-width);
--header-height: var(--dimension-header-height);
--button-filled-height: var(--dimension-button-filled-height);
--site-content-width--min: var(--dimension-content-width--min);
```

### 5.5 Radius

**Layer structure:** Foundation - Aliases & Mappings (combined)
**Responsive modes:** 4 breakpoints at Foundation level, but values are nearly identical
**Simplest category** - two layers, minimal variation

**Foundations** define five radius values:

| Token | Desktop | Laptop/Tablet/Mobile |
|-------|---------|---------------------|
| `radius-4px` | 4px | 4px |
| `radius-8px` | 8px | 8px |
| `radius-16px` | 16px | 15px |
| `radius-20px` | 20px | 19px |
| `radius-round` | 200px | 200px |

**Aliases & Mappings** (combined in a single collection) map directly to components:

```css
--radius-accordion-faq: var(--radius-16px);
--radius-button-default: var(--radius-round);
--radius-card-default: var(--radius-16px);
--radius-chip-default: var(--radius-round);
--radius-form-outlined: var(--radius-16px);
--radius-tooltip-large: var(--radius-16px);
--radius-tooltip-small: var(--radius-8px);
```

The combined layer is practical here because radius values are simple, few, and do not need intermediate semantic grouping. Should responsivity influence radii in the future, a proper three-layer structure might be beneficial - the foundation modes are already in place.

---

## 6. The Aliases Extended Layer - When Four Modes Aren't Enough

### Why it exists

Foundation tokens have four responsive modes (Desktop, Laptop, Tablet, Mobile). When a component references a Foundation or Alias token, it inherits those four values automatically. For most cases, this is sufficient.

But sometimes the built-in responsive scaling of foundation values is not enough for a specific component. The component needs to reference *different* values at different breakpoints, not just rely on how a single value scales.

**Use cases:**

1. **Different proportions per breakpoint.** A content area that should occupy half the grid on Desktop but two-thirds on Tablet. The Aliases Extended layer for Dimensions handles this by referencing different grid proportion tokens per breakpoint.

2. **Custom spacing curves.** A card's horizontal padding should be space-600 on Desktop but space-250 on Mobile. No single foundation token scales this way, and adding a new foundation value for this one component would bloat the scale. The Aliases Extended layer for Spacing reuses existing values with per-breakpoint overrides.

3. **Overriding default scaling.** You apply a token to a component, test it across breakpoints, and realize the default scaling produces values that are not right for this specific component. Rather than changing the foundation value (which affects everything using it), you introduce an Aliases Extended token that gives this component its own responsive behavior.

### The practical workflow

> Note: This workflow applies to Space and Dimension collections, which already have four responsive modes in their Aliases Extended collections. If Aliases Extended is introduced for other categories (e.g., Colors) in the future, the mode setup would be different (e.g., light/dark rather than viewport-based).

When working on a component in the Mapping layer and testing across breakpoints, sometimes the default responsivity is not enough. The workflow for introducing Aliases Extended:

1. The component uses an Alias value in its Mapping.
2. Testing reveals the value needs different behavior per breakpoint.
3. Copy the variable name from the Mapping layer into the Aliases Extended collection (which already has four modes).
4. Reference the new Aliases Extended variable from the Mapping layer instead of the direct Alias.
5. In each mode of the Aliases Extended collection, reference the appropriate Alias or Foundation value.
6. Iterate - changes in the Aliases Extended modes are visible on the component in real time.

Using the same name in both layers (just with different prefixes) makes searching and referencing across layers much faster.

### The downside in Figma

When designing for a specific viewport, you need to switch modes in each collection that has responsive modes. The Aliases Extended layer adds one more mode switch. So when designing a mobile screen, you switch Foundation modes *and* Aliases Extended modes to Mobile. This is manageable but worth being aware of.

### Future possibilities

While Aliases Extended is currently used only in Space and Dimension, the concept could apply to Colors in the future. For example, if the project introduces light and dark modes, a card surface might need a brand-colored background in light mode but a different, darker surface in dark mode. That kind of component-level mode override - where the same element needs a fundamentally different color depending on mode, not just a shifted value - could be handled through a Color Aliases Extended layer. This is not needed in the current project.

---

## 7. Design Intent vs. CSS Output

### Fixed mode - what the developer receives

The current default export is fixed mode with mobile-first direction - discrete values at four breakpoints using ascending `min-width` queries:

```css
:root { --token: 32px; }                                    /* Mobile (default) */
@media (min-width: 840px)  { :root { --token: 32px; } }     /* Tablet */
@media (min-width: 1366px) { :root { --token: 36px; } }     /* Laptop */
@media (min-width: 1680px) { :root { --token: 36px; } }     /* Desktop */
```

The breakpoint values are auto-detected from the Figma Variables (the viewport variable in the Dimension Foundations collection) and are editable in the plugin UI before each export. The direction (mobile-first or desktop-first) is configurable via a toggle. See Section 4 for the full breakpoint reference.

### Grid proportions - layout intent, not pixel values

Grid proportion tokens express layout intent using the 12-column grid. The plugin automatically detects any variable with "proportion" in its name and outputs **column span numbers** and **fr units** instead of pixel values:

```css
/* Proportion: 6/12 columns (flex/grid-ready) */
--dimension-grid-proportions-half--min: 6;
--dimension-grid-proportions-half--min--fr: 6fr;

/* Proportion: 4/12 columns (flex/grid-ready) */
--dimension-grid-proportions-third--min: 4;
--dimension-grid-proportions-third--min--fr: 4fr;
```

This automatic handling means proportions are never output as pixel-based `clamp()` calculations or per-breakpoint values in media queries. The column count is semantic and viewport-independent - "half" is always 6/12.

When a developer sees a component using `var(--dimension-grid-proportions-half--min)`, the design intent is: "this element should occupy 6 out of 12 columns of the page container" (the full viewport minus site margins, minus gaps between elements). This translates to `grid-column: span 6` or equivalent flexbox proportions.

Combined with the Dimension Aliases Extended layer, proportions can shift per breakpoint. A sidebar that is quarter-width on Desktop might become full-width on Mobile - the token handles the intent, and the developer applies it via grid or flexbox.

### Preserved `var()` references

The export preserves reference chains where possible. Alias and Mapping tokens are exported as `var()` references, not resolved to final values:

```css
--space-meso-space-300: var(--space-300);
--card-template-1-padding-x: var(--space-card-template-1-padding-x);
```

This means the browser resolves the full chain at render time, and changing a foundation value in tokens.css cascades through all layers. DevTools shows the full reference chain, which aids debugging.

### Hardcoded values in the export

Some mapping tokens resolve to hardcoded pixel values rather than `var()` references. This happens when the Figma variable was set to a literal value rather than a reference. A notable example is the transparent color aliases - these have hardcoded RGBA values because Figma does not support opacity modification while maintaining variable references.

Some of these hardcoded values may be legacy tokens that are no longer actively used in the component system. This is a known cleanup item.

---

## 8. Exceptions and Known Shortcuts

### Colors: Alias layer incomplete

The color Alias layer is the main area of design debt. The primary focus during Phase 2 was on creating durable Mapping endpoints that minimize manual development work while keeping the original Phase 1 color palette largely intact. The alias layer was not rebuilt because the priority was:

1. Creating component-scoped Mapping endpoints that will last.
2. Keeping existing colors from Phase 1 to avoid unnecessary redesign.
3. Addressing specific cases where the size reduction required updated borders and colors for legibility.

The planned fix for a future iteration is to build a proper semantic alias layer following the `[role]/[element]/[strength]/[context]/[state]` structure documented in the token architecture Miro board. This would enable theming and make token names self-documenting. This is not blocking current implementation.

**Impact on developers:** None. The exported CSS works correctly. The Mapping layer is complete.

### Colors: Transparent values detached

The `fancy/transparent/*` color tokens are detached from foundation references because Figma Variables do not support opacity modification while maintaining a reference chain. These are hardcoded RGBA values in the Alias layer.

**Impact on developers:** None. If the brand palette changes, these transparent variants need manual updating in Figma.

### Spacing: Cross-collection Vertical Rhythm references

Space Alias Extended tokens reference Dimension Foundation tokens (`--dimension-vertical-rhythm-*`). These values are mathematically identical in both contexts (spacing and height), so defining them once avoids duplication.

### Radius: Near-identical breakpoint values

Radius Foundation tokens have four breakpoint modes with nearly identical values (e.g., `radius-16px` is 16px on Desktop and 15px on Laptop/Tablet/Mobile). The benefit is future-readiness: if different border radii are needed at different viewports, the structure is already in place. The modes also maintain consistency with other Foundation collections, and duplicating values is trivial via the spreadsheet import.

### Typography: No dedicated Mapping collection

Typography uses Foundation - Alias, with composite tokens handled through Figma Text Styles rather than a separate Mapping collection. The Alias layer is the effective endpoint for individual properties, while Text Styles provide the composite "mapping" that bundles multiple properties.

### Mapping names mirroring Aliases Extended

Some Mapping tokens are near-identical to their Aliases Extended source, with only the category prefix dropped:

```css
/* Aliases Extended */
--space-card-template-1-padding-x: var(--space-meso-space-300);

/* Mapping */
--card-template-1-padding-x: var(--space-card-template-1-padding-x);
```

This is a practical workflow artifact. When a component needed Aliases Extended behavior, the variable name was copied from the Mapping layer into the Aliases Extended collection (which already had four modes), then the Mapping was re-pointed to the new Aliases Extended variable. Using the same name makes it fast to search and reference across layers during iteration.

### Dimension: Named values in Foundations

The Dimension Foundation layer contains some semantically named tokens (e.g., `tag-height`, `button-filled-height`, `form-field-4-borders`) alongside raw values. Strictly, foundations should be unnamed primitives, but having these named references at the foundation level simplifies component work. This is a pragmatic trade-off.

---

## 9. Plugin Tooling Reference

Six custom Figma plugins support the token system. All are open-source and MIT-licensed.

### Variable to CSS

**Repo:** [github.com/amarkkk/figma-variable-to-css](https://github.com/amarkkk/figma-variable-to-css/tree/experimental) (experimental branch)
**Current version:** v1.9

**Purpose:** Exports all Figma Variables as CSS custom properties. This is the only tool that generates the tokens.css deliverable.

**Key features:**
- Two export modes: Fixed (per-breakpoint media queries) and Fluid (piecewise clamp-based scaling)
- **Configurable breakpoint direction:** Mobile-first (`min-width`, default) or desktop-first (`max-width`), toggled in the Options panel
- **Dynamic breakpoints:** Auto-detected from Figma Variables at startup by scanning the Dimension Foundations collection for a viewport variable. Falls back to editable defaults if not found. Breakpoint values are always editable in the UI regardless of source.
- **Automatic grid proportion handling:** Variables with "proportion" in their name are automatically output as unitless column span numbers and `fr` unit variants. No opt-in required - detection is always-on in both Fluid and Fixed modes.
- Preserves `var()` reference chains
- Exports Text Styles as SCSS mixins, CSS classes, or CSS custom properties (optional)
- Handles unitless values (column count, font weights, opacity, z-index, etc.) via naming convention detection
- Piecewise clamp for non-linear scaling (auto-detected, opt-out pattern)
- Viewport-relative variable handling (`min(100vw, max)` for viewport-proportional tokens)
- Per-file settings persistence (settings saved to and loaded from the Figma file)
- 4-column resizable UI layout (Collections | Options | Edge Cases | CSS Preview)
- CSS preview with search, copy to clipboard, and download

**Export options:**

| Option | Values | Default |
|--------|--------|---------|
| Output mode | Fluid / Fixed | Fluid (Fixed used for this project) |
| Breakpoint direction | Mobile-first / Desktop-first | Mobile-first |
| Alias mode | Preserved / Resolved | Preserved |
| Color format | Hex / OKLCH | Hex |
| Dark mode output | prefers-color-scheme / class / both | Both |
| Include text styles | On / Off | Off |
| Text style format | SCSS Mixin / CSS Class / CSS Vars | SCSS Mixin |
| Legacy fallbacks | On / Off | Off |
| Timestamp in header | On / Off | On |

**When to use:** After any Figma Variable value change that needs to reach the codebase.

### Variable Network Explorer

**Repo:** [github.com/amarkkk/figma-variable-network](https://github.com/amarkkk/figma-variable-network)

**Purpose:** Visualizes the dependency graph between variables - which variables reference which, and which components consume them. Essential for impact analysis before changing a Foundation value.

**When to use:** Before modifying any token, to understand what it affects downstream.

### Variable Mover

**Repo:** [github.com/amarkkk/figma-variable-mover](https://github.com/amarkkk/figma-variable-mover)

**Purpose:** Moves variables between collections while preserving all upstream and downstream references. Built specifically for the Phase 2 restructuring when spacing, dimension, and radius values needed to be separated from a single monolithic collection.

**When to use:** When restructuring the collection taxonomy - moving tokens to their correct category without breaking existing component bindings.

### Variable Remapper

**Repo:** [github.com/amarkkk/figma-variable-remapper](https://github.com/amarkkk/figma-variable-remapper)

**Purpose:** Bulk find-and-replace across all bound variables in a selection. When creating component variants, you often need to swap entire token families. For example, duplicating a "Brand" button to create a "Neutral" variant requires remapping dozens of variables like `button/brand/filled/surface/enabled` to `button/neutral/filled/surface/enabled`. Doing this manually in Figma would mean rebinding each variable individually. This plugin lets you find-and-replace across all bound variables in your selection at once.

**When to use:** When creating component variants, renaming token families, or introducing new layers that should replace existing references.

### Variable Import/Export (CSV)

**Purpose:** Bulk import/export of variable values via CSV. Used to transfer calculated values from the Google Spreadsheet into Figma Variables.

**When to use:** When Foundation values are recalculated in the spreadsheet and need to be batch-updated in Figma. Download each spreadsheet tab as CSV, then import.

### Variable Description Manager

**Purpose:** Bulk-clear or bulk-update descriptions across multiple variables at once. When building design systems, you often create variable families by duplicating scoped variables. Descriptions get inherited when duplicating, which clutters Figma's search functionality with irrelevant matches. This plugin lets you clean up or update descriptions in bulk.

---

## 10. Testing and Validation

> The following are suggestions from the design perspective. The testing and frontend teams should evaluate these ideas and adapt them to fit their own processes. This is not prescriptive.

### How the token system might affect testing

Previously, manual testing required checking exact pixel values at each breakpoint, with testing hours adding up for each media query.

With the token system, design values are declared as CSS variables in a single file. If a component correctly references a token variable, the value is correct by definition - it comes from the Figma export. This may shift what needs manual verification.

### Suggested areas for validation

| Area | What to check |
|------|---------------|
| Layout breakpoints | Does the layout change at the correct viewport widths? (e.g., card switches from vertical to horizontal) |
| Interactive states | Do hover, focus, pressed, disabled states apply correct visual treatment? |
| Token presence | Spot-check: is the component using `var(--token-name)` instead of hardcoded values? |
| Container proportions | Do content areas occupy the intended proportion at each breakpoint? |

### Red flags worth investigating

- A component style uses a hardcoded pixel value where a token should exist.
- A `var(--token-name)` resolves to `initial` or shows as invalid in DevTools - the token may be missing from the CSS file.
- Values do not change when resizing past a breakpoint - the token might not have breakpoint-specific overrides, or the wrong token is applied.
- A layout does not reflow at the expected breakpoint - the component may be missing its layout media queries (these are authored by developers, separate from tokens.css).
