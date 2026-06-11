# Variable to CSS — Chapter 5b Refinement Plan

## Overview
Comprehensive UI/UX refinements based on user testing feedback. Covers information architecture redesign, visual consistency, bug fixes, and feature additions. All changes to `ui.html` (frontend) and `code.ts` (backend).

### User Decisions (confirmed)
- Panel 1 style tooltips: **Counts only** (e.g. "25 text styles")
- Color/effect style export format: **Same format options as text styles** (SCSS mixin / CSS class / CSS vars)
- Settings change indicator: **Subtle golden border glow** on Save button when settings differ from last save
- Detection section accents: **Remove ALL section colors** — differentiated only by icon and title text

---

## Step 1. Remove Options Summary Grid + Visual Hierarchy for Labels

**Problem:** The `.options-grid` (Output/Direction summary) duplicates the radio buttons below it. H2 section headers and sub-labels share identical styling.

**Changes in `ui.html`:**
- Delete `.options-grid` HTML block (Output + Direction summary columns)
- Delete `.options-grid` CSS rules (`.options-grid`, `.option-col`, `.option-col-label`, `.option-col-value`)
- Delete `updateSummaryGrid()` function and all call sites (in `handleOutputModeChange`, text style handler, direction handler, `applySettings`, `applyDefaultSettings`)
- **Visual hierarchy:** `.section-label` gets `font-size: 9px; color: var(--text-tertiary)` (smaller and dimmer than H2 section headers which are 10px `--text-secondary`)

---

## Step 2. Fix Text Styles Radio Buttons Not Showing in Figma

**Problem:** Format radios (SCSS/CSS/vars) don't expand when checkbox is checked inside Figma, but work standalone.

**Root cause:** The `.option-collapsible` relies on `max-height` CSS transition. In Figma's iframe context, transitions on `max-height` can fail silently when the element hasn't been laid out. The `collapsed` class sets `max-height: 0; opacity: 0` which may not animate back properly.

**Fix in `ui.html`:**
- Change the collapse mechanism: instead of pure CSS `max-height` transition, use explicit `display: none` / `display: block` toggled via JS, with a `requestAnimationFrame` wrapper for the opacity fade
- Add null guards on `textStyleOptionsEl` before toggling
- Test: the checkbox handler should work identically in standalone HTML and Figma iframe

---

## Step 3. Expand Styles Support: Color Styles + Effect Styles

**Changes in `code.ts`:**
- Add `handleScanPaintStyles()` → `figma.getLocalPaintStylesAsync()` → posts `paintstyles-scanned` with count and basic info
- Add `handleScanEffectStyles()` → `figma.getLocalEffectStylesAsync()` → posts `effectstyles-scanned` with count and basic info
- Add `scan-paintstyles` and `scan-effectstyles` message handlers in the main `onmessage` switch
- Add `generatePaintStyleCSS()`: iterates paint styles, outputs CSS properties (`background`, `color`) per format (SCSS mixin / CSS class / CSS vars) — handles solid fills, linear/radial gradients
- Add `generateEffectStyleCSS()`: iterates effect styles, outputs CSS properties (`box-shadow`, `filter: drop-shadow/blur`) per format — handles inner/outer shadows, blur, background blur
- Wire both into the `generate-css` flow: append after text styles section if respective options are enabled
- Add `includePaintStyles` and `includeEffectStyles` to the options interface
- Add `paintStyleFormat` and `effectStyleFormat` to the options interface (same enum as text styles)

**Changes in `ui.html`:**
- Add `scan-paintstyles` and `scan-effectstyles` messages on initialization
- Add message handlers for `paintstyles-scanned` and `effectstyles-scanned` → update Panel 1 counts
- Add checkboxes + format radios in options panel (collapsible, same pattern as text styles)

---

## Step 4. Redesign Panel 1: Ingredients Panel

**Problem:** Shows only collections (17 items + meta = scrolling). User wants styles too as trust indicators. Variable/mode counts per collection are excessive detail.

**Changes in `ui.html`:**
- **Section header:** "Collections" stays for the variable collections group
- **Compact collection items:** Remove `.collection-meta` line. Show only collection name. Add a small Phosphor Info icon (14×14) that shows "42 variables · 3 modes" in a tooltip on hover
- **Add "Styles" section** below collections:
  - Section header: "STYLES"
  - Compact rows: icon + name + count badge (outlined). E.g.: `🔤 Text Styles [25]`, `🎨 Color Styles [10]`, `✨ Effect Styles [3]`
  - Use Phosphor Light icons: TextAa for text, Palette for color, Sparkle for effect
  - Only show style types with count > 0
  - Each count is a small outlined badge (same style as detection badges)
- **Reduce spacing:** `.collection-item` padding from `10px 12px` → `6px 10px`, margin-bottom from `6px` → `4px`

---

## Step 5. Redesign Panel 2: Flatten Options + Summary at Bottom

**Problem:** Options split across multiple sections with dividers. Output Format info cards are verbose. User wants flat options flow with summary at bottom.

**Changes in `ui.html` (HTML restructure):**
- **Remove all `.sidebar-divider` elements** between options sections
- **Remove `.output-info` section** entirely (the emoji info cards explaining fluid/fixed)
- **Single scrollable options section** with continuous flow:
  1. H2: "OPTIONS"
  2. Output Mode radios (Fluid / Fixed)
  3. Breakpoint Direction radios (Mobile-first / Desktop-first)
  4. Legacy fallbacks checkbox (collapsible, fluid-only)
  5. Breakpoints inputs (Desktop / Laptop / Tablet / Mobile) — remove the H2, just use a `.section-label` "Breakpoints"
  6. Text Styles checkbox + format radios (collapsible)
  7. Color Styles checkbox + format radios (collapsible) — new
  8. Effect Styles checkbox + format radios (collapsible) — new
  9. Download Filename radios (Auto / Custom)
  10. Settings actions: Save + Reset buttons
- **Settings change indicator:**
  - Track `lastSavedSettings` object (snapshot of all option values when saved)
  - On any option change, compare current vs saved → if different, add golden border glow to Save button: `border-color: var(--accent-primary); box-shadow: 0 0 0 1px var(--accent-primary)`
  - When settings match saved state, remove the glow
- **Output Summary** at bottom of panel (below settings actions):
  - Dynamic text: e.g. "Fluid · Mobile-first · clamp() · 2 text styles (SCSS)"
  - Updates on any option change
  - Compact, uses `var(--text-tertiary)`, `font-size: 10px`

---

## Step 6. Unify Edge Case Panel Visual Style

**Problem:** Detection sections are too colorful. Emoji icons don't match Phosphor system.

**Changes in `ui.html`:**
- **Remove ALL section-specific title colors**: delete the CSS rules that set `.detection-section-title` color per `[data-type]`. All titles use default `var(--text-primary)`.
- **Remove ALL detection accent checkbox colors**: all checkboxes use `accent-color: var(--accent-primary)` (brand gold) instead of purple/orange per-section
- **Replace emoji icons** with inline Phosphor Light SVGs (16×16, `fill="currentColor"`):
  - Proportions `▦` → GridFour Light
  - Viewport `🖥️` → Monitor Light
  - Piecewise `📈` → ChartLineUp Light
- **Remove the `--detection-nonlinear` and `--detection-proportions` tokens** from `:root` — no longer needed since all sections are neutral
- **Chart/overlay colors:** Use `var(--accent-primary)` (brand gold) for piecewise segment lines and data points in the deviation overlay chart, replacing the purple token
- **Nested accordion L1/L2/L3:** Verify spacing matches DECISIONS.md Section 9.2

---

## Step 7. Replace Mini Bar Charts with Icon

**Problem:** Bar charts are misleading (show differences not values), hard to hover when small, unreliable hover trigger.

**Changes in `ui.html`:**
- **Delete** `.value-bar-chart`, `.vbar`, `.deviation-graph`, `.deviation-bar` CSS
- **Delete** mini bar chart / deviation graph rendering in JS (`renderNonLinearCandidates` and similar)
- **Replace with** a 16×16 Phosphor ChartLineUp Light icon wrapped in a hover-trigger `<span>` with `class="deviation-trigger"`:
  - CSS: `.deviation-trigger { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: var(--radius-md); color: var(--text-tertiary); cursor: pointer; flex-shrink: 0; margin-left: auto; }`
  - Hover: `.deviation-trigger:hover { background: var(--bg-hover); color: var(--text-secondary); }`
- **Wire hover events** to the existing `showDeviationOverlay()` / `hideDeviationOverlay()` — same logic, just triggered from the icon instead of the bar chart
- Overlay positioning logic stays intact

---

## Step 8. Update Select All / Deselect All Buttons

**Changes in `ui.html`:**
- `.detection-section-toggle`: add `font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.48px` to match section label style
- Ensure consistent sizing and hover state with design system

---

## Step 9. Simplify Preview Stats

**Changes in `ui.html`:**
- In `renderPreview()`: `previewStatsEl.textContent = (css.length / 1024).toFixed(1) + ' KB'`
- In the dynamic stats update after detection: same — only file size
- `footerStatsEl` stays separate with its own content

---

## Step 10. Fix Search Highlight — Two Distinct Levels

**Changes in `ui.html`:**
- **Non-focused matches** (`.search-highlight`):
  - Light: `background: var(--warning-bg); color: inherit; padding: 1px 3px; border-radius: var(--radius-sm)`
  - Dark: `background: var(--warning-bg); color: inherit` (same — tokens handle theming)
- **Focused/current match** (`.search-highlight-current`):
  - Light: `background: rgba(190, 131, 70, 0.6); color: var(--text-primary)`
  - Dark: `background: rgba(222, 185, 150, 0.6); color: var(--text-primary)`
- **`mark.search-highlight` canonical:** Update to use `var(--warning-bg)` for the general pattern, keep golden for current
- This creates clear visual distinction: mild yellow for all matches, strong gold for focused match

---

## Step 11. Footer: Refresh + Reset Size + Tooltip Manager + Toast Position

**Changes in `ui.html` (HTML):**
- Footer-left: Theme toggle → Refresh button (ArrowsClockwise) → Reset size button (ArrowsIn)
- Each button: `.icon-button` with `.btn-tooltip` and `aria-label`

**Changes in `ui.html` (CSS):**
- Add tooltip directional modifiers: `.btn-tooltip.tooltip-bottom { bottom: auto; top: calc(100% + 6px); }`
- Add `.btn-tooltip.tooltip-left` and `.btn-tooltip.tooltip-right` for edge cases
- Toast `bottom: 80px` → `bottom: 34px`

**Changes in `ui.html` (JS):**
- **TooltipManager:** On `mouseenter` for `.icon-button`, check `getBoundingClientRect()` vs viewport:
  - If near bottom (footer), add `tooltip-bottom`
  - If near left edge, add `tooltip-right` (shift right)
  - If near right edge, add `tooltip-left` (shift left)
  - On `mouseleave`, remove all modifiers
- **Refresh handler:** Re-sends `scan-collections`, `scan-textstyles`, `scan-paintstyles`, `scan-effectstyles`, `scan-breakpoints` → shows toast "Variables refreshed"
- **Reset size handler:** Sends resize to 900×600 default → shows toast "Window size reset"

---

## Step 12. Documentation Updates

After all changes:
- `output/DECISIONS.md`: Add notes for two-level search highlight, `.section-label` vs H2 hierarchy, ingredients panel, settings glow indicator, removal of detection section colors, mini chart → icon replacement
- `_figma-suite-overhaul/05-plugin-variable-to-css.md`: Document new features (paint/effect styles, redesigned panels)
- `MEMORY.md`: Update with new patterns

---

## Execution Order

1. **Steps 1 + 5:** Remove options grid, flatten options panel (linked — biggest HTML restructure)
2. **Step 2:** Fix text styles checkbox bug
3. **Step 10:** Fix search highlights (CSS-only change)
4. **Steps 6 + 7 + 8:** Unify edge case panel (linked visual changes)
5. **Step 9:** Simplify preview stats
6. **Step 11:** Footer buttons + tooltip manager + toast position
7. **Steps 3 + 4:** Color/effect styles support (backend + frontend — largest feature addition)
8. **Step 12:** Documentation updates
9. **`npm run build`** after each major step
