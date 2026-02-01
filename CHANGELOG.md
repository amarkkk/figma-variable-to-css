# Changelog

All notable changes to Variable to CSS are documented in this file.

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
