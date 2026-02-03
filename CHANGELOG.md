# Changelog

All notable changes to Variable to CSS are documented in this file.

---

## v1.5.1 — 2026-02-02

### Bug Fixes

**Fixed proportion-to-column mapping returning wrong values**

The v1.5 proportion detection was returning incorrect column counts due to substring matching order. For example, `three-quarters` was matching `quarter` (returning 3) before `three-quarters` (which should return 9).

**Before (broken):**
```css
/* Proportion: 3/12 columns (flex/grid-ready) */
--dimension-grid-proportions-three-quarters: 3;
/* Proportion: 4/12 columns (flex/grid-ready) */
--dimension-grid-proportions-two-thirds: 4;
```

**After (fixed):**
```css
/* Proportion: 9/12 columns (flex/grid-ready) */
--dimension-grid-proportions-three-quarters: 9;
/* Proportion: 8/12 columns (flex/grid-ready) */
--dimension-grid-proportions-two-thirds: 8;
```

**Technical change:** Converted `PROPORTION_COLUMNS` from an object to an array ordered by name length (longest first), ensuring compound names like `three-quarters` are checked before their substrings like `quarter`.

### UX Improvement

**Detected variables now checked by default**

Both viewport-relative and proportion candidate checkboxes are now checked by default when detected. Previously, users had to manually check each one. The "Deselect All" button allows users to opt-out if needed.

---

## v1.5 — 2026-02-02

### Summary

This release adds **grid proportion variable handling**, allowing proportion tokens (whole, half, third, quarter, etc.) to output as flex/grid-ready values instead of pixel-based `clamp()` calculations.

### New Features

#### 1. Grid Proportion Variable Detection

Variables with "proportion" in their name (excluding viewport) are detected as candidates for proportion output. Instead of `clamp()` pixel interpolation, these output as:

- **Unitless number** for `flex` usage: `--dimension-grid-proportions-half: 6;`
- **`fr` variant** for CSS Grid: `--dimension-grid-proportions-half--fr: 6fr;`

**Problem solved:** Grid proportions like "half" or "third" were calculated as pixel values that only matched exactly at hard breakpoints. Between breakpoints, they interpolated to arbitrary pixel values that didn't represent the design intent.

**Before (problematic):**
```css
--dimension-grid-proportions-half: clamp(156px, calc(39.6969vw - 14.9091px), 680px);
```

**After (when enabled):**
```css
/* Proportion: 6/12 columns (flex/grid-ready) */
--dimension-grid-proportions-half: 6;
--dimension-grid-proportions-half--fr: 6fr;
```

#### 2. Interactive Proportion Panel

After CSS generation, a blue info-styled panel appears showing detected proportion candidates. Users opt-in via checkboxes, then click "Apply & Regenerate".

- Blue info styling (distinct from orange viewport panel)
- Shows detected column count (e.g., "6/12 columns → flex: 6; / 6fr")
- "Select All / Deselect All" toggle
- Works alongside viewport panel (both can be active)

#### 3. Proportion Name Detection

Automatically detects proportion names based on 12-column grid:

| Name | Columns |
|------|---------|
| whole | 12 |
| three-quarters | 9 |
| two-thirds | 8 |
| half | 6 |
| third | 4 |
| quarter | 3 |

### Usage in CSS

**Flexbox:**
```scss
.sidebar { flex: var(--dimension-grid-proportions-third); }  /* 4 */
.main    { flex: var(--dimension-grid-proportions-two-thirds); }  /* 8 */
```

**CSS Grid:**
```scss
.layout {
  grid-template-columns:
    var(--dimension-grid-proportions-third--fr)      /* 4fr */
    var(--dimension-grid-proportions-two-thirds--fr); /* 8fr */
}
```

### Technical Changes

#### code.ts

**Added interfaces:**
- `ProportionCandidate` — Tracks detected proportion variable candidates with column count

**Added to ExportOptions:**
- `proportionOverrides` — Array of CSS names selected for proportion output

**Added to stats output:**
- `proportionVars` — Variables treated as proportions
- `proportionCandidates` — Detected candidates for UI

**Added functions:**
- `getProportionColumnCount()` — Detects proportion name and returns column count
- `shouldUseProportion()` — Checks if variable is in user's selection

**Added constant:**
- `PROPORTION_COLUMNS` — Maps proportion names to column counts

#### ui.html

**Added state:**
- `proportionCandidates` — Array of detected candidates
- `proportionSelections` — Object tracking checkbox states

**Added UI elements:**
- Proportion candidates panel (blue info style)
- Checkboxes and regenerate button

**Added functions:**
- `renderProportionCandidates()` — Renders the panel
- `updateProportionSelection()` — Handles checkbox changes
- `toggleAllProportionSelections()` — Select/deselect all
- `regenerateWithProportionSelections()` — Triggers regeneration

---

## v1.4 — 2026-02-01

### Summary

This release adds **viewport-relative variable handling**, **optional legacy fallbacks**, and a **CSS preview search** feature. These changes address issues with viewport-proportional tokens being incorrectly clamped and reduce CSS output size.

### New Features

#### 1. Viewport-Relative Variable Detection

Variables with "viewport" in their name or description are detected as candidates for special handling. Instead of linear interpolation with `clamp()`, these can use `min(100vw, max)` to maintain true viewport-relative behavior.

**Problem solved:** A token like `--dimension-grid-proportions-viewport` was output as:
```css
--dimension-grid-proportions-viewport: clamp(360px, calc(110vw - 168px), 1680px);
```

At 450px viewport, this calculates to 327px but clamps to 360px minimum — squeezing content.

**New behavior (when enabled):**
```css
--dimension-grid-proportions-viewport: min(100vw, 1680px);
```

#### 2. Interactive Viewport Panel

After CSS generation, a warning-styled panel appears showing detected viewport candidates. Users opt-in via checkboxes, then click "Apply & Regenerate" to update the output.

- Orange warning styling to draw attention
- Checkboxes for each candidate variable
- "Select All / Deselect All" toggle
- Shows detection reason (found in name vs description)

#### 3. Optional Legacy Fallbacks

The `@supports not (width: clamp(...))` fallback blocks are now optional via a checkbox (unchecked by default). This significantly reduces CSS file size for projects that don't need IE/old browser support.

#### 4. CSS Preview Search

Search field in the preview header for quick validation of generated CSS:

- Real-time search with debouncing
- Yellow highlights for matches, orange for current match
- Previous/Next navigation buttons
- Keyboard navigation: Enter (next), Shift+Enter (previous)
- Shows "X of Y" match count

### Technical Changes

#### code.ts

**Added interfaces:**
- `ViewportCandidate` — Tracks detected viewport-relative variable candidates
- `ExportOptions.includeLegacyFallbacks` — Boolean for legacy fallback toggle
- `ExportOptions.viewportRelativeOverrides` — Array of user-selected variable names

**Added functions:**
- `getViewportCandidateReason()` — Detects if variable name/description contains "viewport"
- `shouldUseViewportRelative()` — Checks if variable is in user's selection list

**Modified functions:**
- `generateFluidValue()` — Returns `min(100vw, max)` for selected viewport-relative vars
- `generateFluidCSS()` — Conditionally includes legacy fallbacks; tracks viewport candidates

#### ui.html

**Added state:**
- `viewportCandidates` — Array of detected candidates
- `viewportSelections` — Object tracking checkbox states
- Search state variables for match tracking

**Added UI elements:**
- Viewport candidates warning panel with checkboxes
- "Include legacy browser fallbacks" checkbox in options
- Search input, navigation buttons, results info in preview header

**Added functions:**
- `renderViewportCandidates()` — Renders the warning panel
- `performSearch()`, `highlightMatches()`, `clearSearchHighlights()` — Search functionality
- `goToNextMatch()`, `goToPrevMatch()` — Navigation helpers

---

## v1.3 — 2026-01-17

### Summary

This release adds **multi-mode CSS export** support, enabling Figma variables with breakpoint modes (Desktop/Laptop/Tablet/Mobile) to output proper media queries for aliases that change `var()` references per breakpoint. Numeric foundation values continue to use `clamp()` for fluid scaling.

### New Features

#### 1. Multi-Mode Alias Support

Variables in "Aliases Extended" layers that reference different foundation aliases per breakpoint now output proper CSS media queries **outside** the `@supports` fallback block.

**Before (v1.2):** Responsive alias changes were only in `@supports not` fallback blocks, meaning modern browsers missed them.

**After (v1.3):**
```css
:root {
  --dimension-hero-intro--width: var(--dimension-grid-proportions-half);
}

@media (max-width: 1679px) {
  :root {
    --dimension-hero-intro--width: var(--dimension-grid-proportions-two-thirds);
  }
}

@media (max-width: 1365px) {
  :root {
    --dimension-hero-intro--width: var(--dimension-grid-proportions-whole);
  }
}
```

#### 2. Theme Mode Output Enhancement

Dark mode now outputs **both** selector types:
- `@media (prefers-color-scheme: dark)` — For system preference
- `[data-theme="dark"]` — For manual theme toggle via data attribute

#### 3. Helper Functions

Added two new helper functions for mode analysis:
- `hasModeVariance()` — Detects if a variable has different values/aliases across modes
- `needsMediaQueries()` — Determines if a variable needs media queries (vs clamp)

### Technical Changes

#### code.ts

**Added functions:**
- `hasModeVariance()` — Check if a variable has different values/aliases across modes
- `needsMediaQueries()` — Check if a variable needs media queries

**Modified:**
- `generateFluidCSS()` — Complete rewrite to separate clampable variables from media query variables
- Theme CSS selector changed from `.dark` class to `[data-theme="dark"]` attribute

#### ui.html

- Default `darkModeOutput` changed to `'both'`
- Added "Responsive aliases" info text

### Bug Fix

**Issue:** Initial implementation incorrectly modified `BREAKPOINT_MODES` values, breaking clamp calculations.

**Fix:** Restored original viewport widths (1680, 1366, 840, 480) which correctly generate both clamp formulas and media query thresholds.

### Breakpoint Reference

| Mode    | Viewport Width | Media Query Threshold |
|---------|---------------|----------------------|
| Desktop | 1680px        | (default, no query)  |
| Laptop  | 1366px        | max-width: 1679px    |
| Tablet  | 840px         | max-width: 1365px    |
| Mobile  | 480px         | max-width: 839px     |

---

## Migration Notes

### v1.3 → v1.4
No breaking changes. New features are additive:
- Legacy fallbacks now off by default (enable via checkbox if needed)
- Viewport-relative detection is opt-in (no automatic changes to output)

### v1.2 → v1.3
No breaking changes. Existing CSS output structure is preserved:
- Aliases with changing references now get proper media queries
- Theme modes now output both prefers-color-scheme AND data-attribute selectors
