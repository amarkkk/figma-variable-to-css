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

### Desktop-First Approach
The system uses desktop-first media queries with `max-width` thresholds.

| Mode    | Viewport Width | Media Query              | Use Case |
|---------|---------------|--------------------------|----------|
| Desktop | >= 1680px     | (default, no query)      | Large monitors |
| Laptop  | >= 1366px     | @media (max-width: 1679px) | Standard laptops |
| Tablet  | >= 840px      | @media (max-width: 1365px) | Tablets, small laptops |
| Mobile  | >= 480px      | @media (max-width: 839px)  | Phones |

### Dual-Purpose Values
The `BREAKPOINT_MODES` values in code.ts serve two purposes:
1. **Clamp calculations**: Linear interpolation uses actual viewport widths
2. **Media queries**: Generated as `(breakpointPx - 1)` for max-width

```typescript
var BREAKPOINT_MODES: Record<string, number> = {
  'desktop': 1680,  // Clamp max viewport
  'laptop': 1366,   // Clamp interpolation point
  'tablet': 840,    // Clamp interpolation point
  'mobile': 480     // Clamp min viewport
};
```

---

## CSS Generation Methods

### 1. Clamp (Fluid Scaling)
Used for: **Numeric FLOAT values in Foundations without aliases**

```css
--dimension-heights-1: clamp(25.6px, calc(23.04px + 0.5333vw), 32px);
```

**Formula:**
```
slope = (maxValue - minValue) / (maxVP - minVP)
intercept = minValue - slope * minVP
clamp(minPx, calc(intercept + slope*100vw), maxPx)
```

### 2. Media Queries (Stepped Values)
Used for: **Aliases with changing references, non-FLOAT types**

```css
:root {
  --dimension-hero-intro--width: var(--dimension-grid-proportions-half);
}

@media (max-width: 1679px) {
  :root {
    --dimension-hero-intro--width: var(--dimension-grid-proportions-two-thirds);
  }
}
```

### 3. Theme Selectors
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

### For Breakpoint Collections (Foundations, Aliases Extended)

```css
/* 1. :root block with desktop values */
:root {
  /* Clampable variables get clamp() */
  --dimension-heights-1: clamp(25.6px, calc(...), 32px);

  /* Media query variables get desktop value */
  --dimension-hero-width: var(--dimension-grid-proportions-half);
}

/* 2. Media queries for alias variables (PRIMARY mechanism) */
@media (max-width: 1679px) {
  :root {
    --dimension-hero-width: var(--dimension-grid-proportions-two-thirds);
  }
}

/* 3. Fallback for clampable variables (older browsers) */
@supports not (width: clamp(1px, 1vw, 2px)) {
  @media (max-width: 1679px) {
    :root {
      --dimension-heights-1: 30.48px;
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

## Future Considerations

### Potential Enhancements
1. **Custom breakpoint configuration** - Allow users to define their own breakpoint values
2. **SCSS/LESS output** - Alternative preprocessor formats
3. **CSS Layers** - Use `@layer` for better cascade control
4. **Variable scoping** - Output to different selectors (not just `:root`)

### Known Limitations
1. Clamp only works for numeric FLOAT values
2. Theme detection relies on "light"/"dark" in mode names
3. Breakpoint detection relies on "desktop"/"laptop"/"tablet"/"mobile" in mode names

---

## File References

- **Main Plugin Code**: `code.ts`
- **UI Interface**: `ui.html`
- **Manifest**: `manifest.json`
- **Original Prompt**: `context/claude-code-prompt-multimode-css-only.md`
- **Sample Output**: `context/tokens.css` (v1.2), `output/design-tokens.css` (v1.3)
