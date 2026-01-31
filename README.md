# Variable to CSS

> Export Figma variables to CSS with fluid scaling and responsive media queries.

> **⚠️ Development Status**: This plugin is currently in development and not yet published to the Figma Community. Follow the installation instructions below to use it locally.

> **🔒 Privacy**: This plugin operates entirely locally. No data is sent to external servers (`networkAccess: { allowedDomains: ["none"] }`).

## Use Case

This plugin bridges the gap between Figma's variable system and production CSS. It's designed for design systems that use multi-layered token architectures where foundation values need to scale responsively across breakpoints.

**Primary workflow:**
1. Define your design tokens as Figma variables with breakpoint modes (Desktop, Laptop, Tablet, Mobile)
2. Run the plugin to generate production-ready CSS with `clamp()` for fluid scaling
3. Copy or download the CSS file for your codebase

**Best suited for:**
- Design systems with responsive spacing and typography scales
- Multi-layered token architectures (foundations -> aliases -> mappings)
- Teams that want CSS custom properties that automatically interpolate between breakpoints

## Token Architecture Compatibility

This plugin is optimized for a specific token structure. It works best with collections named using the pattern **"Domain - Layer"**:

| Collection Name Example | Detected Layer Type |
|------------------------|---------------------|
| `Typo - 1. Foundations` | Foundations (raw values, responsive modes) |
| `Space - 2. Aliases` | Aliases (semantic names, single mode) |
| `Dimension - 2.1 Aliases Extended` | Aliases Extended (component variations, responsive modes) |
| `Color - 4. Mappings` | Mappings (component-scoped tokens) |

**Breakpoint modes must be named:** Desktop, Laptop, Tablet, Mobile

**Theme modes must contain:** "Light" or "Dark" in the name

If your token structure differs, the plugin will still work but may not detect layers and modes optimally.

## Features

- **Dynamic Collection Discovery** - Automatically detects all variable collections without hardcoded names
- **Theme Support** - Handles light/dark modes with `@media (prefers-color-scheme)` and `[data-theme]` selectors
- **Fluid Scaling** - Generates CSS `clamp()` for smooth interpolation between breakpoints (Desktop 1680px -> Mobile 480px)
- **Stepped Fallback** - Media query-based fallback inside `@supports not` for older browsers that don't support clamp()
- **Multi-Mode Alias Support** - Aliases that change `var()` references per breakpoint get proper media queries (v1.3)
- **Preserved Alias Chains** - Outputs `var()` references to maintain design system hierarchy in CSS
- **Multiple Variable Types** - Supports COLOR, FLOAT, STRING, and BOOLEAN variables
- **Figma Dev Mode Compatibility** - CSS naming matches Figma's dev mode output, so generated CSS aligns with what developers see when inspecting components
- **Circular Reference Detection** - Skips self-referencing aliases to prevent infinite loops

## Installation

1. Clone or download this repository
2. In Figma Desktop: **Plugins -> Development -> Import plugin from manifest**
3. Select the `manifest.json` file from this folder

## Usage

1. Open a Figma file with variable collections
2. Run the plugin from **Plugins -> Development -> Variable to CSS**
3. Review detected collections in the sidebar
4. Click **"Generate CSS"** to preview the output
5. **Copy to clipboard** or **Download** the CSS file

The plugin auto-detects:
- **Breakpoint modes** - Generates responsive CSS with clamp() or media queries
- **Theme modes** - Generates prefers-color-scheme and data-attribute selectors
- **Single mode** - Simple `:root` output

## Screenshots

<!-- Add screenshots here -->

## Known Limitations

- CSS `clamp()` only supports linear interpolation; non-linear curves are approximated
- Remote/library variables are skipped (only local variables are processed)
- Boolean variables are output as 0/1
- Collection naming must follow expected patterns for optimal layer detection

## License

MIT

## Author

Created by [Márk Andrássy](https://github.com/amarkkk)

Part of a collection of Figma plugins for design token management.
