/// <reference types="@figma/plugin-typings" />

// Variable to CSS v1.2
// Figma Plugin for exporting variable collections to CSS custom properties
// 
// v1.2 Fixes:
// - Preserve intentional double hyphens in variable names
// - Smart domain prefix: only for Foundations/Aliases, not Mappings
// - Prevent circular alias references (skip self-referencing aliases)
// - Deduplicate CSS declarations across collections

// ============================================
// TYPES
// ============================================

interface CollectionInfo {
  id: string;
  name: string;
  domain: string;
  layer: string;
  layerType: 'foundations' | 'aliases' | 'aliases-extended' | 'mappings' | 'other';
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
  layerType: 'foundations' | 'aliases' | 'aliases-extended' | 'mappings' | 'other';
  resolvedType: string;
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
var BREAKPOINT_MODES: Record<string, number> = {
  'desktop': 1680,
  'laptop': 1366,
  'tablet': 840,
  'mobile': 480
};

var THEME_MODES = ['light', 'dark'];

// ============================================
// INITIALIZATION
// ============================================

figma.showUI(__html__, { width: 700, height: 600, themeColors: true });

// Restore window size
figma.clientStorage.getAsync('windowSize').then(function(size: any) {
  if (size) figma.ui.resize(size.w, size.h);
}).catch(function() {});

// ============================================
// MESSAGE HANDLERS
// ============================================

figma.ui.onmessage = async function(msg: any) {
  try {
    if (msg.type === 'resize') {
      // No max constraints - only minimum size
      var w = Math.max(600, msg.size.w);
      var h = Math.max(450, msg.size.h);
      figma.ui.resize(w, h);
      figma.clientStorage.setAsync('windowSize', { w: w, h: h });
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
  var collections = await figma.variables.getLocalVariableCollectionsAsync();
  var collectionInfos: CollectionInfo[] = [];
  
  for (var i = 0; i < collections.length; i++) {
    var collection = collections[i];
    if (collection.remote) continue;
    
    var parsed = parseCollectionName(collection.name);
    var modes: ModeInfo[] = [];
    
    for (var j = 0; j < collection.modes.length; j++) {
      var m = collection.modes[j];
      modes.push({
        modeId: m.modeId,
        name: m.name,
        breakpointPx: detectBreakpoint(m.name)
      });
    }
    
    var modeType = detectModeType(modes);
    
    collectionInfos.push({
      id: collection.id,
      name: collection.name,
      domain: parsed.domain,
      layer: parsed.layer,
      layerType: parsed.layerType,
      modes: modes,
      modeType: modeType,
      variableCount: collection.variableIds.length
    });
  }
  
  // Sort by domain and layer
  collectionInfos.sort(function(a, b) {
    if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
    return a.layer.localeCompare(b.layer);
  });
  
  var totalVariables = 0;
  for (var i = 0; i < collectionInfos.length; i++) {
    totalVariables += collectionInfos[i].variableCount;
  }
  
  figma.ui.postMessage({
    type: 'collections-scanned',
    collections: collectionInfos,
    totalVariables: totalVariables
  });
}

function parseCollectionName(name: string): { domain: string; layer: string; layerType: 'foundations' | 'aliases' | 'aliases-extended' | 'mappings' | 'other' } {
  // Pattern: "Domain - Layer. Type" or "Domain - Layer Type"
  // Examples: "Typo - 1. Foundations", "Space - 2.1 Aliases Extended", "Dimension - 4. Mappings"
  var match = name.match(/^([A-Za-z]+)\s*-\s*(.+)$/);
  var domain = match ? match[1].toLowerCase() : name.toLowerCase();
  var layer = match ? match[2].trim() : 'default';
  
  // Detect layer type from collection name
  var lowerName = name.toLowerCase();
  var layerType: 'foundations' | 'aliases' | 'aliases-extended' | 'mappings' | 'other' = 'other';
  
  if (lowerName.indexOf('foundation') !== -1) {
    layerType = 'foundations';
  } else if (lowerName.indexOf('extended') !== -1 || lowerName.indexOf('2.1') !== -1) {
    layerType = 'aliases-extended';
  } else if (lowerName.indexOf('alias') !== -1) {
    layerType = 'aliases';
  } else if (lowerName.indexOf('mapping') !== -1) {
    layerType = 'mappings';
  }
  
  return { domain, layer, layerType };
}

function detectBreakpoint(modeName: string): number | undefined {
  var lower = modeName.toLowerCase();
  var entries = Object.keys(BREAKPOINT_MODES);
  for (var i = 0; i < entries.length; i++) {
    var name = entries[i];
    if (lower.indexOf(name) !== -1) return BREAKPOINT_MODES[name];
  }
  return undefined;
}

function detectModeType(modes: ModeInfo[]): 'breakpoint' | 'theme' | 'single' {
  if (modes.length === 1) return 'single';
  
  // Check if all modes have breakpoints
  var hasBreakpoints = true;
  for (var i = 0; i < modes.length; i++) {
    if (modes[i].breakpointPx === undefined) {
      hasBreakpoints = false;
      break;
    }
  }
  if (hasBreakpoints) return 'breakpoint';
  
  // Check if modes are light/dark
  for (var i = 0; i < modes.length; i++) {
    var modeName = modes[i].name.toLowerCase();
    if (THEME_MODES.indexOf(modeName) !== -1) {
      return 'theme';
    }
  }
  
  return 'single';
}

// ============================================
// CSS GENERATION
// ============================================

async function handleGenerateCSS(options: ExportOptions) {
  var collections = await figma.variables.getLocalVariableCollectionsAsync();
  var allVariables: VariableInfo[] = [];
  var variableMap = new Map<string, VariableInfo>();
  var errors: string[] = [];
  
  // Track CSS names to detect duplicates and circular references
  var outputtedCSSNames = new Set<string>();
  
  // First pass: collect all variables
  for (var ci = 0; ci < collections.length; ci++) {
    var collection = collections[ci];
    if (collection.remote) continue;
    
    var parsed = parseCollectionName(collection.name);
    var domain = parsed.domain;
    var layerType = parsed.layerType;
    
    for (var vi = 0; vi < collection.variableIds.length; vi++) {
      var varId = collection.variableIds[vi];
      var variable = await figma.variables.getVariableByIdAsync(varId);
      if (!variable) continue;
      
      var cssName = generateCSSName(variable.name, domain, layerType);
      var valuesByMode: Record<string, ProcessedValue> = {};
      
      for (var mi = 0; mi < collection.modes.length; mi++) {
        var mode = collection.modes[mi];
        var rawValue = variable.valuesByMode[mode.modeId];
        valuesByMode[mode.modeId] = await processValue(rawValue, variable.resolvedType, options);
      }
      
      var isAlias = false;
      var values = Object.keys(valuesByMode);
      for (var ki = 0; ki < values.length; ki++) {
        if (valuesByMode[values[ki]].isAlias) {
          isAlias = true;
          break;
        }
      }
      
      var varInfo: VariableInfo = {
        id: variable.id,
        name: variable.name,
        collectionId: collection.id,
        collectionName: collection.name,
        domain: domain,
        layerType: layerType,
        resolvedType: variable.resolvedType,
        valuesByMode: valuesByMode,
        isAlias: isAlias,
        cssName: cssName
      };
      
      allVariables.push(varInfo);
      variableMap.set(variable.id, varInfo);
    }
  }
  
  // Second pass: resolve alias names
  for (var ai = 0; ai < allVariables.length; ai++) {
    var varInfo = allVariables[ai];
    var modeIds = Object.keys(varInfo.valuesByMode);
    for (var mi = 0; mi < modeIds.length; mi++) {
      var modeId = modeIds[mi];
      var value = varInfo.valuesByMode[modeId];
      if (value.isAlias && value.aliasId) {
        var target = variableMap.get(value.aliasId);
        if (target) {
          value.aliasName = target.cssName;
        } else {
          errors.push('Broken alias: ' + varInfo.name + ' references unknown variable');
        }
      }
    }
  }
  
  // Group by collection for ordered output
  var collectionGroups = groupByCollection(allVariables, collections);
  
  // Generate CSS with deduplication
  var css = generateCSSOutput(collectionGroups, collections, options, outputtedCSSNames, errors);
  
  var nonRemoteCount = 0;
  for (var i = 0; i < collections.length; i++) {
    if (!collections[i].remote) nonRemoteCount++;
  }
  
  figma.ui.postMessage({
    type: 'css-generated',
    output: {
      css: css,
      stats: {
        collections: nonRemoteCount,
        variables: allVariables.length,
        errors: errors
      }
    }
  });
}

function generateCSSName(varName: string, domain: string, layerType: 'foundations' | 'aliases' | 'aliases-extended' | 'mappings' | 'other'): string {
  // Transform Figma variable name to CSS custom property name
  // IMPORTANT: Preserve intentional double hyphens (e.g., "stroke--width")
  
  var cssName = varName
    .toLowerCase()
    .replace(/\//g, '-')           // Path separator to hyphen
    .replace(/\./g, '-')           // Dots to hyphens
    .replace(/,/g, '-')            // Commas to hyphens
    .replace(/\s+/g, '-')          // Spaces to hyphens
    .replace(/[^a-z0-9-]/g, '-')   // Other special chars to hyphens
    .replace(/-{3,}/g, '--')       // Collapse 3+ hyphens to 2 (preserve intentional --)
    .replace(/^-+|-+$/g, '');      // Trim leading/trailing hyphens
  
  // Domain prefix logic:
  // - Foundations: Add domain prefix (e.g., "typo-type-family-primary")
  // - Aliases/Aliases Extended: Add domain prefix (same structure as foundations)
  // - Mappings: NO domain prefix (semantic names like "button-background")
  // - Other: Check if name already has domain-like prefix
  
  if (layerType === 'mappings') {
    // Mappings are semantic - no domain prefix
    return '--' + cssName;
  }
  
  if (layerType === 'foundations' || layerType === 'aliases' || layerType === 'aliases-extended') {
    // Add domain prefix if not already present
    if (cssName.indexOf(domain + '-') !== 0 && cssName !== domain) {
      cssName = domain + '-' + cssName;
    }
    return '--' + cssName;
  }
  
  // For 'other' layer type, check if it looks like it already has a domain prefix
  // Common domains: typo, space, color, dimension, static, etc.
  var commonDomains = ['typo', 'space', 'color', 'dimension', 'static', 'size', 'radius', 'border'];
  var hasExistingDomain = false;
  for (var i = 0; i < commonDomains.length; i++) {
    if (cssName.indexOf(commonDomains[i] + '-') === 0) {
      hasExistingDomain = true;
      break;
    }
  }
  
  if (!hasExistingDomain && cssName.indexOf(domain + '-') !== 0) {
    cssName = domain + '-' + cssName;
  }
  
  return '--' + cssName;
}

async function processValue(
  rawValue: any,
  type: string,
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
  var resolved: string | number | null = null;
  
  if (type === 'COLOR') {
    if (rawValue && typeof rawValue === 'object' && 'r' in rawValue) {
      resolved = options.colorFormat === 'oklch' 
        ? rgbToOklch(rawValue) 
        : rgbToHex(rawValue);
    }
  } else if (type === 'FLOAT') {
    if (typeof rawValue === 'number') {
      resolved = rawValue;
    }
  } else if (type === 'STRING') {
    if (typeof rawValue === 'string') {
      resolved = rawValue;
    }
  } else if (type === 'BOOLEAN') {
    resolved = rawValue ? 1 : 0;
  }
  
  return {
    raw: rawValue,
    isAlias: false,
    resolved: resolved
  };
}

function rgbToHex(color: { r: number; g: number; b: number; a?: number }): string {
  function toHex(n: number): string {
    var hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }
  var hex = '#' + toHex(color.r) + toHex(color.g) + toHex(color.b);
  if (color.a !== undefined && color.a < 1) {
    return hex + toHex(color.a);
  }
  return hex;
}

function rgbToOklch(color: { r: number; g: number; b: number; a?: number }): string {
  var r = color.r, g = color.g, b = color.b;
  
  function toLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  var lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  
  var x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  var y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  var z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;
  
  var l = Math.cbrt(y);
  var c = Math.sqrt(x * x + z * z) * 0.4;
  var h = Math.atan2(z, x) * 180 / Math.PI;
  
  var L = Math.round(l * 100) / 100;
  var C = Math.round(c * 1000) / 1000;
  var H = Math.round((h + 360) % 360);
  
  if (color.a !== undefined && color.a < 1) {
    return 'oklch(' + L + ' ' + C + ' ' + H + ' / ' + Math.round(color.a * 100) + '%)';
  }
  return 'oklch(' + L + ' ' + C + ' ' + H + ')';
}

function groupByCollection(
  variables: VariableInfo[],
  collections: any[]
): Map<string, VariableInfo[]> {
  var groups = new Map<string, VariableInfo[]>();
  
  for (var i = 0; i < variables.length; i++) {
    var v = variables[i];
    var existing = groups.get(v.collectionId);
    if (!existing) {
      existing = [];
    }
    existing.push(v);
    groups.set(v.collectionId, existing);
  }
  
  return groups;
}

function generateCSSOutput(
  collectionGroups: Map<string, VariableInfo[]>,
  collections: any[],
  options: ExportOptions,
  outputtedCSSNames: Set<string>,
  errors: string[]
): string {
  var lines: string[] = [];
  var timestamp = new Date().toISOString();
  
  // Header
  lines.push('/* ==========================================================================');
  lines.push('   DESIGN TOKENS — Generated from Figma Variables');
  if (options.includeTimestamp) {
    lines.push('   Date: ' + timestamp);
  }
  lines.push('   ========================================================================== */');
  lines.push('');
  
  // Sort collections: Foundations first, then Aliases, then Mappings
  var sortedCollections: any[] = [];
  for (var i = 0; i < collections.length; i++) {
    var c = collections[i];
    if (!c.remote && collectionGroups.has(c.id)) {
      sortedCollections.push(c);
    }
  }
  
  sortedCollections.sort(function(a: any, b: any) {
    function layerOrder(name: string): number {
      var lower = name.toLowerCase();
      if (lower.indexOf('foundation') !== -1) return 0;
      if (lower.indexOf('alias') !== -1 && lower.indexOf('extended') === -1) return 1;
      if (lower.indexOf('extended') !== -1) return 2;
      if (lower.indexOf('mapping') !== -1) return 3;
      return 4;
    }
    var parsedA = parseCollectionName(a.name);
    var parsedB = parseCollectionName(b.name);
    if (parsedA.domain !== parsedB.domain) return parsedA.domain.localeCompare(parsedB.domain);
    return layerOrder(a.name) - layerOrder(b.name);
  });
  
  for (var si = 0; si < sortedCollections.length; si++) {
    var collection = sortedCollections[si];
    var variables = collectionGroups.get(collection.id);
    if (!variables || variables.length === 0) continue;
    
    var parsed = parseCollectionName(collection.name);
    
    var modeInfos: ModeInfo[] = [];
    for (var mi = 0; mi < collection.modes.length; mi++) {
      var m = collection.modes[mi];
      modeInfos.push({
        modeId: m.modeId,
        name: m.name,
        breakpointPx: detectBreakpoint(m.name)
      });
    }
    var modeType = detectModeType(modeInfos);
    
    // Section header
    lines.push('/* --------------------------------------------------------------------------');
    lines.push('   ' + collection.name.toUpperCase());
    lines.push('   -------------------------------------------------------------------------- */');
    lines.push('');
    
    var sectionLines: string[];
    if (modeType === 'breakpoint') {
      sectionLines = generateBreakpointCSS(collection, variables, options, outputtedCSSNames, errors);
    } else if (modeType === 'theme') {
      sectionLines = generateThemeCSS(collection, variables, options, outputtedCSSNames, errors);
    } else {
      sectionLines = generateSingleModeCSS(collection, variables, options, outputtedCSSNames, errors);
    }
    
    for (var li = 0; li < sectionLines.length; li++) {
      lines.push(sectionLines[li]);
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

// Check if a variable should be skipped (circular reference or duplicate)
function shouldSkipVariable(
  variable: VariableInfo,
  value: ProcessedValue,
  outputtedCSSNames: Set<string>,
  errors: string[]
): boolean {
  // Check for circular reference: alias pointing to itself
  if (value.isAlias && value.aliasName === variable.cssName) {
    // This would create: --var-name: var(--var-name); which is circular
    // Skip this variable - it's likely an alias that mirrors a foundation
    return true;
  }
  
  // Check for duplicate CSS name that's already been output
  // Only skip if it's NOT a foundation (foundations should always be output first)
  if (outputtedCSSNames.has(variable.cssName) && variable.layerType !== 'foundations') {
    return true;
  }
  
  return false;
}

function generateBreakpointCSS(
  collection: any,
  variables: VariableInfo[],
  options: ExportOptions,
  outputtedCSSNames: Set<string>,
  errors: string[]
): string[] {
  var lines: string[] = [];
  
  // Get modes sorted by breakpoint (largest first)
  var sortedModes: Array<{ modeId: string; name: string; breakpointPx: number }> = [];
  for (var i = 0; i < collection.modes.length; i++) {
    var m = collection.modes[i];
    sortedModes.push({
      modeId: m.modeId,
      name: m.name,
      breakpointPx: detectBreakpoint(m.name) || 0
    });
  }
  sortedModes.sort(function(a, b) { return b.breakpointPx - a.breakpointPx; });
  
  var resultLines: string[];
  if (options.outputMode === 'fluid' && sortedModes.length >= 2) {
    resultLines = generateFluidCSS(sortedModes, variables, options, outputtedCSSNames, errors);
  } else {
    resultLines = generateSteppedCSS(sortedModes, variables, options, outputtedCSSNames, errors);
  }
  
  for (var i = 0; i < resultLines.length; i++) {
    lines.push(resultLines[i]);
  }
  
  return lines;
}

function generateFluidCSS(
  modes: Array<{ modeId: string; name: string; breakpointPx: number }>,
  variables: VariableInfo[],
  options: ExportOptions,
  outputtedCSSNames: Set<string>,
  errors: string[]
): string[] {
  var lines: string[] = [];
  
  // Desktop (largest breakpoint) as default
  var desktopMode = modes[0];
  lines.push(':root {');
  
  for (var vi = 0; vi < variables.length; vi++) {
    var variable = variables[vi];
    var value = variable.valuesByMode[desktopMode.modeId];
    if (!value) continue;
    
    // Check if we should skip this variable
    if (shouldSkipVariable(variable, value, outputtedCSSNames, errors)) {
      continue;
    }
    
    var cssValue = formatCSSValue(value, variable, options);
    if (cssValue !== null) {
      if (options.includeIds) {
        lines.push('  /* ' + variable.id + ' */');
      }
      
      // Check if this variable has different values across modes
      var modeValues: any[] = [];
      for (var mi = 0; mi < modes.length; mi++) {
        var v = variable.valuesByMode[modes[mi].modeId];
        if (v && v.resolved !== null && v.resolved !== undefined) {
          modeValues.push(v.resolved);
        }
      }
      
      var allSame = true;
      for (var i = 1; i < modeValues.length; i++) {
        if (modeValues[i] !== modeValues[0]) {
          allSame = false;
          break;
        }
      }
      
      if (allSame || variable.resolvedType !== 'FLOAT') {
        lines.push('  ' + variable.cssName + ': ' + cssValue + ';');
      } else {
        var clampValue = generateClamp(modes, variable, options);
        lines.push('  ' + variable.cssName + ': ' + clampValue + ';');
      }
      
      // Mark as outputted
      outputtedCSSNames.add(variable.cssName);
    }
  }
  
  lines.push('}');
  lines.push('');
  
  // Fallback media queries for browsers that don't support clamp well
  lines.push('/* Fallback for older browsers */');
  lines.push('@supports not (width: clamp(1px, 1vw, 2px)) {');
  
  for (var i = 1; i < modes.length; i++) {
    var mode = modes[i];
    var prevMode = modes[i - 1];
    
    lines.push('  @media (max-width: ' + (prevMode.breakpointPx - 1) + 'px) {');
    lines.push('    :root {');
    
    for (var vi = 0; vi < variables.length; vi++) {
      var variable = variables[vi];
      var val = variable.valuesByMode[mode.modeId];
      if (!val) continue;
      
      // Only output if this variable was in the main :root block
      if (!outputtedCSSNames.has(variable.cssName)) continue;
      
      var cv = formatCSSValue(val, variable, options);
      if (cv !== null) {
        lines.push('      ' + variable.cssName + ': ' + cv + ';');
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
  var maxMode = modes[0];
  var minMode = modes[modes.length - 1];
  
  var maxVal = variable.valuesByMode[maxMode.modeId];
  var minVal = variable.valuesByMode[minMode.modeId];
  
  var maxValue = maxVal ? maxVal.resolved : null;
  var minValue = minVal ? minVal.resolved : null;
  
  if (typeof maxValue !== 'number' || typeof minValue !== 'number') {
    return maxValue + 'px';
  }
  
  var maxVP = maxMode.breakpointPx;
  var minVP = minMode.breakpointPx;
  
  var slope = (maxValue - minValue) / (maxVP - minVP);
  var intercept = minValue - slope * minVP;
  
  var slopeVW = round(slope * 100, 4);
  var interceptPx = round(intercept, 2);
  
  var minPx = round(Math.min(minValue, maxValue), 2);
  var maxPx = round(Math.max(minValue, maxValue), 2);
  
  var preferred: string;
  if (interceptPx >= 0) {
    preferred = interceptPx + 'px + ' + slopeVW + 'vw';
  } else {
    preferred = slopeVW + 'vw - ' + Math.abs(interceptPx) + 'px';
  }
  
  return 'clamp(' + minPx + 'px, calc(' + preferred + '), ' + maxPx + 'px)';
}

function generateSteppedCSS(
  modes: Array<{ modeId: string; name: string; breakpointPx: number }>,
  variables: VariableInfo[],
  options: ExportOptions,
  outputtedCSSNames: Set<string>,
  errors: string[]
): string[] {
  var lines: string[] = [];
  
  var desktopMode = modes[0];
  lines.push(':root {');
  
  for (var vi = 0; vi < variables.length; vi++) {
    var variable = variables[vi];
    var value = variable.valuesByMode[desktopMode.modeId];
    if (!value) continue;
    
    // Check if we should skip this variable
    if (shouldSkipVariable(variable, value, outputtedCSSNames, errors)) {
      continue;
    }
    
    var cssValue = formatCSSValue(value, variable, options);
    if (cssValue !== null) {
      if (options.includeIds) {
        lines.push('  /* ' + variable.id + ' */');
      }
      lines.push('  ' + variable.cssName + ': ' + cssValue + ';');
      outputtedCSSNames.add(variable.cssName);
    }
  }
  
  lines.push('}');
  
  for (var i = 1; i < modes.length; i++) {
    var mode = modes[i];
    var prevMode = modes[i - 1];
    
    lines.push('');
    lines.push('@media (max-width: ' + (prevMode.breakpointPx - 1) + 'px) {');
    lines.push('  :root {');
    
    for (var vi = 0; vi < variables.length; vi++) {
      var variable = variables[vi];
      var value = variable.valuesByMode[mode.modeId];
      var prevValue = variable.valuesByMode[prevMode.modeId];
      
      if (!value) continue;
      
      // Only output if this variable was in the main :root block
      if (!outputtedCSSNames.has(variable.cssName)) continue;
      
      var cssValue = formatCSSValue(value, variable, options);
      var prevCssValue = prevValue ? formatCSSValue(prevValue, variable, options) : null;
      
      if (cssValue !== null && cssValue !== prevCssValue) {
        lines.push('    ' + variable.cssName + ': ' + cssValue + ';');
      }
    }
    
    lines.push('  }');
    lines.push('}');
  }
  
  return lines;
}

function generateThemeCSS(
  collection: any,
  variables: VariableInfo[],
  options: ExportOptions,
  outputtedCSSNames: Set<string>,
  errors: string[]
): string[] {
  var lines: string[] = [];
  
  var lightMode: any = null;
  var darkMode: any = null;
  
  for (var i = 0; i < collection.modes.length; i++) {
    var m = collection.modes[i];
    if (m.name.toLowerCase().indexOf('light') !== -1) lightMode = m;
    if (m.name.toLowerCase().indexOf('dark') !== -1) darkMode = m;
  }
  
  var defaultMode = lightMode || collection.modes[0];
  
  lines.push(':root {');
  
  for (var vi = 0; vi < variables.length; vi++) {
    var variable = variables[vi];
    var value = variable.valuesByMode[defaultMode.modeId];
    if (!value) continue;
    
    // Check if we should skip this variable
    if (shouldSkipVariable(variable, value, outputtedCSSNames, errors)) {
      continue;
    }
    
    var cssValue = formatCSSValue(value, variable, options);
    if (cssValue !== null) {
      if (options.includeIds) {
        lines.push('  /* ' + variable.id + ' */');
      }
      lines.push('  ' + variable.cssName + ': ' + cssValue + ';');
      outputtedCSSNames.add(variable.cssName);
    }
  }
  
  lines.push('}');
  
  if (darkMode) {
    var usePrefersColorScheme = options.darkModeOutput === 'prefers-color-scheme' || options.darkModeOutput === 'both';
    var useClass = options.darkModeOutput === 'class' || options.darkModeOutput === 'both';
    
    if (usePrefersColorScheme) {
      lines.push('');
      lines.push('@media (prefers-color-scheme: dark) {');
      lines.push('  :root {');
      
      for (var vi = 0; vi < variables.length; vi++) {
        var variable = variables[vi];
        var darkValue = variable.valuesByMode[darkMode.modeId];
        var lightValue = variable.valuesByMode[defaultMode.modeId];
        
        if (!darkValue) continue;
        
        // Only output if this variable was in the main :root block
        if (!outputtedCSSNames.has(variable.cssName)) continue;
        
        var darkCss = formatCSSValue(darkValue, variable, options);
        var lightCss = lightValue ? formatCSSValue(lightValue, variable, options) : null;
        
        if (darkCss !== null && darkCss !== lightCss) {
          lines.push('    ' + variable.cssName + ': ' + darkCss + ';');
        }
      }
      
      lines.push('  }');
      lines.push('}');
    }
    
    if (useClass) {
      lines.push('');
      lines.push('.dark {');
      
      for (var vi = 0; vi < variables.length; vi++) {
        var variable = variables[vi];
        var darkValue = variable.valuesByMode[darkMode.modeId];
        var lightValue = variable.valuesByMode[defaultMode.modeId];
        
        if (!darkValue) continue;
        
        // Only output if this variable was in the main :root block
        if (!outputtedCSSNames.has(variable.cssName)) continue;
        
        var darkCss = formatCSSValue(darkValue, variable, options);
        var lightCss = lightValue ? formatCSSValue(lightValue, variable, options) : null;
        
        if (darkCss !== null && darkCss !== lightCss) {
          lines.push('  ' + variable.cssName + ': ' + darkCss + ';');
        }
      }
      
      lines.push('}');
    }
  }
  
  return lines;
}

function generateSingleModeCSS(
  collection: any,
  variables: VariableInfo[],
  options: ExportOptions,
  outputtedCSSNames: Set<string>,
  errors: string[]
): string[] {
  var lines: string[] = [];
  var mode = collection.modes[0];
  
  lines.push(':root {');
  
  for (var vi = 0; vi < variables.length; vi++) {
    var variable = variables[vi];
    var value = variable.valuesByMode[mode.modeId];
    if (!value) continue;
    
    // Check if we should skip this variable
    if (shouldSkipVariable(variable, value, outputtedCSSNames, errors)) {
      continue;
    }
    
    var cssValue = formatCSSValue(value, variable, options);
    if (cssValue !== null) {
      if (options.includeIds) {
        lines.push('  /* ' + variable.id + ' */');
      }
      lines.push('  ' + variable.cssName + ': ' + cssValue + ';');
      outputtedCSSNames.add(variable.cssName);
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
    return 'var(' + value.aliasName + ')';
  }
  
  if (value.resolved === null) return null;
  
  if (variable.resolvedType === 'COLOR') {
    return String(value.resolved);
  } else if (variable.resolvedType === 'FLOAT') {
    return value.resolved + 'px';
  } else if (variable.resolvedType === 'STRING') {
    return '"' + value.resolved + '"';
  } else if (variable.resolvedType === 'BOOLEAN') {
    return String(value.resolved);
  }
  
  return String(value.resolved);
}

function round(value: number, decimals: number): number {
  var factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
