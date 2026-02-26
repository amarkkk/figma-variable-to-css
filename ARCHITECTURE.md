# Figma Variable to CSS - Architecture & Context

This document provides the technical background for the Variable to CSS Figma plugin, serving as a foundation for future iterations.

---

## Token Architecture (4-Layer System)

The design system follows a 4-layer token architecture. Understanding this hierarchy is critical for correct CSS generation.

```
Layer 1: FOUNDATIONS (multi-mode)
  └─ Raw values that change per breakpoint
  └─ Example: --space-fixed-5: 16px/15px/14px/12px
  └─ CSS Output: clamp() for fluid scaling

Layer 2: ALIASES (single-mode, flattening)
  └─ Semantic names, one definition
  └─ Example: --space-micro-5: var(--space-fixed-5)
  └─ CSS Output: Simple var() reference in :root

Layer 2.1: ALIASES EXTENDED (multi-mode)
  └─ Component decisions that vary per breakpoint
  └─ Example: --space-card-padding: var(--space-micro-5) on Desktop
                                    var(--space-micro-4) on Tablet
  └─ CSS Output: Media queries with different var() references

Layer 3: MAPPINGS (single-mode, stable API)
  └─ What components consume, never changes
  └─ Example: --card-padding: var(--space-card-padding)
  └─ CSS Output: Simple var() reference in :root
```

### Key Insight
**The Mappings layer is always single-mode** - it's a stable API for components. Mode variation happens in upstream layers (Foundations, Aliases Extended). Components using Mapping tokens automatically get responsive behavior through the CSS cascade.

---

## Breakpoint System

### Direction Modes

The system supports two breakpoint directions, toggled in the Options panel:

| Direction | Default `:root` | Media Queries | Use Case |
|-----------|-----------------|---------------|----------|
| **Mobile-first** (default) | Smallest breakpoint (Mobile) | Ascending `@media (min-width: ...)` | Modern progressive enhancement |
| **Desktop-first** | Largest breakpoint (Desktop) | Descending `@media (max-width: ...)` | Legacy compatibility |

**Mobile-first example:**

| Mode    | Viewport Width | Media Query                        |
|---------|---------------|------------------------------------|
| Mobile  | 360px         | (default, no query — `:root`)      |
| Tablet  | 840px         | `@media (min-width: 840px)`        |
| Laptop  | 1366px        | `@media (min-width: 1366px)`       |
| Desktop | 1680px        | `@media (min-width: 1680px)`       |

**Desktop-first example:**

| Mode    | Viewport Width | Media Query                         |
|---------|---------------|-------------------------------------|
| Desktop | 1680px        | (default, no query — `:root`)       |
| Laptop  | 1366px        | `@media (max-width: 1679px)`        |
| Tablet  | 840px         | `@media (max-width: 1365px)`        |
| Mobile  | 360px         | `@media (max-width: 839px)`         |

### Dynamic Breakpoints

Breakpoints are **auto-detected from Figma variables** at plugin startup. The plugin scans the Dimension Foundations collection for a variable with "viewport" in its name (preferring "viewport--min" over plain "viewport"). The per-mode values of that variable become the breakpoint widths.

```
Scan: Dimension Foundations → variable containing "viewport"
Result: Desktop=1680, Laptop=1366, Tablet=840, Mobile=360
Source shown in UI: "Detected from grid/proportions/viewport"
```

If no viewport variable is found, hardcoded defaults are used. Breakpoint values are always editable in the UI regardless of source.

### Dual-Purpose Values
The `BREAKPOINT_MODES` values in code.ts serve two purposes:
1. **Clamp calculations**: Linear interpolation uses actual viewport widths
2. **Media queries**: Desktop-first generates `(breakpointPx - 1)` for max-width; mobile-first uses `breakpointPx` directly for min-width

```typescript
var BREAKPOINT_MODES: Record<string, number> = {
  'desktop': 1680,  // Clamp max viewport (updated at runtime from Figma)
  'laptop': 1366,   // Clamp interpolation point
  'tablet': 840,    // Clamp interpolation point
  'mobile': 360     // Clamp min viewport
};
```

These values are **updated at runtime** from the UI-provided breakpoints (which may come from auto-detection or user edits) before each CSS generation.

---

## CSS Generation Methods

### 1. Fluid Mode: Clamp (Linear Interpolation)
Used for: **Numeric FLOAT values in Foundations without aliases**

The `clamp()` formula is direction-agnostic — only the default `:root` mode and media query direction change.

```css
--dimension-heights-1: clamp(25.6px, calc(23.04px + 0.5333vw), 32px);
```

**Formula:**
```
slope = (maxValue - minValue) / (maxVP - minVP)
intercept = minValue - slope * minVP
clamp(minPx, calc(intercept + slope*100vw), maxPx)
```

### 2. Fluid Mode: Piecewise Clamp (Non-Linear Scaling)
Used for: **Variables where intermediate breakpoint values deviate >5% from linear**

Instead of one clamp across the full range, outputs 3 clamp segments between adjacent breakpoints:

**Mobile-first:**
```css
:root { --typo-size-scaled-4: clamp(12px, calc(...), 16px); }

/* Piecewise clamp: Tablet → Laptop segment */
@media (min-width: 840px) {
  :root { --typo-size-scaled-4: clamp(16px, calc(...), 28px); }
}

/* Piecewise clamp: Laptop → Desktop segment */
@media (min-width: 1366px) {
  :root { --typo-size-scaled-4: clamp(28px, calc(...), 32px); }
}
```

### 3. Fluid Mode: Viewport-Relative
Used for: **Variables with "viewport" in their name**

```css
--dimension-grid-proportions-viewport: min(100vw, 1680px);
```

### 4. Fixed Mode (Per-Breakpoint)
Used for: **All variables when "Fixed — per breakpoint" is selected**

Outputs raw Figma values with media queries — no `clamp()` interpolation.

**Mobile-first:**
```css
:root { --spacing-gap: 12px; }
@media (min-width: 840px) { :root { --spacing-gap: 14px; } }
@media (min-width: 1366px) { :root { --spacing-gap: 15px; } }
@media (min-width: 1680px) { :root { --spacing-gap: 16px; } }
```

### 5. Media Queries (Stepped Alias Values)
Used for: **Aliases with changing references, non-FLOAT types**

```css
:root {
  --dimension-hero-intro--width: var(--dimension-grid-proportions-whole);
}

@media (min-width: 1366px) {
  :root {
    --dimension-hero-intro--width: var(--dimension-grid-proportions-two-thirds);
  }
}

@media (min-width: 1680px) {
  :root {
    --dimension-hero-intro--width: var(--dimension-grid-proportions-half);
  }
}
```

### 6. Grid Proportions (Always-On)
Used for: **Variables with "proportion" in their name (excluding "viewport")**

Proportion variables always output as unitless column counts + `--fr` variants, regardless of Fluid/Fixed mode. No opt-in required.

```css
/* Proportion: 6/12 columns (flex/grid-ready) */
--dimension-grid-proportions-half: 6;
--dimension-grid-proportions-half--fr: 6fr;
```

Supported proportion names (12-column grid):

| Name | Columns |
|------|---------|
| whole | 12 |
| three-quarters | 9 |
| two-thirds | 8 |
| half | 6 |
| third | 4 |
| quarter | 3 |

### 7. Theme Selectors
Used for: **Light/Dark mode collections**

```css
:root {
  --color-interactive-primary: var(--color-brand-700);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-interactive-primary: var(--color-brand-200);
  }
}

[data-theme="dark"] {
  --color-interactive-primary: var(--color-brand-200);
}
```

### 8. Composite Text Styles
Used for: **Figma Text Styles (optional)**

Three output formats:

```scss
/* SCSS Mixin */
@mixin heading-h1 {
  font-family: var(--typo-type-family-primary);
  font-size: var(--typo-type-size-fixed-3);
  font-weight: 700;
  line-height: var(--typo-type-line-height-tight-fixed-1);
}

/* CSS Class */
.heading-h1 { font-family: var(--typo-type-family-primary); ... }

/* CSS Custom Properties */
:root { --heading-h1-family: var(--typo-type-family-primary); ... }
```

---

## Variable Classification Logic

### Mode Detection
```typescript
function detectModeType(modes): 'breakpoint' | 'theme' | 'single' {
  if (modes.length === 1) return 'single';
  if (allModesHaveBreakpoints) return 'breakpoint';
  if (anyModeIsLightOrDark) return 'theme';
  return 'single';
}
```

### Output Method Selection
```typescript
function needsMediaQueries(variable, modes, options): boolean {
  if (!hasModeVariance(variable, modes, options)) return false;
  if (variable.resolvedType !== 'FLOAT') return true;
  if (anyModeHasAlias) return true;
  return false; // Can use clamp
}
```

---

## CSS Output Structure

### For Breakpoint Collections — Mobile-First (default)

```css
/* 1. :root block with mobile (smallest) values */
:root {
  /* Clampable variables get clamp() spanning mobile→tablet */
  --dimension-heights-1: clamp(25.6px, calc(...), 28px);

  /* Media query variables get mobile value */
  --dimension-hero-width: var(--dimension-grid-proportions-whole);

  /* Proportions always output as grid/flex values */
  --dimension-grid-proportions-half: 6;
  --dimension-grid-proportions-half--fr: 6fr;
}

/* 2. Ascending min-width media queries */
@media (min-width: 840px) {
  :root {
    --dimension-hero-width: var(--dimension-grid-proportions-two-thirds);
  }
}

@media (min-width: 1680px) {
  :root {
    --dimension-hero-width: var(--dimension-grid-proportions-half);
  }
}

/* 3. Piecewise clamp segments for non-linear variables */
@media (min-width: 840px) {
  :root {
    --typo-size-scaled-4: clamp(16px, calc(...), 28px);
  }
}

@media (min-width: 1366px) {
  :root {
    --typo-size-scaled-4: clamp(28px, calc(...), 32px);
  }
}

/* 4. Fallback for older browsers (optional) */
@supports not (width: clamp(1px, 1vw, 2px)) {
  @media (min-width: 840px) {
    :root {
      --dimension-heights-1: 28px;
    }
  }
}
```

### For Theme Collections

```css
:root {
  /* Light mode (default) */
  --color-primary: var(--color-brand-700);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: var(--color-brand-200);
  }
}

[data-theme="dark"] {
  --color-primary: var(--color-brand-200);
}
```

### For Single-Mode Collections (Aliases, Mappings)

```css
:root {
  --space-micro-5: var(--space-fixed-5);
  --card-padding: var(--space-card-padding);
}
```

---

## UI Architecture

### 4-Column Resizable Grid

The plugin UI uses a CSS Grid layout with 7 column tracks (4 panels + 3 resize handles):

```
┌──────────┬─┬──────────┬─┬──────────┬─┬──────────────────┐
│Collections│ │ Options  │ │Edge Cases│ │   CSS Preview     │
│          │ │          │ │(optional)│ │                   │
│ col 1    │h│ col 3    │h│ col 5    │h│   col 7           │
│          │1│          │2│          │3│                   │
└──────────┴─┴──────────┴─┴──────────┴─┴──────────────────┘
```

- Column widths stored in CSS custom properties (`--col-input`, `--col-options`, `--col-edge`, `--col-output`)
- Resize handles (6px) use `pointerdown`/`pointermove`/`pointerup` events with `setPointerCapture`
- Edge case column toggles between `0px` (hidden) and `220px` (visible) via `.has-edge-cases` class
- Hidden panels use `visibility: hidden` (not `display: none`) to preserve grid track alignment

### Edge Case Detection Panel

Visible only in Fluid output mode when candidates are detected. Contains two collapsible accordion sections:

1. **Viewport-Relative** — Variables with "viewport" in their name, outputs `min(100vw, max)` instead of `clamp()`
2. **Non-Linear Scaling** — Variables where intermediate breakpoint values deviate >5% from linear, outputs piecewise `clamp()` segments

Each candidate has a checkbox (opt-out pattern — checked by default). The non-linear candidates include a mini deviation bar chart; hovering shows an SVG slope chart overlay visualizing the piecewise scaling.

### Settings Persistence

Settings are stored per-file via `figma.root.setPluginData('pluginSettings', JSON.stringify(...))`. This means settings travel with the `.fig` file. The Save/Reset buttons are at the bottom of the Options panel.

---

## Naming Conventions

### CSS Variable Names
```typescript
function generateCSSName(varName, domain, layerType): string {
  // Transform: path/to/variable → path-to-variable
  // Preserve intentional double hyphens: stroke--width → stroke--width

  // Domain prefix rules:
  // - Foundations: Add prefix (--typo-type-family-primary)
  // - Aliases: Add prefix (--space-micro-5)
  // - Aliases Extended: Add prefix (--dimension-hero-width)
  // - Mappings: NO prefix (--button-background)
}
```

### Collection Name Parsing
Pattern: `"Domain - Layer. Type"` or `"Domain - Layer Type"`

Examples:
- `"Typo - 1. Foundations"` → domain: "typo", layerType: "foundations"
- `"Space - 2.1 Aliases Extended"` → domain: "space", layerType: "aliases-extended"
- `"Dimension - 3. Mappings"` → domain: "dimension", layerType: "mappings"

---

## Deduplication & Circular Reference Prevention

### Circular Reference Detection
Prevents: `--var-name: var(--var-name);`

```typescript
if (value.isAlias && value.aliasName === variable.cssName) {
  // Skip - would create circular reference
  return true;
}
```

### Cross-Collection Deduplication
Tracks outputted CSS names to prevent duplicates when same variable name exists in multiple collections.

```typescript
if (outputtedCSSNames.has(variable.cssName) && variable.layerType !== 'foundations') {
  // Skip - already output (foundations take priority)
  return true;
}
```

---

## Special Value Handling

### Unitless Numbers
Variables matching naming patterns like `weight`, `count`, `columns`, `opacity`, `z-index`, `order`, `flex-grow`, `flex-shrink`, `ratio` are output without `px` suffix. Detection uses segment-boundary matching to avoid false positives (e.g., `border` doesn't match `order`).

### Font-Style Strings
STRING variables containing CSS font-style keywords (`italic`, `oblique`, `normal`) are output unquoted.

### Decimal Precision
All CSS numeric output is capped at 2 decimal places.

---

## Future Considerations

### Potential Enhancements
1. **SCSS/LESS output** — Alternative preprocessor formats
2. **CSS Layers** — Use `@layer` for better cascade control
3. **Variable scoping** — Output to different selectors (not just `:root`)
4. **Additional breakpoint counts** — Support for 5+ breakpoints beyond the current 4

### Known Limitations
1. Clamp only works for numeric FLOAT values
2. Theme detection relies on "light"/"dark" in mode names
3. Breakpoint detection relies on "desktop"/"laptop"/"tablet"/"mobile" in mode names
4. Proportion detection relies on "proportion" in variable name and known fraction names

---

## File References

- **Main Plugin Code**: `code.ts`
- **Compiled Plugin Code**: `code.js`
- **UI Interface**: `ui.html`
- **Manifest**: `manifest.json`
- **Changelog**: `CHANGELOG.md`
