# Variable to CSS

A Figma plugin that exports all variable collections to CSS custom properties with clamp() fluid scaling, media queries, and preserved alias chains.

## Features

- **Dynamic Collection Discovery** — Automatically detects all variable collections without hardcoded names
- **Fluid Scaling** — Generates CSS `clamp()` for smooth interpolation between breakpoints
- **Stepped Fallback** — Media query-based fallback for older browsers
- **Alias Preservation** — Option to keep `var()` reference chains or resolve to final values
- **Theme Support** — Handles light/dark modes with `prefers-color-scheme` or `.dark` class
- **Multiple Variable Types** — Supports COLOR, FLOAT, STRING, and BOOLEAN variables

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to compile TypeScript
4. In Figma: Plugins → Development → Import plugin from manifest
5. Select the `manifest.json` file

## Usage

1. Open a Figma file with variable collections
2. Run the plugin from Plugins menu
3. Review detected collections and their mode types
4. Configure output options:
   - **Scaling Mode**: Fluid (clamp) or Stepped (media queries)
   - **Alias Handling**: Preserve var() references or resolve to values
   - **Dark Mode Output**: prefers-color-scheme, .dark class, or both
5. Click "Generate CSS" to preview
6. Copy to clipboard or download the CSS file

## Output Options

### Scaling Mode

**Fluid (clamp)** — Best for modern browsers
```css
:root {
  --space-vertical-rhythm-1: clamp(25.6px, calc(10.48px + 0.9697vw), 32px);
}
```

**Stepped (media queries)** — Maximum compatibility
```css
:root { --space-vertical-rhythm-1: 32px; }
@media (max-width: 1365px) { :root { --space-vertical-rhythm-1: 30.48px; } }
@media (max-width: 839px) { :root { --space-vertical-rhythm-1: 27.93px; } }
@media (max-width: 479px) { :root { --space-vertical-rhythm-1: 25.6px; } }
```

### Alias Handling

**Preserved References** — Maintains design system structure
```css
--button-padding-x: var(--space-micro-5);
--space-micro-5: var(--space-fixed-5);
--space-fixed-5: 16px;
```

**Resolved Values** — Flat output for simpler debugging
```css
--button-padding-x: 16px;
```

## Variable Architecture Support

The plugin understands multi-layer token architectures:

```
Foundations (Layer 1) — Raw values with responsive modes
       ↓
Aliases (Layer 2) — Semantic names, single mode
       ↓
Aliases Extended (Layer 2.1) — Component variations, responsive modes
       ↓
Mappings (Layer 3) — Component-scoped tokens, single mode
```

## Mode Detection

The plugin automatically detects mode types:

- **Breakpoint modes**: Desktop, Laptop, Tablet, Mobile → generates responsive CSS
- **Theme modes**: Light, Dark → generates `prefers-color-scheme` or class-based CSS
- **Single mode**: Simple `:root` output

## CSS Naming Convention

Figma variable names are transformed to CSS custom properties:

| Figma Name | CSS Name |
|------------|----------|
| `fixed/1` (in Space collection) | `--space-fixed-1` |
| `space/micro/5` | `--space-micro-5` |
| `button/padding-x` (in Mappings) | `--button-padding-x` |
| `brand/500` (in Color collection) | `--color-brand-500` |

Rules:
- Foundation variables get collection domain prefix
- Mapping variables keep their semantic names (no domain prefix)
- `/` → `-`, `--` → `-`, `.` → `-`
- All lowercase

## Breakpoint Configuration

Default breakpoints (detected from mode names):

| Mode | Viewport |
|------|----------|
| Desktop | 1680px |
| Laptop | 1366px |
| Tablet | 840px |
| Mobile | 480px |

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript (one-time)
npm run build

# Watch mode for development
npm run watch
```

## File Structure

```
figma-variable-to-css/
├── manifest.json      # Figma plugin manifest
├── code.ts           # Plugin backend (TypeScript)
├── code.js           # Compiled output (generated)
├── ui.html           # Plugin UI (HTML/CSS/JS)
├── package.json      # Dependencies
└── tsconfig.json     # TypeScript configuration
```

## Known Limitations

- CSS `clamp()` only supports linear interpolation; non-linear curves (like t³) are approximated
- Remote/library variables are skipped
- Boolean variables are output as 0/1

## Roadmap

- [ ] Piecewise clamp for better curve approximation
- [ ] REM/EM unit conversion
- [ ] SCSS partials output
- [ ] JSON export for build pipelines
- [ ] Collection filtering in UI

## License

MIT

## Author

Márk Andrássy — [amark.design](https://amark.design)
