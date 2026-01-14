// Variable to CSS v1.0
// Figma Plugin for exporting variable collections to CSS custom properties

// ============================================
// TYPES
// ============================================

interface CollectionInfo {
  id: string;
  name: string;
  domain: string;
  layer: string;
  modes: ModeInfo[];
  modeType: 'breakpoint' | 'theme' | 'single';
  variableCount: number;
}

interface ModeInfo {
  modeId: string;
  name: string;
  breakpointPx?: number;
}

interface VariableInfo {
  id: string;
  name: string;
  collectionId: string;
  collectionName: string;
  domain: string;
  resolvedType: VariableResolvedDataType;
  valuesByMode: Record<string, ProcessedValue>;
  isAlias: boolean;
  aliasTarget?: string;
  cssName: string;
}

interface ProcessedValue {
  raw: any;
  isAlias: boolean;
  aliasId?: string;
  aliasName?: string;
  resolved: string | number | null;
}

interface ExportOptions {
  outputMode: 'fluid' | 'stepped';
  aliasMode: 'preserved' | 'resolved';
  darkModeOutput: 'prefers-color-scheme' | 'class' | 'both';
  includeTimestamp: boolean;
  includeIds: boolean;
  colorFormat: 'hex' | 'oklch';
}

interface CSSOutput {
  css: string;
  stats: {
    collections: number;
    variables: number;
    errors: string[];
  };
}

// Known breakpoint mode names and their viewport widths
const BREAKPOINT_MODES: Record<string, number> = {
  'desktop': 1680,
  'laptop': 1366,
  'tablet': 840,
  'mobile': 480
};

const THEME_MODES = ['light', 'dark'];

// ============================================
// INITIALIZATION
// ============================================

figma.showUI(__html__, { width: 700, height: 600, themeColors: true });

// Restore window size
figma.clientStorage.getAsync('windowSize').then(size => {
  if (size) figma.ui.resize(size.w, size.h);
}).catch(() => {});

// ============================================
// MESSAGE HANDLERS
// ============================================

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'resize') {
      const w = Math.max(500, Math.min(1400, msg.size.w));
      const h = Math.max(400, Math.min(1000, msg.size.h));
      figma.ui.resize(w, h);
      figma.clientStorage.setAsync('windowSize', { w, h });
      return;
    }
    
    if (msg.type === 'scan-collections') {
      await handleScanCollections();
    } else if (msg.type === 'generate-css') {
      await handleGenerateCSS(msg.options as ExportOptions);
    } else if (msg.type === 'cancel') {
      figma.closePlugin();
    }
  } catch (error: any) {
    figma.ui.postMessage({ type: 'error', message: error.message });
  }
};

// ============================================
// COLLECTION SCANNING
// ============================================

async function handleScanCollections() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionInfos: CollectionInfo[] = [];
  
  for (const collection of collections) {
    if (collection.remote) continue;
    
    const { domain, layer } = parseCollectionName(collection.name);
    const modes = collection.modes.map(m => ({
      modeId: m.modeId,
      name: m.name,
      breakpointPx: detectBreakpoint(m.name)
    }));
    
    const modeType = detectModeType(modes);
    
    collectionInfos.push({
      id: collection.id,
      name: collection.name,
      domain,
      layer,
      modes,
      modeType,
      variableCount: collection.variableIds.length
    });
  }
  
  // Sort by domain and layer
  collectionInfos.sort((a, b) => {
    if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
    return a.layer.localeCompare(b.layer);
  });
  
  const totalVariables = collectionInfos.reduce((sum, c) => sum + c.variableCount, 0);
  
  figma.ui.postMessage({
    type: 'collections-scanned',
    collections: collectionInfos,
    totalVariables
  });
}

function parseCollectionName(name: string): { domain: string; layer: string } {
  // Pattern: "Domain - Layer. Type" or "Domain - Layer Type"
  // Examples: "Typo - 1. Foundations", "Space - 2.1 Aliases Extended"
  const match = name.match(/^([A-Za-z]+)\s*-\s*(.+)$/);
  if (match) {
    return {
      domain: match[1].toLowerCase(),
      layer: match[2].trim()
    };
  }
  return { domain: name.toLowerCase(), layer: 'default' };
}

function detectBreakpoint(modeName: string): number | undefined {
  const lower = modeName.toLowerCase();
  for (const [name, px] of Object.entries(BREAKPOINT_MODES)) {
    if (lower.includes(name)) return px;
  }
  return undefined;
}

function detectModeType(modes: ModeInfo[]): 'breakpoint' | 'theme' | 'single' {
  if (modes.length === 1) return 'single';
  
  // Check if all modes have breakpoints
  const hasBreakpoints = modes.every(m => m.breakpointPx !== undefined);
  if (hasBreakpoints) return 'breakpoint';
  
  // Check if modes are light/dark
  const modeNames = modes.map(m => m.name.toLowerCase());
  const isTheme = modeNames.some(n => THEME_MODES.includes(n));
  if (isTheme) return 'theme';
  
  return 'single';
}

// ============================================
// CSS GENERATION
// ============================================

async function handleGenerateCSS(options: ExportOptions) {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const allVariables: VariableInfo[] = [];
  const variableMap = new Map<string, VariableInfo>();
  const errors: string[] = [];
  
  // First pass: collect all variables
  for (const collection of collections) {
    if (collection.remote) continue;
    
    const { domain } = parseCollectionName(collection.name);
    
    for (const varId of collection.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (!variable) continue;
      
      const cssName = generateCSSName(variable.name, domain, collection.name);
      const valuesByMode: Record<string, ProcessedValue> = {};
      
      for (const mode of collection.modes) {
        const rawValue = variable.valuesByMode[mode.modeId];
        valuesByMode[mode.modeId] = await processValue(rawValue, variable.resolvedType, options);
      }
      
      const varInfo: VariableInfo = {
        id: variable.id,
        name: variable.name,
        collectionId: collection.id,
        collectionName: collection.name,
        domain,
        resolvedType: variable.resolvedType,
        valuesByMode,
        isAlias: Object.values(valuesByMode).some(v => v.isAlias),
        cssName
      };
      
      allVariables.push(varInfo);
      variableMap.set(variable.id, varInfo);
    }
  }
  
  // Second pass: resolve alias names
  for (const varInfo of allVariables) {
    for (const [modeId, value] of Object.entries(varInfo.valuesByMode)) {
      if (value.isAlias && value.aliasId) {
        const target = variableMap.get(value.aliasId);
        if (target) {
          value.aliasName = target.cssName;
        } else {
          errors.push(`Broken alias: ${varInfo.name} references unknown variable`);
        }
      }
    }
  }
  
  // Group by collection for ordered output
  const collectionGroups = groupByCollection(allVariables, collections);
  
  // Generate CSS
  const css = generateCSSOutput(collectionGroups, collections, options);
  
  figma.ui.postMessage({
    type: 'css-generated',
    output: {
      css,
      stats: {
        collections: collections.filter(c => !c.remote).length,
        variables: allVariables.length,
        errors
      }
    }
  });
}

function generateCSSName(varName: string, domain: string, collectionName: string): string {
  // Transform Figma variable name to CSS custom property name
  // Examples:
  //   fixed/1 → --space-fixed-1
  //   space/micro/1 → --space-micro-1
  //   button/padding-x → --button-padding-x (mappings don't get domain prefix)
  
  const isMappings = collectionName.toLowerCase().includes('mapping');
  
  let cssName = varName
    .toLowerCase()
    .replace(/\//g, '-')           // Replace / with -
    .replace(/--/g, '-')           // Replace -- (Figma variant) with -
    .replace(/\./g, '-')           // Replace . with -
    .replace(/,/g, '-')            // Replace , with -
    .replace(/[^a-z0-9-]/g, '-')   // Replace other special chars
    .replace(/-+/g, '-')           // Collapse multiple dashes
    .replace(/^-|-$/g, '');        // Trim leading/trailing dashes
  
  // Add domain prefix if needed
  if (!isMappings && !cssName.startsWith(domain)) {
    cssName = `${domain}-${cssName}`;
  }
  
  return `--${cssName}`;
}

async function processValue(
  rawValue: any,
  type: VariableResolvedDataType,
  options: ExportOptions
): Promise<ProcessedValue> {
  // Check if it's an alias
  if (rawValue && typeof rawValue === 'object' && 'type' in rawValue && rawValue.type === 'VARIABLE_ALIAS') {
    return {
      raw: rawValue,
      isAlias: true,
      aliasId: rawValue.id,
      resolved: null
    };
  }
  
  // Process based on type
  let resolved: string | number | null = null;
  
  switch (type) {
    case 'COLOR':
      if (rawValue && typeof rawValue === 'object' && 'r' in rawValue) {
        resolved = options.colorFormat === 'oklch' 
          ? rgbToOklch(rawValue) 
          : rgbToHex(rawValue);
      }
      break;
    case 'FLOAT':
      if (typeof rawValue === 'number') {
        resolved = rawValue;
      }
      break;
    case 'STRING':
      if (typeof rawValue === 'string') {
        resolved = rawValue;
      }
      break;
    case 'BOOLEAN':
      resolved = rawValue ? 1 : 0;
      break;
  }
  
  return {
    raw: rawValue,
    isAlias: false,
    resolved
  };
}

function rgbToHex(color: { r: number; g: number; b: number; a?: number }): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  const hex = '#' + toHex(color.r) + toHex(color.g) + toHex(color.b);
  if (color.a !== undefined && color.a < 1) {
    return hex + toHex(color.a);
  }
  return hex;
}

function rgbToOklch(color: { r: number; g: number; b: number; a?: number }): string {
  // Simplified RGB to OKLCH conversion
  // For production, use a proper color library
  const r = color.r, g = color.g, b = color.b;
  
  // Convert to linear RGB
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  
  // RGB to XYZ
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  const z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;
  
  // XYZ to Lab (simplified)
  const l = Math.cbrt(y);
  const c = Math.sqrt(x * x + z * z) * 0.4;
  const h = Math.atan2(z, x) * 180 / Math.PI;
  
  const L = Math.round(l * 100) / 100;
  const C = Math.round(c * 1000) / 1000;
  const H = Math.round((h + 360) % 360);
  
  if (color.a !== undefined && color.a < 1) {
    return `oklch(${L} ${C} ${H} / ${Math.round(color.a * 100)}%)`;
  }
  return `oklch(${L} ${C} ${H})`;
}

function groupByCollection(
  variables: VariableInfo[],
  collections: VariableCollection[]
): Map<string, VariableInfo[]> {
  const groups = new Map<string, VariableInfo[]>();
  
  for (const v of variables) {
    const existing = groups.get(v.collectionId) || [];
    existing.push(v);
    groups.set(v.collectionId, existing);
  }
  
  return groups;
}

function generateCSSOutput(
  collectionGroups: Map<string, VariableInfo[]>,
  collections: VariableCollection[],
  options: ExportOptions
): string {
  const lines: string[] = [];
  const timestamp = new Date().toISOString();
  
  // Header
  lines.push('/* ==========================================================================');
  lines.push('   DESIGN TOKENS — Generated from Figma Variables');
  if (options.includeTimestamp) {
    lines.push(`   Date: ${timestamp}`);
  }
  lines.push('   ========================================================================== */');
  lines.push('');
  
  // Sort collections: Foundations first, then Aliases, then Mappings
  const sortedCollections = [...collections]
    .filter(c => !c.remote && collectionGroups.has(c.id))
    .sort((a, b) => {
      const layerOrder = (name: string): number => {
        const lower = name.toLowerCase();
        if (lower.includes('foundation')) return 0;
        if (lower.includes('alias') && !lower.includes('extended')) return 1;
        if (lower.includes('extended')) return 2;
        if (lower.includes('mapping')) return 3;
        return 4;
      };
      const { domain: domA } = parseCollectionName(a.name);
      const { domain: domB } = parseCollectionName(b.name);
      if (domA !== domB) return domA.localeCompare(domB);
      return layerOrder(a.name) - layerOrder(b.name);
    });
  
  for (const collection of sortedCollections) {
    const variables = collectionGroups.get(collection.id);
    if (!variables || variables.length === 0) continue;
    
    const { domain } = parseCollectionName(collection.name);
    const modeType = detectModeType(collection.modes.map(m => ({
      modeId: m.modeId,
      name: m.name,
      breakpointPx: detectBreakpoint(m.name)
    })));
    
    // Section header
    lines.push(`/* --------------------------------------------------------------------------`);
    lines.push(`   ${collection.name.toUpperCase()}`);
    lines.push(`   -------------------------------------------------------------------------- */`);
    lines.push('');
    
    if (modeType === 'breakpoint') {
      lines.push(...generateBreakpointCSS(collection, variables, options));
    } else if (modeType === 'theme') {
      lines.push(...generateThemeCSS(collection, variables, options));
    } else {
      lines.push(...generateSingleModeCSS(collection, variables, options));
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

function generateBreakpointCSS(
  collection: VariableCollection,
  variables: VariableInfo[],
  options: ExportOptions
): string[] {
  const lines: string[] = [];
  
  // Get modes sorted by breakpoint (largest first)
  const sortedModes = [...collection.modes]
    .map(m => ({
      ...m,
      breakpointPx: detectBreakpoint(m.name) || 0
    }))
    .sort((a, b) => b.breakpointPx - a.breakpointPx);
  
  if (options.outputMode === 'fluid' && sortedModes.length >= 2) {
    // Generate piecewise clamp CSS
    lines.push(...generateFluidCSS(sortedModes, variables, options));
  } else {
    // Generate stepped media query CSS
    lines.push(...generateSteppedCSS(sortedModes, variables, options));
  }
  
  return lines;
}

function generateFluidCSS(
  modes: Array<{ modeId: string; name: string; breakpointPx: number }>,
  variables: VariableInfo[],
  options: ExportOptions
): string[] {
  const lines: string[] = [];
  
  // Desktop (largest breakpoint) as default
  const desktopMode = modes[0];
  lines.push(':root {');
  
  for (const variable of variables) {
    const value = variable.valuesByMode[desktopMode.modeId];
    if (!value) continue;
    
    const cssValue = formatCSSValue(value, variable, options);
    if (cssValue !== null) {
      if (options.includeIds) {
        lines.push(`  /* ${variable.id} */`);
      }
      
      // Check if this variable has different values across modes
      const modeValues = modes.map(m => {
        const v = variable.valuesByMode[m.modeId];
        return v?.resolved;
      }).filter(v => v !== null && v !== undefined);
      
      const allSame = modeValues.every(v => v === modeValues[0]);
      
      if (allSame || variable.resolvedType !== 'FLOAT') {
        // Static value
        lines.push(`  ${variable.cssName}: ${cssValue};`);
      } else {
        // Generate clamp for fluid value
        const clampValue = generateClamp(modes, variable, options);
        lines.push(`  ${variable.cssName}: ${clampValue};`);
      }
    }
  }
  
  lines.push('}');
  lines.push('');
  
  // Fallback media queries for browsers that don't support clamp well
  lines.push('/* Fallback for older browsers */');
  lines.push('@supports not (width: clamp(1px, 1vw, 2px)) {');
  
  // Generate stepped fallback
  for (let i = 1; i < modes.length; i++) {
    const mode = modes[i];
    const prevMode = modes[i - 1];
    
    lines.push(`  @media (max-width: ${prevMode.breakpointPx - 1}px) {`);
    lines.push('    :root {');
    
    for (const variable of variables) {
      const value = variable.valuesByMode[mode.modeId];
      if (!value) continue;
      
      const cssValue = formatCSSValue(value, variable, options);
      if (cssValue !== null) {
        lines.push(`      ${variable.cssName}: ${cssValue};`);
      }
    }
    
    lines.push('    }');
    lines.push('  }');
  }
  
  lines.push('}');
  
  return lines;
}

function generateClamp(
  modes: Array<{ modeId: string; name: string; breakpointPx: number }>,
  variable: VariableInfo,
  options: ExportOptions
): string {
  // Get values at min and max breakpoints
  const maxMode = modes[0]; // Desktop (largest)
  const minMode = modes[modes.length - 1]; // Mobile (smallest)
  
  const maxValue = variable.valuesByMode[maxMode.modeId]?.resolved;
  const minValue = variable.valuesByMode[minMode.modeId]?.resolved;
  
  if (typeof maxValue !== 'number' || typeof minValue !== 'number') {
    // Can't create clamp for non-numeric values
    return `${maxValue}px`;
  }
  
  const maxVP = maxMode.breakpointPx;
  const minVP = minMode.breakpointPx;
  
  // Linear interpolation formula: value = minValue + (maxValue - minValue) * ((viewport - minVP) / (maxVP - minVP))
  // Rearranged for clamp: clamp(min, preferred, max)
  // preferred = intercept + slope * 100vw
  
  const slope = (maxValue - minValue) / (maxVP - minVP);
  const intercept = minValue - slope * minVP;
  
  const slopeVW = round(slope * 100, 4);
  const interceptPx = round(intercept, 2);
  
  const minPx = round(Math.min(minValue, maxValue), 2);
  const maxPx = round(Math.max(minValue, maxValue), 2);
  
  // Format the preferred value
  let preferred: string;
  if (interceptPx >= 0) {
    preferred = `${interceptPx}px + ${slopeVW}vw`;
  } else {
    preferred = `${slopeVW}vw - ${Math.abs(interceptPx)}px`;
  }
  
  return `clamp(${minPx}px, calc(${preferred}), ${maxPx}px)`;
}

function generateSteppedCSS(
  modes: Array<{ modeId: string; name: string; breakpointPx: number }>,
  variables: VariableInfo[],
  options: ExportOptions
): string[] {
  const lines: string[] = [];
  
  // Desktop (largest breakpoint) as default
  const desktopMode = modes[0];
  lines.push(':root {');
  
  for (const variable of variables) {
    const value = variable.valuesByMode[desktopMode.modeId];
    if (!value) continue;
    
    const cssValue = formatCSSValue(value, variable, options);
    if (cssValue !== null) {
      if (options.includeIds) {
        lines.push(`  /* ${variable.id} */`);
      }
      lines.push(`  ${variable.cssName}: ${cssValue};`);
    }
  }
  
  lines.push('}');
  
  // Media queries for smaller breakpoints
  for (let i = 1; i < modes.length; i++) {
    const mode = modes[i];
    const prevMode = modes[i - 1];
    
    lines.push('');
    lines.push(`@media (max-width: ${prevMode.breakpointPx - 1}px) {`);
    lines.push('  :root {');
    
    for (const variable of variables) {
      const value = variable.valuesByMode[mode.modeId];
      const prevValue = variable.valuesByMode[prevMode.modeId];
      
      if (!value) continue;
      
      // Only output if value is different from previous breakpoint
      const cssValue = formatCSSValue(value, variable, options);
      const prevCssValue = prevValue ? formatCSSValue(prevValue, variable, options) : null;
      
      if (cssValue !== null && cssValue !== prevCssValue) {
        lines.push(`    ${variable.cssName}: ${cssValue};`);
      }
    }
    
    lines.push('  }');
    lines.push('}');
  }
  
  return lines;
}

function generateThemeCSS(
  collection: VariableCollection,
  variables: VariableInfo[],
  options: ExportOptions
): string[] {
  const lines: string[] = [];
  
  // Find light and dark modes
  const lightMode = collection.modes.find(m => m.name.toLowerCase().includes('light'));
  const darkMode = collection.modes.find(m => m.name.toLowerCase().includes('dark'));
  
  // Light mode (or first mode) as default
  const defaultMode = lightMode || collection.modes[0];
  
  lines.push(':root {');
  
  for (const variable of variables) {
    const value = variable.valuesByMode[defaultMode.modeId];
    if (!value) continue;
    
    const cssValue = formatCSSValue(value, variable, options);
    if (cssValue !== null) {
      if (options.includeIds) {
        lines.push(`  /* ${variable.id} */`);
      }
      lines.push(`  ${variable.cssName}: ${cssValue};`);
    }
  }
  
  lines.push('}');
  
  // Dark mode
  if (darkMode) {
    const usePrefersColorScheme = options.darkModeOutput === 'prefers-color-scheme' || options.darkModeOutput === 'both';
    const useClass = options.darkModeOutput === 'class' || options.darkModeOutput === 'both';
    
    if (usePrefersColorScheme) {
      lines.push('');
      lines.push('@media (prefers-color-scheme: dark) {');
      lines.push('  :root {');
      
      for (const variable of variables) {
        const darkValue = variable.valuesByMode[darkMode.modeId];
        const lightValue = variable.valuesByMode[defaultMode.modeId];
        
        if (!darkValue) continue;
        
        const darkCss = formatCSSValue(darkValue, variable, options);
        const lightCss = lightValue ? formatCSSValue(lightValue, variable, options) : null;
        
        // Only output if different from light mode
        if (darkCss !== null && darkCss !== lightCss) {
          lines.push(`    ${variable.cssName}: ${darkCss};`);
        }
      }
      
      lines.push('  }');
      lines.push('}');
    }
    
    if (useClass) {
      lines.push('');
      lines.push('.dark {');
      
      for (const variable of variables) {
        const darkValue = variable.valuesByMode[darkMode.modeId];
        const lightValue = variable.valuesByMode[defaultMode.modeId];
        
        if (!darkValue) continue;
        
        const darkCss = formatCSSValue(darkValue, variable, options);
        const lightCss = lightValue ? formatCSSValue(lightValue, variable, options) : null;
        
        if (darkCss !== null && darkCss !== lightCss) {
          lines.push(`  ${variable.cssName}: ${darkCss};`);
        }
      }
      
      lines.push('}');
    }
  }
  
  return lines;
}

function generateSingleModeCSS(
  collection: VariableCollection,
  variables: VariableInfo[],
  options: ExportOptions
): string[] {
  const lines: string[] = [];
  const mode = collection.modes[0];
  
  lines.push(':root {');
  
  for (const variable of variables) {
    const value = variable.valuesByMode[mode.modeId];
    if (!value) continue;
    
    const cssValue = formatCSSValue(value, variable, options);
    if (cssValue !== null) {
      if (options.includeIds) {
        lines.push(`  /* ${variable.id} */`);
      }
      lines.push(`  ${variable.cssName}: ${cssValue};`);
    }
  }
  
  lines.push('}');
  
  return lines;
}

function formatCSSValue(
  value: ProcessedValue,
  variable: VariableInfo,
  options: ExportOptions
): string | null {
  if (options.aliasMode === 'preserved' && value.isAlias && value.aliasName) {
    return `var(${value.aliasName})`;
  }
  
  if (value.resolved === null) return null;
  
  // Format based on type
  switch (variable.resolvedType) {
    case 'COLOR':
      return String(value.resolved);
    case 'FLOAT':
      // Add px unit to numeric values
      return `${value.resolved}px`;
    case 'STRING':
      return `"${value.resolved}"`;
    case 'BOOLEAN':
      return String(value.resolved);
    default:
      return String(value.resolved);
  }
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
