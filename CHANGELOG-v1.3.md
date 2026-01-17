# Variable to CSS v1.3 - Changelog

## Release Date: 2026-01-17

## Summary

This release adds **multi-mode CSS export** support, enabling Figma variables with breakpoint modes (Desktop/Laptop/Tablet/Mobile) to output proper media queries for aliases that change `var()` references per breakpoint. Numeric foundation values continue to use `clamp()` for fluid scaling.

---

## New Features

### 1. Multi-Mode Alias Support
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

@media (max-width: 839px) {
  :root {
    --dimension-hero-intro--width: var(--dimension-grid-proportions-whole);
  }
}
```

### 2. Theme Mode Output Enhancement
Dark mode now outputs **both** selector types:
- `@media (prefers-color-scheme: dark)` - For system preference
- `[data-theme="dark"]` - For manual theme toggle via data attribute

### 3. Helper Functions
Added two new helper functions for mode analysis:
- `hasModeVariance()` - Detects if a variable has different values/aliases across modes
- `needsMediaQueries()` - Determines if a variable needs media queries (vs clamp)

---

## Technical Changes

### code.ts

#### Added Functions (lines 235-275)
```typescript
// Check if a variable has different values/aliases across modes
function hasModeVariance(variable, modes, options): boolean

// Check if a variable needs media queries (alias that changes reference, or non-clampable value)
function needsMediaQueries(variable, modes, options): boolean
```

#### Modified: `generateFluidCSS()` (lines 635-786)
Complete rewrite to separate variables into two categories:

1. **Clampable variables**: Numeric FLOAT values without aliases
   - Output with `clamp()` in `:root`
   - Fallback media queries inside `@supports not` block

2. **Media query variables**: Aliases that change references, non-FLOAT types
   - Output desktop value in `:root`
   - Output media queries **outside** `@supports` block (primary mechanism)

#### Modified: Theme CSS Selector (line 914)
Changed from `.dark` class to `[data-theme="dark"]` attribute selector.

#### Clarified: `BREAKPOINT_MODES` Comments (lines 73-81)
Added clear documentation that these values serve dual purposes:
- Actual viewport widths for clamp calculations
- Media query thresholds (using `breakpointPx - 1`)

### ui.html

#### Modified: Default Options (line 787)
Changed `darkModeOutput` from `'prefers-color-scheme'` to `'both'`.

#### Added: UI Info Text (lines 645-648)
Added "Responsive aliases" info item explaining media queries for mode-specific var() references.

---

## Breakpoint Reference

| Mode    | Viewport Width | Media Query Threshold |
|---------|---------------|----------------------|
| Desktop | 1680px        | (default, no query)  |
| Laptop  | 1366px        | max-width: 1679px    |
| Tablet  | 840px         | max-width: 1365px    |
| Mobile  | 480px         | max-width: 839px     |

---

## Bug Fix

**Issue:** Initial implementation incorrectly modified `BREAKPOINT_MODES` values, breaking clamp calculations.

**Root Cause:** The breakpoint values serve two purposes:
1. Linear interpolation for clamp (needs actual viewport widths)
2. Media query generation (subtracts 1 for max-width)

**Fix:** Restored original viewport widths (1680, 1366, 840, 480) which correctly generate both clamp formulas and media query thresholds.

---

## Migration Notes

No breaking changes. Existing CSS output structure is preserved. New features are additive:
- Aliases with changing references now get proper media queries
- Theme modes now output both prefers-color-scheme AND data-attribute selectors
