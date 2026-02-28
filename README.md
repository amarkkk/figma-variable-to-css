# Variable to CSS

> Export Figma variables to CSS with fluid scaling and responsive media queries.

![Status: Stable](https://img.shields.io/badge/status-stable-green)

**Privacy:** This plugin runs entirely locally. No data is sent to external servers (`networkAccess: { allowedDomains: ["none"] }`).

## Features

- **Dynamic Collection Discovery** - Automatically detects all variable collections without hardcoded names
- **Theme Support** - Handles light/dark modes with `@media (prefers-color-scheme)` and `[data-theme]` selectors
- **Fluid Scaling** - Generates CSS `clamp()` for smooth interpolation between breakpoints (Desktop 1680px → Mobile 480px)
- **Mobile-First & Desktop-First** - Toggle between `min-width` (ascending) and `max-width` (descending) media queries
- **Dynamic Breakpoints** - Auto-detects breakpoint values from Figma variables; falls back to sensible defaults
- **Viewport-Relative Variables** - Variables with "viewport" in name/description use `min(100vw, max)` instead of `clamp()`
- **Grid Proportion Variables** - Proportion tokens (half, third, quarter) output as flex/grid-ready values (unitless + `fr` variant)
- **Piecewise Scaling** - Variables with non-linear scaling across breakpoints get per-segment `clamp()` instead of a single linear interpolation
- **Edge Cases Panel** - Dedicated column for managing viewport-relative, piecewise scaling, and grid proportion variables
- **Multi-Mode Alias Support** - Aliases that change `var()` references per breakpoint get proper media queries
- **Preserved Alias Chains** - Outputs `var()` references to maintain design system hierarchy in CSS
- **Optional Legacy Fallbacks** - `@supports not` fallback blocks for older browsers (off by default)
- **CSS Preview Search** - Search and navigate through generated CSS directly in the plugin
- **Fixed-Value Export Mode** - Raw values per breakpoint without `clamp()` interpolation
- **Composite Text Style Export** - Export Figma Text Styles as SCSS mixins, CSS classes, or CSS custom properties
- **Per-File Settings** - Save/load plugin settings per Figma file via `figma.root.setPluginData()`
- **Multiple Variable Types** - Supports COLOR, FLOAT, STRING, and BOOLEAN variables
- **Unitless Number Detection** - Automatically detects font-weight, column-count, opacity, etc. by naming convention
- **Figma Dev Mode Compatibility** - CSS naming matches Figma's dev mode output
- **Circular Reference Detection** - Skips self-referencing aliases to prevent infinite loops

> See [Design_Token_System_Summary.md](./Design_Token_System_Summary.md) for the underlying design token conventions and formulas.

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. In Figma Desktop: **Plugins → Development → Import plugin from manifest**
5. Select the `manifest.json` file from this folder

## Usage

1. Open a Figma file with variable collections
2. Run the plugin from **Plugins → Development → Variable to CSS**
3. Review detected collections in the sidebar
4. Configure options: output mode (Fluid/Fixed), direction (Mobile-first/Desktop-first), text styles
5. Click **"Generate CSS"** to preview the output
6. Review edge cases if detected (viewport-relative, piecewise, proportions)
7. **Copy to clipboard** or **Download** the CSS file

The plugin auto-detects:
- **Breakpoint modes** - Generates responsive CSS with clamp() or media queries
- **Theme modes** - Generates prefers-color-scheme and data-attribute selectors
- **Single mode** - Simple `:root` output

### Token Architecture

This plugin works best with collections named using the pattern **"Domain - Layer"**:

| Collection Name Example | Detected Layer Type |
|------------------------|---------------------|
| `Typo - 1. Foundations` | Foundations (raw values, responsive modes) |
| `Space - 2. Aliases` | Aliases (semantic names, single mode) |
| `Dimension - 2.1 Aliases Extended` | Aliases Extended (component variations, responsive modes) |
| `Color - 4. Mappings` | Mappings (component-scoped tokens) |

**Breakpoint modes must be named:** Desktop, Laptop, Tablet, Mobile

**Theme modes must contain:** "Light" or "Dark" in the name

## Screenshots

<!-- Screenshots will be added in Chapter 11 -->

## Known Limitations

- CSS `clamp()` only supports linear interpolation; non-linear curves are approximated with piecewise segments
- Remote/library variables are skipped (only local variables are processed)
- Boolean variables are output as 0/1
- Collection naming must follow expected patterns for optimal layer detection

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and release notes.

## License

[MIT](./LICENSE)

## Author

Created by [Mark Andrassy](https://github.com/amarkkk)

---

**Part of the [Figma Variable Tools](https://github.com/amarkkk) suite:**

| Plugin | Description |
|--------|-------------|
| **Variable to CSS** | Export variables to fluid CSS with clamp() scaling |
| [Variable Mover](https://github.com/amarkkk/figma-variable-mover) | Move variables between collections preserving aliases |
| [Variable Remapper](https://github.com/amarkkk/figma-variable-remapper) | Bulk find-and-replace variable bindings |
| [Variable Import/Export](https://github.com/amarkkk/figma-variable-import-export) | CSV/JSON export for spreadsheet editing + re-import |
| [Variable Descriptions](https://github.com/amarkkk/figma-variable-descriptions) | Bulk clear/update variable descriptions |
| [Variable Network](https://github.com/amarkkk/figma-variable-network) | Visualize token alias chains and component usage |
