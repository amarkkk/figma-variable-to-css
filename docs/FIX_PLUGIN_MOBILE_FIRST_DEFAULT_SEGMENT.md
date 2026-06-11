# Bug Fix: Mobile-First Export — Wrong Default Segment in `:root`

## Plugin

`github.com/amarkkk/figma-variable-to-css`

This plugin reads Figma Variables and exports them as CSS custom properties. It supports a **piecewise non-linear clamp** scaling system: fluid tokens are split into multiple viewport-range segments, each with its own `clamp()` function, stitched together via media queries. It has two output direction modes: **desktop-first** (default, `max-width` media queries) and **mobile-first** (`min-width` media queries, set via the `Direction` export option).

---

## The Bug

When exporting in **mobile-first** mode, the plugin correctly inverts all media query directions (`max-width` → `min-width` with complementary breakpoint values), but **fails to swap which segment becomes the `:root` (no-media-query) default**.

In desktop-first mode, the `:root` block correctly holds the **largest/Desktop segment** values.
In mobile-first mode, the `:root` block should hold the **smallest/Mobile segment** values — but instead it still holds the **largest/Desktop segment** values, identical to desktop-first mode.

The result: the mobile segment clamp is dropped entirely. No block in the mobile-first output contains it.

---

## Evidence

### Desktop-first output (correct, from `docs/tokens-old.css`)

The file header has no `Direction:` line (default = desktop-first).

For `--dimension-grid-margin` (piecewise, 3 segments):

```css
/* Segment 3: Laptop→Desktop (1366px–1680px) — emitted as :root default */
:root {
  --dimension-grid-margin: clamp(103.26px, calc(7.879vw - 4.37px), 128px);
}

/* Segment 2: Tablet→Laptop (840px–1366px) */
@media (max-width: 1679px) {
  :root {
    --dimension-grid-margin: clamp(61.82px, calc(7.8783vw - 4.36px), 103.26px);
  }
}

/* Segment 1: Mobile→Tablet (<840px) — emitted as smallest max-width override */
@media (max-width: 1365px) {
  :root {
    --dimension-grid-margin: clamp(24px, calc(10.5056vw - 26.43px), 61.82px);
  }
}
```

At 360px viewport: `max-width: 1365px` fires, gives `clamp(24, 11.39, 61.82)` → **24px** ✓
Container width: `360 - (2 × 24)` = **312px** ✓ (matches Figma at mobile min)

---

### Mobile-first output (buggy, from `src/styles/tokens.css` / `docs/design-tokens-2026-02-26.css`)

The file header has `Direction: Mobile-first (min-width)`.

For `--dimension-grid-margin`:

```css
/* BUG: :root still has Segment 3 (Laptop→Desktop) — should be Segment 1 (Mobile) */
:root {
  --dimension-grid-margin: clamp(103.26px, calc(7.879vw - 4.37px), 128px);
}

/* Correct: Segment 2 (Tablet→Laptop) at @media (min-width: 840px) */
@media (min-width: 840px) {
  :root {
    --dimension-grid-margin: clamp(61.82px, calc(7.8783vw - 4.36px), 103.26px);
  }
}

/* Correct: Segment 3 (Laptop→Desktop) at @media (min-width: 1366px) */
/* But note: this is identical to the :root value above — a clear sign the wrong segment is the default */
@media (min-width: 1366px) {
  :root {
    --dimension-grid-margin: clamp(103.26px, calc(7.879vw - 4.37px), 128px);
  }
}

/* Segment 1 (Mobile clamp) is COMPLETELY ABSENT from the file */
```

At 360px viewport: no `min-width` queries fire, `:root` fires → `clamp(103.26, 23.99, 128)` → **103.26px** ✗
Container width: `360 - (2 × 103.26)` = **153px** ✗ (should be 312px)

---

### Expected mobile-first output (correct)

```css
/* Segment 1: Mobile→Tablet (<840px) — should be :root default */
:root {
  --dimension-grid-margin: clamp(24px, calc(10.5056vw - 26.43px), 61.82px);
}

/* Segment 2: Tablet→Laptop */
@media (min-width: 840px) {
  :root {
    --dimension-grid-margin: clamp(61.82px, calc(7.8783vw - 4.36px), 103.26px);
  }
}

/* Segment 3: Laptop→Desktop */
@media (min-width: 1366px) {
  :root {
    --dimension-grid-margin: clamp(103.26px, calc(7.879vw - 4.37px), 128px);
  }
}
```

At 360px: `:root` fires → `clamp(24, 11.39, 61.82)` → **24px** ✓

---

## Scope of Impact

The bug affects **every piecewise-clamp token** in the foundations layer. In this project that means:

- **DIMENSION foundations**: `--dimension-grid-margin`, `--dimension-grid-column-size`, `--dimension-grid-column-gutter`, and all `--dimension-heights-*` tokens
- **SPACE foundations**: all `--space-fixed-vertical-rhythm-*`, `--space-fluid-meso-*`, `--space-fluid-macro-*` tokens
- **TYPO foundations**: all `--typo-type-size-*` and `--typo-type-line-height-*` piecewise-clamp tokens

**Not affected**: static values, color tokens, aliases, mappings — those don't use piecewise clamp and are converted correctly.

The broken `:root` vs correct `:root` values for a full set of tokens can be found in:
- Wrong mobile defaults: `docs/design-tokens-2026-02-26.css` `:root` FOUNDATIONS blocks
- Correct mobile values: `docs/tokens-old.css` `@media (max-width: 1365px)` FOUNDATIONS blocks

---

## The Breakpoint Mapping

The project uses 4 viewport segments. The correct segment → output block mapping for each mode:

| Segment | Viewport range | Desktop-first (old) | Mobile-first (correct) |
|---|---|---|---|
| Mobile | < 840px | `@media (max-width: 839px)` | **`:root` (default)** |
| Tablet | 840px – 1365px | `@media (max-width: 1365px)` | `@media (min-width: 840px)` |
| Laptop | 1366px – 1679px | `@media (max-width: 1679px)` | `@media (min-width: 1366px)` |
| Desktop | ≥ 1680px | **`:root` (default)** | `@media (min-width: 1680px)` |

The plugin currently implements the desktop-first column correctly. For mobile-first it only swaps the media query direction without swapping which segment is the default.

**Note on segment count**: Tokens don't all have the same number of segments. `--dimension-grid-margin` has 3 segments (no `@media (max-width: 839px)` block in desktop-first — the mobile clamp at `max-width: 1365px` handles both mobile and tablet via its clamp min/max). Other tokens like `--dimension-grid-column-size` have 4 segments (including a `max-width: 839px` block). The fix must correctly handle N-segment tokens: the smallest breakpoint segment (whichever `max-width` block has the lowest pixel value in desktop-first) always becomes the `:root` default in mobile-first.

---

## Where the Bug Likely Lives

The plugin generates CSS blocks in a loop over segments. In pseudo-code, the current (broken) mobile-first logic probably looks like:

```js
// Current (broken) — emits all segments as min-width blocks,
// then separately writes :root using the LARGEST segment's values
// (same logic path as desktop-first)

const segments = getSortedSegments(); // smallest → largest
const defaultSegment = segments[segments.length - 1]; // BUG: always takes largest

writeBlock(':root', defaultSegment.values);

for (const segment of segments) {
  if (isMobileFirst) {
    if (segment.breakpoint > mobileMinBreakpoint) {
      writeBlock(`@media (min-width: ${segment.breakpoint}px)`, segment.values);
    }
  }
}
```

The correct mobile-first logic should be:

```js
const segments = getSortedSegments(); // smallest → largest

if (isMobileFirst) {
  // Mobile-first: smallest segment → :root, larger segments → min-width blocks
  const defaultSegment = segments[0]; // FIXED: take smallest
  writeBlock(':root', defaultSegment.values);

  for (const segment of segments.slice(1)) { // skip the first (already in :root)
    writeBlock(`@media (min-width: ${segment.breakpoint}px)`, segment.values);
  }
} else {
  // Desktop-first: largest segment → :root, smaller segments → max-width blocks
  const defaultSegment = segments[segments.length - 1];
  writeBlock(':root', defaultSegment.values);

  for (const segment of segments.slice(0, -1).reverse()) { // skip the last
    writeBlock(`@media (max-width: ${segment.upperBreakpoint - 1}px)`, segment.values);
  }
}
```

The exact variable and function names will differ in the actual plugin code — this is the algorithmic pattern to look for and correct.

---

## What to Look For in the Plugin Code

1. **Search for where the `:root` block is constructed** for fluid/piecewise tokens. There will be logic that selects which segment's values go into the no-media-query `:root` block.

2. **Look for a direction/mode flag** (something like `isMobileFirst`, `direction === 'mobile-first'`, or a `Direction` export setting check). The `:root` segment selection should branch on this flag.

3. **Look for a loop that generates `@media` blocks** for segments other than the default. In mobile-first mode, the loop should skip `segments[0]` (already in `:root`) and emit `segments[1..N]` as `min-width` blocks. In desktop-first mode, it skips `segments[N]` and emits `segments[0..N-1]` as `max-width` blocks.

4. **The media query breakpoint values are already correct** in the mobile-first output — only the `:root` default and segment ordering need fixing.

---

## Verification

After the fix, export from Figma with `Direction: Mobile-first (min-width)` and verify:

### For `--dimension-grid-margin`:
- `:root` = `clamp(24px, ...)` with min ≈ 24px ← **mobile minimum**
- `@media (min-width: 840px)` = `clamp(61.82px, ...)` ← tablet range starts at 61.82px
- `@media (min-width: 1366px)` = `clamp(103.26px, ...)` ← laptop range starts at 103.26px

### At 360px viewport, for `--dimension-grid-margin`:
- Computed value should be **24px** (at the clamp minimum)
- Container: `360 - (2 × 24)` = **312px** ✓

### Sanity check — the `:root` default and `@media (min-width: [laptop breakpoint])` values should be **different**:
- If they are identical, the bug is still present (the `:root` still has the largest segment value)

### Desktop-first mode must be unaffected:
- Export with desktop-first direction (default / no Direction setting)
- `:root` should still have the largest segment (e.g., `clamp(103.26px, ..., 128px)` for grid-margin)
- `@media (max-width: 1679px)` and `@media (max-width: 1365px)` should be present with their correct values

---

## Reference Files

Both files are in the Astro project repo at `astro/amark.design/`:

| File | Description |
|---|---|
| `docs/tokens-old.css` | Desktop-first export (correct, currently deployed to Vercel). The correct mobile clamp values are in its `@media (max-width: 1365px)` blocks for DIMENSION/SPACE/TYPO foundations. |
| `docs/design-tokens-2026-02-26.css` | Mobile-first export (buggy). Same `:root` values as old file = proof the default segment was not swapped. |
| `src/styles/tokens.css` | Same content as `design-tokens-2026-02-26.css` — the live file the Astro build uses. **Do not manually patch this** — it will be overwritten on next export. Fix the plugin instead. |

---

## Context: Why This Matters

The container width of every section on the site is calculated as:

```scss
$page-width-container: calc(var(--page-width-viewport) - (2 * var(--dimension-grid-margin)));
```

With the buggy export, at 360px (mobile minimum):
- `--dimension-grid-margin` = 103.26px (wrong — Desktop clamp minimum)
- Container = 360 - 206.52 = **153px**

With the fixed export:
- `--dimension-grid-margin` = 24px (correct — Mobile clamp minimum)
- Container = 360 - 48 = **312px** (matches Figma spec)

Every fluid SPACE and TYPO token is similarly wrong at mobile, causing the entire site to render with desktop-sized spacing and typography on mobile viewports.
