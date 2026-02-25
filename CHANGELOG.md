# Changelog

All notable changes to Variable to CSS are documented in this file.

---

## v1.9.1 — 2026-02-25

### Summary

Edge Cases panel refinement focused on usability, visual hierarchy, and polish. The piecewise scaling section is now scrollable, less noisy, and has smooth transitions. A new **Grid Proportions** section surfaces auto-detected proportion variables. All three edge case sections now have collapsible explanation boxes and dynamic selection badges.

### UX Improvements

#### Cleaner variable hierarchy

Variable items in the piecewise scaling list no longer show bordered boxes or mode value decimals (e.g., "Desktop: 53.673785363 · Tablet: 42.12..."). The values are already visible in the bar chart. Group headers now have a subtle background to create clear visual weight: Collection (bold, sticky) → Group (semi-bold, bg-secondary) → Variable (transparent, indented).

#### Dynamic selection badges

Both the Piecewise Scaling and Viewport-Relative section headers now show a "selected/total" badge (e.g., "32/76") that updates in real-time as checkboxes are toggled. Replaces the static count and removes the "76 candidates. Use collection/group checkboxes for bulk selection." info text.

#### Grid Proportions section

New read-only section at the top of the Edge Cases column. Shows auto-detected proportion variables (half, third, quarter, etc.) with a green "auto" badge, collapsible "What are grid proportions?" explanation, and column count for each candidate. No opt-in needed — proportions are always applied.

#### Viewport-relative explanation

Replaced the static description text with a collapsible "What is viewport-relative scaling?" info box, matching the piecewise scaling section's pattern.

#### Deviation overlay repositioned

The informative popup (SVG slope chart + segment table) now appears adjacent to the hovered bar chart instead of at the far edge of the panel. Tooltip values capped at 2 decimal places.

#### Smooth transitions

Added subtle transitions throughout the edge cases panel: info box expand/collapse, deviation overlay fade in/out, collection/group accordion open/close, checkbox state changes, and hover states on candidate items and headers.

### Bug Fixes

#### Edge cases column now scrollable

The entire edge cases column was not scrollable when piecewise scaling content exceeded the viewport height. Root cause was layered `overflow: hidden` on `.edge-case-panel`, `.detection-panel`, and `flex: 1` on `.detection-section` forcing equal height distribution. Fixed by making the column scrollable at the top level and removing flex constraints on sections.

#### Accordion transitions now work

Collection and group accordions had `display: none` toggling which completely disables CSS transitions. Replaced with `max-height: 0; opacity: 0` pattern so the expand/collapse animates smoothly. Removed inline `style="display:none"` from the render function in favor of CSS-only state via the `.collapsed` class.

---

## v1.9 — 2026-02-20

### Summary

Major UI restructure and CSS output improvements. The plugin window is reorganized from a 2-pane sidebar+preview layout into a **4-column resizable grid** (Collections | Options | Edge Cases | CSS Preview). CSS output now supports **mobile-first (min-width)** as the default direction, **dynamic breakpoints** extracted from Figma variables, and **always-on grid proportions**.

### New Features

#### Mobile-first CSS output (min-width) as default

CSS output now defaults to mobile-first direction using ascending `@media (min-width: ...)` queries. A toggle in Options allows switching to desktop-first (`max-width`). This applies to fluid clamp output, fixed per-breakpoint output, piecewise clamp segments, legacy fallbacks, and responsive alias media queries.

**Mobile-first example:**
```css
:root { --spacing-gap: 16px; }
@media (min-width: 840px) { :root { --spacing-gap: clamp(16px, ..., 24px); } }
@media (min-width: 1366px) { :root { --spacing-gap: clamp(24px, ..., 32px); } }
```

#### Dynamic breakpoints from Figma variables

Breakpoints are now auto-detected from the Dimension Foundations collection by scanning for a variable with "viewport" in its name. The detected values populate the editable breakpoint fields (Desktop, Laptop, Tablet, Mobile) with the source variable name shown. Falls back to hardcoded defaults if no viewport variable is found.

#### Grid proportions always-on

Proportion variables (those with "proportion" in their name) now always output as unitless column counts + `--fr` variants without requiring opt-in. This applies in both Fluid and Fixed output modes.

#### Per-file settings persistence

Settings can be saved to and loaded from the Figma file via `figma.root.setPluginData()`. Save/Reset buttons at the bottom of the Options panel. Settings travel with the `.fig` file.

### UI Restructure

#### 4-column resizable grid layout

The plugin window (now 900px default width) uses a CSS Grid layout with 4 panels separated by draggable resize handles:

1. **Collections** — List of Figma variable collections with selection checkboxes
2. **Options** — Output mode, direction, breakpoints, text styles, filename, save/reset
3. **Edge Cases** — Viewport-relative and non-linear scaling detection (visible in Fluid mode only)
4. **CSS Preview** — Generated CSS output with search, copy, and download

Columns are resizable via pointer-event drag handles. The edge cases column appears/hides dynamically based on output mode and detected candidates.

#### Edge case panel redesign

The edge case panel was redesigned to match the styling of the other three panels — same background, same uppercase section header (`EDGE CASES`), no nested card borders. The summary line ("1 viewport, 16 non-linear...") sits below the title. The internal height resize handle was removed since column width is now controlled by the grid drag handles.

#### Non-linear deviation overlay redesigned as slope chart

The hover overlay for non-linear candidates was redesigned from a confusing bar chart (Actual/Expected/Anchor) to an **SVG line chart** showing piecewise scaling slopes:

- 4 dots (Mobile → Tablet → Laptop → Desktop) connected by 3 colored purple line segments
- A dashed gray reference line showing what a single linear clamp would produce
- A table showing per-segment value deltas (From/To/Delta) instead of deviation percentages

#### CSS Preview search bar fix

The search input, results info, and prev/next navigation buttons are now grouped together as a single unit. Removed the `max-width` constraint and empty `min-width` reservation that were squeezing the search input.

### Bug Fixes

#### Script crash from missing HTML element

A missing `#detection-panel-resize` HTML element caused `addEventListener()` to be called on `null`, crashing the entire script at initialization. This prevented collections from loading, resize handles from working, and CSS from generating. Fixed by adding the element and wrapping JS references in null-guards.

#### Grid layout misalignment with display: none

`.edge-case-panel.hidden` used `display: none` which removed the element from grid flow, causing the 7-column grid template to misalign with 5 visible children. Changed to `visibility: hidden; overflow: hidden` — the element stays in the grid flow while the 0px track handles visual hiding.

#### Output mode switch didn't regenerate CSS

Switching between Fluid and Fixed mode only toggled UI state without regenerating the CSS preview. Added auto-regeneration at the end of `handleOutputModeChange()` when CSS has already been generated.

#### Missing stat element null references

Stat card elements (`#collection-count`, `#variable-count`) removed during restructure still referenced by JS. Added null-guards to prevent TypeError.

### Technical Changes

#### code.ts

**Added to ExportOptions:**
- `breakpointDirection` — `'mobile-first' | 'desktop-first'`
- Removed `proportionOverrides` — proportions are now always-on

**Added functions:**
- `extractBreakpointsFromVariables()` — Scans Dimension Foundations for viewport variables to extract breakpoint values

**Added message handlers:**
- `scan-breakpoints` — Triggers breakpoint detection and returns results to UI
- `save-settings` / `load-settings` / `clear-settings` — Per-file settings persistence via `figma.root.setPluginData()`

**Modified functions:**
- `generateFluidCSS()` — Direction-aware: mobile-first uses smallest mode as `:root` default with ascending `min-width` queries; desktop-first uses largest mode with descending `max-width` queries
- `generateSteppedCSS()` — Same direction-aware logic for fixed output mode; proportions now always output in fixed mode too
- `shouldUseProportion()` — Simplified to always return `true` when `getProportionColumnCount()` finds a match (no opt-in check)
- `generateCSSOutput()` — Header comment now includes direction info
- `figma.showUI()` — Width changed from 700px to 900px

#### ui.html

**Layout restructure:**
- Replaced 2-pane sidebar+preview with 7-column CSS Grid (4 panels + 3 resize handles)
- Grid template toggles between `.main` (without edge cases) and `.main.has-edge-cases` (with edge cases)
- Column widths stored in CSS custom properties (`--col-input`, `--col-options`, `--col-edge`, `--col-output`)

**Added CSS:**
- `.resize-handle` — 6px drag handles with pointer-event resize logic
- `.detection-panel-title` — Sidebar-section-style header for edge case panel
- `.preview-search-group` — Grouped search input + nav buttons
- `.deviation-overlay` — Redesigned with SVG line chart

**Added JS:**
- Column resize IIFE — `pointerdown`/`pointermove`/`pointerup` handlers on 3 resize handles
- `collectSettings()` / `applySettings()` / `applyDefaultSettings()` / `showSettingsStatus()` — Settings persistence UI
- Breakpoint direction radio toggle and breakpoint editor with detected source display
- `showDeviationOverlay()` rewritten to render SVG slope chart

**Removed:**
- Old bar chart overlay CSS (`.overlay-bar-group`, `.overlay-bar`, etc.)
- `.detection-panel-header` / `.detection-panel-footer` CSS (replaced with sidebar-section pattern)

---

## v1.8 — 2026-02-10

### Summary

UX/UI polish release addressing feedback on v1.7. Fixes a critical bug in text style export, improves the detection panel UX, and adds various quality-of-life improvements.

### Bug Fixes

#### Text style var() fallback removed for responsive variables

Text style export was outputting `var(--typo-type-size-fixed-3, 20px)` with static fallback values. For responsive variables that change per viewport via `clamp()` or `@media`, the fallback `20px` is incorrect. Now outputs `var(--typo-type-size-fixed-3)` without a fallback — if the variable is undefined, the browser's inherited/initial value is safer than a wrong static value.

#### Decimal precision capped at 2 decimal places

All CSS numeric output is now capped at 2 decimal places via `round(value, 2)`. Previously, values like `32.6446624375525px` could appear in the output. Now outputs `32.64px`.

#### Unitless keyword matching uses segment boundaries

The `isUnitless()` function previously used naive `indexOf` substring matching, causing false positives. For example, `border-width` was output as unitless (`1` instead of `1px`) because `border` contains the substring `order`. Now uses segment-boundary matching — keywords must appear as complete segments separated by hyphens, slashes, dots, spaces, or string edges. `order` matches `flex-order` but not `border-width`; `ratio` matches `aspect-ratio` but not `decoration`; `count` matches `column-count` but not `counter`.

### UX Improvements

#### Unified detection panel (merged 3 panels into 1)

The three separate edge-case detection panels (viewport-relative in orange, grid proportions in blue, non-linear scaling in purple) have been merged into a single **"Edge-Case Detection"** accordion panel with collapsible subsections. Each section retains its color accent. A badge shows total detected candidates, and a summary footer shows the current selection state.

The three separate "Apply & Regenerate" buttons are removed. Instead, the **Generate CSS** button itself now serves as the regenerate action — it always includes detection selections when generating. The footer summary prompts users to "click Generate CSS to apply."

#### Non-linear deviation mini-graph

Each non-linear candidate now shows a small bar chart illustrating how the Laptop and Tablet values deviate from the expected linear interpolation. Purple bars show actual values, gray dashed bars show expected linear positions.

#### CSS transitions for option toggles

Toggling options (output mode Fluid↔Fixed, text styles checkbox, legacy fallbacks) now uses smooth CSS transitions instead of abrupt `display:none` swaps. A `.option-collapsible` class with `max-height` + `opacity` transitions provides smooth expand/collapse animations.

#### Two-column options summary grid

The sidebar Options section now includes a compact two-column summary grid showing the current Output Mode (Fluid/Fixed) and Text Styles status (Off/SCSS/CSS Class/CSS Vars) at a glance.

#### Enhanced scrollbar visibility

Scrollbars are now wider (12px), with more prominent thumb styling and visible up/down stepper arrow buttons via `::-webkit-scrollbar-button`. The preview panel has a distinct scrollbar style for better visibility while reading CSS output.

#### Search Enter-to-jump improvement

Pressing Enter in the search field now immediately triggers the search if the debounce timer hasn't fired yet, then jumps to the next match. Shift+Enter goes to the previous match. Smooth scroll animation centers the current match in view.

### Technical Changes

#### code.ts
- `formatCSSValue()` — All FLOAT values now rounded to 2 decimal places via `round()`
- `formatRawTextProperty()` — fontSize, lineHeight, letterSpacing rounded to 2 decimals
- `resolveTextStyleProperty()` — Removed fallback value from `var()` output; now outputs `var(--name)` instead of `var(--name, fallback)`

#### ui.html
- Replaced 3 separate panel HTML/CSS/JS with unified `.detection-panel` with `.detection-section` accordion subsections
- Added `.option-collapsible` CSS class with `max-height`/`opacity` transitions
- Added `.options-grid` two-column CSS layout for sidebar summary
- Added `.deviation-graph` / `.deviation-bar` CSS for non-linear mini-graphs
- Enhanced `::-webkit-scrollbar` styles with stepper buttons
- `generateCSS()` now always passes `getOptions(true)` (includes overrides)
- Added `updateSummaryGrid()`, `updateDetectionSummary()`, `toggleDetectionSection()` JS functions
- Removed separate `regenerateWithViewportSelections()`, `regenerateWithProportionSelections()`, `regenerateWithNonLinearSelections()` functions

---

## v1.7 — 2026-02-10

### Summary

This release adds three major features: a **Fixed-value export mode** (no clamp interpolation), **Piecewise linear clamp** for non-linear scaling variables, and **Composite text style export** from Figma Text Styles.

### New Features

#### FEAT-02: Fixed-Value Export Mode

Radio toggle in the sidebar: **Fluid** (clamp — default) or **Fixed** (raw values per breakpoint).

- Fixed mode outputs Figma values as-is with `@media` queries at each breakpoint
- No `clamp()` interpolation — one-to-one mapping from Figma values to CSS
- Viewport-relative, proportion, and non-linear detection panels are hidden in Fixed mode
- Legacy fallback option is hidden in Fixed mode (not applicable)

#### FEAT-04: Composite Text Style Export

Checkbox "Include text styles in output" with a format dropdown:

- **SCSS Mixins** (default): `@mixin heading-h1 { font-family: var(...); font-size: var(...); ... }`
- **CSS Classes**: `.heading-h1 { font-family: var(...); ... }`
- **CSS Custom Properties**: `:root { --heading-h1-family: var(...); ... }`

Text style properties bound to Figma Variables are resolved to `var()` references (without fallback values — see v1.8 fix). Unbound properties get raw values. Font-weight is mapped from Figma font style names (Light → 300, Bold → 700, etc.).

#### FEAT-05: Piecewise Linear Clamp (Non-Linear Scaling)

Auto-detects variables where intermediate breakpoint values (Laptop, Tablet) deviate >5% from a straight line between Desktop and Mobile. Detected variables appear in a purple panel (collapsible), checked by default (opt-out pattern).

When enabled, outputs 3 piecewise `clamp()` segments instead of one:
- `:root` — Desktop→Laptop clamp
- `@media (max-width: 1679px)` — Laptop→Tablet clamp
- `@media (max-width: 1365px)` — Tablet→Mobile clamp

This accurately follows non-linear curves like t³ scaling that the designer set in Figma.

### Technical Changes

#### code.ts

**Added to ExportOptions:**
- `nonLinearOverrides` — Array of CSS names selected for piecewise clamp
- `includeTextStyles` — Boolean to include text styles
- `textStyleFormat` — Format choice: `scss-mixin`, `css-class`, `css-vars`
- `outputMode` changed from `'fluid' | 'stepped'` to `'fluid' | 'fixed'`

**Added interfaces:**
- `NonLinearCandidate` — Tracks deviation at Laptop/Tablet breakpoints

**Added functions:**
- `getNonLinearDeviation()` — Compares actual vs expected linear intermediate values
- `shouldUsePiecewiseClamp()` — Checks user selection for piecewise output
- `generatePiecewiseClampValue()` — Computes clamp() for one adjacent mode pair
- `handleScanTextStyles()` — Scans Figma text styles, sends count to UI
- `generateTextStyleCSS()` — Generates composite text style output
- `generateTextStyleName()` — Slugifies text style names
- `figmaStyleToWeight()` — Maps Figma font style names to CSS numeric weights
- `formatRawTextProperty()` — Extracts raw CSS value from text style property
- `resolveTextStyleProperty()` — Resolves to `var()` reference if variable-bound

**Modified functions:**
- `generateFluidCSS()` — Non-linear candidate detection + piecewise clamp routing
- `handleGenerateCSS()` — Text style section appended after variables
- `generateCSSOutput()` — Output mode added to header comment

#### ui.html

**Added UI:**
- Output Mode radio toggle (Fluid / Fixed) in Options section
- Text Styles section with checkbox + format radio dropdown
- Non-linear scaling detection panel (purple theme, collapsible)
- `@mixin` keyword added to syntax highlighting

**Added JS functions:**
- `handleOutputModeChange()` — Hides/shows relevant options per mode
- `updateOutputFormatInfo()` — Updates Output Format info text per mode
- `renderNonLinearCandidates()` — Renders purple detection panel
- `updateNonLinearSelection()`, `toggleAllNonLinearSelections()`, `regenerateWithNonLinearSelections()` — Panel interaction handlers

---

## v1.6 — 2026-02-10

### Summary

This release fixes unitless number export (font-weight, column-count, etc.), handles font-style string values correctly, and makes edge-case detection panels collapsible.

### Bug Fixes

#### BUG-01: Font weight values no longer exported with `px` suffix

Font-weight variables (and other unitless numeric properties) are now detected by naming convention and exported without units.

**Before:**
```css
--typo-type-weight-light: 300px;
--typo-type-weight-bold: 700px;
```

**After:**
```css
--typo-type-weight-light: 300;
--typo-type-weight-bold: 700;
```

#### BUG-02: Font-style string values exported unquoted

STRING variables containing CSS font-style keywords (`italic`, `oblique`, `normal`) are now output unquoted, producing valid CSS.

**Before:**
```css
--typo-type-weight-italic: "Italic";
```

**After:**
```css
--typo-type-weight-italic: italic;
```

#### BUG-03: Grid column count no longer exported with `px` suffix

Variables with "count" or "columns" in their name are now unitless.

**Before:**
```css
--dimension-grid-column-count: 12px;
```

**After:**
```css
--dimension-grid-column-count: 12;
```

### New Features

#### FEAT-01: Unitless number detection by naming convention

FLOAT variables are now checked against a list of CSS-unitless keywords: `weight`, `count`, `columns`, `rows`, `opacity`, `z-index`, `order`, `flex-grow`, `flex-shrink`, `ratio`. Detection applies to both the Figma variable name and the generated CSS name. Unitless variables also produce unitless `clamp()` output when values vary across breakpoints. Note: `line-height` is intentionally excluded — design system line-heights are typically pixel values (e.g., 38px from font-size × 1.5), and a unitless CSS line-height of 38 would mean 38× the font-size.

#### FEAT-03: Collapsible detection panels

The viewport-relative and proportion detection panels can now be collapsed by clicking their header. This keeps the CSS preview visible when the plugin window is small.

### Technical Changes

#### code.ts

**Added constants:**
- `UNITLESS_KEYWORDS` — Array of naming patterns that indicate unitless CSS values
- `FONT_STYLE_KEYWORDS` — Array of valid CSS font-style keywords

**Added functions:**
- `isUnitless()` — Checks variable name/cssName against unitless keywords
- `isFontStyleValue()` — Checks if a string value is a CSS font-style keyword

**Modified functions:**
- `formatCSSValue()` — Uses `isUnitless()` to omit `px` for unitless FLOAT values; uses `isFontStyleValue()` to output font-style strings unquoted
- `generateFluidValue()` — Respects unitless flag throughout clamp/min output

#### ui.html

**Added CSS:**
- `.collapsed` state for viewport and proportion panels (hides body, keeps header)
- `.panel-collapse-icon` with rotation transition

**Added HTML:**
- Collapse toggle icon (▼) in each panel header
- `onclick` handler on panel headers

**Added JS:**
- `togglePanelCollapse()` — Toggles `.collapsed` class on a panel

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
