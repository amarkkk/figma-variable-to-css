# Design Token Responsive Scaling System

> 📖 **This document serves as the design conventions reference for the [Variable to CSS](./README.md) Figma plugin.** It defines the breakpoints, scaling formulas, and token architecture that the plugin uses to generate fluid CSS.

## Project Overview

Development of a fluid responsive design token system for **amark.design** portfolio website. The system is built on a 32px vertical rhythm foundation with a 12-column grid, targeting designers, recruiters, and design team leads (primarily desktop/laptop users).

---

## Core Principles

### 1. Vertical Rhythm First
- **Desktop VR:** 32px (body line-height)
- **Mobile VR:** 25.6px (body line-height)
- Body size derived from VR: `VR ÷ 1.6`
- All spacing and line heights relate back to VR multiples

### 2. Fluid Scaling
Values scale continuously using CSS clamp/interpolation. Figma modes represent samples of a continuous curve, not discrete states.

### 3. Desktop-Locked Reference
Desktop (1680px) values are locked as the primary reference. Mobile (360px) values define the minimum. Intermediate breakpoints are calculated.

---

## Breakpoints

### Content-Driven Approach
Breakpoints are determined by **content needs**, not arbitrary device widths. The approach: start at minimum viewport, identify when layout changes are needed (e.g., "another card would fit"), and define breakpoints there.

### Card Minimum Width Requirements
These constraints drive breakpoint decisions:
- **Case study card** (image + text): 540px minimum
- **"Other Studies" card:** 360px minimum
- **Plugin card:** 320px minimum

### Full 6-Breakpoint Structure

| Name | Viewport | Container | Type | Layout Capability |
|------|----------|-----------|------|-------------------|
| **Desktop** | 1680px | 1424px | Locked | Full layouts, max content |
| **Laptop** | 1366px | ~1159px | Hard | 2 cards + description, 3 small cards |
| **Tablet+** | 1024px | ~880px | Soft | Small laptop / large tablet transition |
| **Tablet** | 840px | ~716px | Hard | 2 cards comfortable |
| **Mobile+** | 480px | ~432px | Soft | Wide phone, 1 card with breathing room |
| **Mobile** | 360px | 312px | Locked | 1 card maximum |

### Hard vs Soft Breakpoints
- **Hard breakpoints:** Major layout shifts occur here (column count changes, layout restructuring)
- **Soft breakpoints:** Fine-tuning zone, values interpolate through but no major layout change

### Layout Calculations

**"2 cards + description" layout (Figma Plugins section):**
```
2 × 340px cards + 360px description + 2×40px gutters + 2×56px margins = ~1232px
```
→ Needs Laptop breakpoint (~1366px) to fit comfortably

**"2 cards" layout (Other Studies on tablet):**
```
2 × 360px cards + 24px gutter + 2×32px margins = ~808px
```
→ Tablet breakpoint at 840px provides this

**"1 card" layout:**
Below 480px, single column works. At 360px viewport → 312px card width ✓

### Why These Specific Values?

| Breakpoint | Reasoning |
|------------|-----------|
| **1680px** | Common desktop width, provides generous margins |
| **1366px** | Covers older Windows laptops (1366×768 very common), MacBook Air/Pro 13" at default scaling (~1440px effective) |
| **1024px** | iPad landscape, small laptops — transition zone |
| **840px** | Minimum for 2 cards with comfortable gutters |
| **480px** | Wide phones (iPhone Plus/Max), single card with extra breathing room |
| **360px** | Minimum Android phone width, ensures broad compatibility |

---

## Typography

### Fixed Sizes
Supplementary text sizes that scale linearly.

| Token | Desktop | Laptop | Tablet | Mobile |
|-------|---------|--------|--------|--------|
| fixed/1 | 16px | 15.52px | 14.73px | 14px |
| fixed/2 | 18px | 17.05px | 15.45px | 14px |
| fixed/3 (body) | 20px | 19.05px | 17.45px | 16px |
| fixed/4 | 24px | 22.57px | 20.18px | 18px |

### Scaled Sizes
Heading sizes with different scaling curves.

| Token | Desktop | Laptop | Tablet | Mobile | Curve |
|-------|---------|--------|--------|--------|-------|
| scaled/1 | 20px | 20px | 20px | 20px | constant |
| scaled/2 | 28px | 27.05px | 25.45px | 24px | linear |
| scaled/3--shortform | 25.6px | 24.74px | 23.31px | 22px | linear |
| scaled/3--longform | 32px | 30.48px | 27.93px | 25.6px | linear |
| **scaled/4** | 38.4px | 33.05px | 29.26px | 28.8px | **t³ (aggressive)** |
| **scaled/5** | 51.2px | 40.50px | 32.92px | 32px | **t³ (aggressive)** |

#### Why t³ Curve for scaled/4 and scaled/5?
Linear interpolation kept hero headings too large on tablet/laptop screens. The t³ (cubic) curve creates more aggressive reduction from desktop, making headings more proportional on smaller screens while maintaining hierarchy.

**Linear vs t³ comparison for scaled/5:**
| Breakpoint | Linear | t³ |
|------------|--------|-----|
| Desktop | 51.2px | 51.2px |
| Laptop | 46.6px | **40.5px** |
| Tablet | 39.0px | **32.9px** |
| Mobile | 32px | 32px |

### Line Heights

Line heights use **half-VR snapping** for finer granularity while maintaining grid alignment.

#### Snapping Logic
- Calculate ideal line height: `font-size × multiplier`
- Find nearest half-VR multiple within acceptable ratio range
- **Tight:** target 1.25, range 1.18–1.35
- **Text:** target 1.60, range 1.55–1.68

#### Available VR Multiples
```
0.5, 0.5625, 0.625, 0.6875, 0.75, 0.8125, 0.875, 0.9375,
1.0, 1.0625, 1.125, 1.1875, 1.25, 1.3125, 1.375, 1.4375,
1.5, 1.5625, 1.625, 1.6875, 1.75, 1.8125, 1.875, 1.9375,
2.0, 2.125, 2.25, 2.375, 2.5, 2.625, 2.75, 2.875, 3.0
```

#### Resulting Ratio Consistency
All tokens achieve variance < 0.08 (good) or < 0.12 (acceptable) across breakpoints.

| Token | Tight Ratio Range | Text Ratio Range |
|-------|-------------------|------------------|
| fixed/3 | 1.20 (constant) | 1.60 (constant) |
| scaled/3-long | 1.25 (constant) | 1.62 (constant) |
| scaled/4 | 1.22–1.27 | 1.61 (constant) |
| scaled/5 | 1.25–1.27 | 1.56–1.60 |

---

## Spacing

### Fixed Spacing
Constant values across all breakpoints.

| Token | Value |
|-------|-------|
| fixed/1 | 2px |
| fixed/2 | 4px |
| fixed/3 | 8px |
| fixed/4 | 12px |
| fixed/5 | 16px |
| fixed/6 | 24px |
| fixed/7 | 32px |

### VR Multiples (Scaling)
Scale proportionally with vertical rhythm.

| Token | Desktop | Laptop | Tablet | Mobile |
|-------|---------|--------|--------|--------|
| VR×1 | 32px | 30.48px | 27.93px | 25.6px |
| VR×2 | 64px | 60.96px | 55.85px | 51.2px |
| VR×3 | 96px | 91.43px | 83.78px | 76.8px |
| VR×10 | 320px | 304.78px | 279.27px | 256px |
| VR×12 | 384px | 365.73px | 335.13px | 307.2px |

### Meso Spacing (Scaling)
Medium-scale spacing that scales with VR ratio.

| Token | Desktop | Laptop | Tablet | Mobile |
|-------|---------|--------|--------|--------|
| meso/1 | 15px | 14.29px | 13.09px | 12px |
| meso/2 | 20px | 19.05px | 17.45px | 16px |
| meso/3 | 30px | 28.57px | 26.18px | 24px |
| meso/4 | 40px | 38.10px | 34.91px | 32px |
| meso/5 | 50px | 47.62px | 43.64px | 40px |
| meso/6 | 60px | 57.15px | 52.36px | 48px |

### Macro Spacing
Large-scale spacing with linear interpolation.

| Token | Desktop | Mobile |
|-------|---------|--------|
| macro/1 | 40px | 30px |
| macro/2 | 60px | 40px |
| macro/3 | 80px | 60px |
| macro/4 | 120px | 80px |
| macro/5 | 160px | 120px |
| macro/6 | 200px | 160px |

---

## Grid

### Structure
- **12 columns** at all breakpoints (proportional framework, not literal layout columns)
- Grid scales fluidly between endpoints
- Grid overlay visible as design feature on website (users can toggle)

| Property | Desktop | Laptop | Tablet+ | Tablet | Mobile+ | Mobile |
|----------|---------|--------|---------|--------|---------|--------|
| Viewport | 1680px | 1366px | 1024px | 840px | 480px | 360px |
| Container | 1424px | ~1159px | ~880px | ~716px | ~432px | 312px |
| Margin | 128px | ~103px | ~79px | ~62px | ~24px | 24px |
| Gutter | 64px | ~54px | ~42px | ~36px | ~23px | 20px |
| Column | 60px | ~48px | ~35px | ~27px | ~14px | ~8px |

*Note: Tablet+ and Mobile+ are soft breakpoints — values shown are interpolated, not design targets.*

### Proportions
Grid proportions calculated from column and gutter sizes.

| Proportion | Formula | Desktop |
|------------|---------|---------|
| whole | 12 cols + 11 gutters | 1424px |
| three-quarter | 9 cols + 8 gutters | 1052px |
| two-thirds | 8 cols + 7 gutters | 928px |
| half | 6 cols + 5 gutters | 680px |
| third | 4 cols + 3 gutters | 432px |
| quarter | 3 cols + 2 gutters | 308px |

---

## Key Formulas

### Linear Interpolation
```
value = mobile_value + (desktop_value - mobile_value) × t
where t = (viewport - 360) / (1680 - 360)
```

### t³ Curve (for scaled/4, scaled/5)
```
value = mobile_value + (desktop_value - mobile_value) × t³
```

### CSS Clamp (Linear)
```css
--property: clamp(min_rem, intercept_rem + slope_vw, max_rem);

/* Example for VR */
--vr: clamp(1.6rem, 0.9143rem + 1.8182vw, 2rem);
```

### VR-Snapped Line Height
```python
def snap_to_vr(font_size, vr, target_ratio=1.25, min_ratio=1.18, max_ratio=1.35):
    for mult in VR_MULTIPLES:
        lh = vr * mult
        ratio = lh / font_size
        if min_ratio <= ratio <= max_ratio:
            if abs(ratio - target_ratio) < best_diff:
                best_lh = lh
    return best_lh
```

---

## Design Decisions Made

### 1. scaled/3--shortform vs --longform
Two parallel H3 tokens for different contexts:
- **shortform:** Card titles (scales down normally)
- **longform:** Documentation H3 (scales down normally)

Both use linear interpolation, unlike scaled/4 and scaled/5.

### 2. fixed/1 and fixed/2 → 14px on Mobile
Supplementary text can be smaller on mobile. 14px is the absolute minimum for accessibility.

### 3. fixed/4 → 18px on Mobile
Large body text doesn't need to be as large on mobile where reading distances are shorter.

### 4. Meso Spacing Scales with VR
Originally constant, changed to scale proportionally with VR ratio (0.8× reduction from desktop to mobile).

### 5. Half-VR Steps for Line Heights
Full VR snapping created inconsistent ratios (gaps between available values). Half-VR steps provide finer granularity while maintaining grid alignment.

---

## Files Generated

1. **Design_Foundations_v3.xlsx** — Final spreadsheet with all calculated values
2. **design-tokens-calculator-v2.html** — Interactive calculator (earlier version, before final adjustments)

---

## Implementation Notes

### For Figma
- Import spreadsheet values as Figma Variables
- **4 modes** in Figma: Desktop, Laptop, Tablet, Mobile (hard breakpoints only)
- Soft breakpoints (Tablet+, Mobile+) are for CSS interpolation reference, not separate Figma modes
- Values interpolate continuously in CSS, but Figma shows discrete samples at hard breakpoints

### For CSS
- Use `clamp()` for fluid scaling between Mobile (360px) and Desktop (1680px)
- Hard breakpoints define where layout shifts occur (media queries for layout changes)
- Soft breakpoints: no media queries needed, values flow through naturally via clamp()
- t³ curve tokens require media query overrides OR accept linear clamp as approximation
- Line heights can use CSS `calc()` with VR custom property

### Soft vs Hard Breakpoints in Practice
```css
/* Hard breakpoint: layout changes */
@media (min-width: 840px) {
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Soft breakpoint: no media query needed */
/* Values at 1024px and 480px are just interpolated via clamp() */
```

### Limitations
- CSS `clamp()` is inherently linear
- Non-linear curves (t³) in CSS would require stepped media queries
- Accept slight deviation at intermediate viewports or use JS for true curves

---

## Summary of Changes from Original

| Category | Original Issue | Solution |
|----------|----------------|----------|
| Breakpoint strategy | Device-based, arbitrary widths | Content-driven, based on card fitting |
| Breakpoint count | 4 breakpoints | 6 breakpoints (4 hard + 2 soft) |
| Laptop breakpoint | 1320px (too narrow for layouts) | 1366px (fits 2 cards + description) |
| Tablet breakpoint | 736px (cramped 2-card layouts) | 840px (2 cards comfortable) |
| scaled/4, scaled/5 | Too large on laptop/tablet | t³ aggressive curve |
| fixed/1, fixed/2 | Too large on mobile | Scale to 14px |
| fixed/4 | Too large on mobile | Scale to 18px |
| Meso spacing | Not scaling | Scale with VR ratio |
| Line heights | Inconsistent ratios, some too loose | Half-VR snapping with ratio bounds |

---

## Plugin Implementation Details

The **Variable to CSS** Figma plugin implements these design conventions. This section documents plugin-specific behaviors.

### CSS Output Modes

**Fluid Mode (Default)**
- Uses CSS `clamp()` for continuous scaling between Mobile (360px) and Desktop (1680px)
- Formula: `clamp(min_rem, intercept_rem + slope_vw, max_rem)`
- All intermediate viewport values are interpolated automatically

**Stepped Mode (Legacy)**
- Uses `@media` queries at each hard breakpoint
- Fallback for browsers that don't support `clamp()`
- Can be enabled via "Include legacy fallbacks" option

### Viewport-Relative Variables

Some variables should scale with the viewport rather than interpolate between fixed values. For example, a "viewport proportion" token should be `100vw` on any viewport, not clamped to a minimum.

**Detection:** Variables with "viewport" in their name or description are flagged as candidates.

**Behavior:** Instead of `clamp(360px, calc(...), 1680px)`, these output:
```css
--dimension-grid-proportions-viewport: min(100vw, 1680px);
```

**User Control:** The plugin shows detected candidates in a warning panel. Users opt-in via checkboxes before regenerating.

### Breakpoint Mode Detection

The plugin expects Figma variable modes named:
- **Desktop** — Primary reference (1680px)
- **Laptop** — Hard breakpoint (1366px)
- **Tablet** — Hard breakpoint (840px)
- **Mobile** — Minimum reference (360px)

Soft breakpoints (Tablet+ at 1024px, Mobile+ at 480px) are not represented as Figma modes — they exist only as interpolated CSS values.

### Theme Mode Detection

For color variables with theme modes:
- Mode names containing "Light" → `:root` or `[data-theme="light"]`
- Mode names containing "Dark" → `@media (prefers-color-scheme: dark)` or `[data-theme="dark"]`

### Token Layer Detection

Collection names following the pattern **"Domain - Layer"** are parsed:
| Layer Pattern | Example | CSS Grouping |
|---------------|---------|--------------|
| `1. Foundations` | `Typo - 1. Foundations` | Base values, responsive |
| `2. Aliases` | `Space - 2. Aliases` | Semantic names, single mode |
| `2.1 Aliases Extended` | `Dimension - 2.1 Aliases Extended` | Component variations |
| `4. Mappings` | `Color - 4. Mappings` | Component-scoped |

### Linear vs Non-Linear Scaling

CSS `clamp()` is inherently linear. Tokens using non-linear curves (t³) in the design system will have slight deviation at intermediate viewports when output as `clamp()`.

**Options:**
1. Accept linear approximation (recommended for most cases)
2. Use stepped media queries for critical tokens
3. Implement JS-based scaling for precise curves

### Alias Preservation

The plugin preserves `var()` references in the output to maintain the design system hierarchy:
```css
/* Alias points to foundation */
--space-section-gap: var(--space-vr-x3);

/* Not resolved to raw value */
--space-section-gap: 96px; /* ❌ loses relationship */
```

This enables cascading updates: changing a foundation value automatically updates all aliases.
