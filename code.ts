/// <reference types="@figma/plugin-typings" />

// Variable to CSS v1.7
// Figma Plugin for exporting variable collections to CSS custom properties
//
// v1.7 Features:
// - Fixed-value export mode: raw values per breakpoint, no clamp() interpolation
// - Piecewise linear clamp: 3-segment clamp() for non-linear scaling variables
// - Composite text style export: SCSS mixins, CSS classes, or CSS custom properties
//   from Figma Text Styles with var() references to bound variables
//
// v1.6 Fixes & Features:
// - Unitless number detection: font-weight, column-count, opacity, z-index, etc.
//   no longer get an incorrect 'px' suffix
// - Font-style string values (italic, oblique, normal) output unquoted
// - Collapsible viewport/proportion detection panels in UI
//
// v1.3 Features:
// - Multi-mode CSS export: Variables with breakpoint modes (Desktop/Laptop/Tablet/Mobile)
//   now output media queries for aliases that change var() references per breakpoint
// - Numeric foundations still use clamp() for fluid scaling
// - Non-numeric values and aliases with changing refs get proper media queries
// - Theme modes output both @media (prefers-color-scheme: dark) AND [data-theme="dark"]
// - Updated breakpoint thresholds: 1679px, 1365px, 839px (desktop-first)
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
  description: string;
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
  outputMode: 'fluid' | 'fixed';
  breakpointDirection: 'mobile-first' | 'desktop-first';
  aliasMode: 'preserved' | 'resolved';
  darkModeOutput: 'prefers-color-scheme' | 'class' | 'both';
  includeTimestamp: boolean;
  includeIds: boolean;
  colorFormat: 'hex' | 'oklch';
  includeLegacyFallbacks: boolean;
  // List of CSS variable names that should use min(100vw, max) instead of clamp()
  // If null/undefined, auto-detect based on "viewport" in name/description
  viewportRelativeOverrides?: string[];
  // Proportions are always-on: variables with "proportion" in name always output
  // as unitless column counts + --fr variants (no opt-in needed)
  // List of CSS variable names that should use piecewise clamp() segments
  // (3 segments between adjacent breakpoints) instead of single linear clamp()
  nonLinearOverrides?: string[];
  // Text style export options
  includeTextStyles?: boolean;
  textStyleFormat?: 'scss-mixin' | 'css-class' | 'css-vars';
}

interface ViewportCandidate {
  cssName: string;
  originalName: string;
  reason: 'name' | 'description';
}

interface ProportionCandidate {
  cssName: string;
  originalName: string;
  columnCount: number; // Detected column count (e.g., 12 for "whole", 6 for "half")
}

interface NonLinearCandidate {
  cssName: string;
  originalName: string;
  collectionId: string;      // For collection-level grouping
  collectionName: string;    // For collection-level grouping display
  group: string;             // Path prefix, e.g. "typography/size" from "typography/size/heading-1"
  deviationL: number;  // Fractional deviation at Laptop breakpoint
  deviationT: number;  // Fractional deviation at Tablet breakpoint
  maxDeviation: number; // Max of the two, for display
  // Raw values for hover overlay
  desktopVal: number;
  laptopVal: number;
  laptopExpected: number;
  tabletVal: number;
  tabletExpected: number;
  mobileVal: number;
  // All mode values for variable-mode-count support
  modeValues: Array<{ name: string; value: number; breakpointPx: number }>;
}

interface CSSOutput {
  css: string;
  stats: {
    collections: number;
    variables: number;
    errors: string[];
    // Variables that were treated as viewport-relative (actually used min())
    viewportRelativeVars: string[];
    // Candidates detected for viewport-relative treatment (for UI to show)
    viewportCandidates: ViewportCandidate[];
    // Variables that were treated as proportions (output as flex/grid values)
    proportionVars: string[];
    // Candidates detected for proportion treatment (for UI to show)
    proportionCandidates: ProportionCandidate[];
    // Variables that used piecewise clamp (non-linear scaling)
    nonLinearVars: string[];
    // Candidates detected for non-linear treatment (for UI to show)
    nonLinearCandidates: NonLinearCandidate[];
    // Number of text styles exported (0 if not included)
    textStyleCount: number;
  };
}

// Known breakpoint mode names and their viewport widths
// These are the ACTUAL viewport widths where each breakpoint applies (for clamp calculations)
// Media queries use (breakpointPx - 1) for max-width thresholds
var BREAKPOINT_MODES: Record<string, number> = {
  'desktop': 1680,  // >=1680px (default, no media query)
  'laptop': 1366,   // >=1366px, generates @media (max-width: 1679px)
  'tablet': 840,    // >=840px, generates @media (max-width: 1365px)
  'mobile': 480     // >=480px, generates @media (max-width: 839px)
};

var THEME_MODES = ['light', 'dark'];

// ============================================
// INITIALIZATION
// ============================================

figma.showUI(__html__, { width: 900, height: 600, themeColors: true });

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
    } else if (msg.type === 'scan-textstyles') {
      await handleScanTextStyles();
    } else if (msg.type === 'scan-breakpoints') {
      var detected = await extractBreakpointsFromVariables();
      figma.ui.postMessage({
        type: 'breakpoints-detected',
        breakpoints: detected ? detected.breakpoints : null,
        sourceName: detected ? detected.sourceName : null,
        defaults: { desktop: BREAKPOINT_MODES['desktop'], laptop: BREAKPOINT_MODES['laptop'], tablet: BREAKPOINT_MODES['tablet'], mobile: BREAKPOINT_MODES['mobile'] }
      });
    } else if (msg.type === 'generate-css') {
      // Update breakpoints from UI if provided
      if (msg.breakpoints) {
        if (msg.breakpoints.desktop) BREAKPOINT_MODES['desktop'] = msg.breakpoints.desktop;
        if (msg.breakpoints.laptop) BREAKPOINT_MODES['laptop'] = msg.breakpoints.laptop;
        if (msg.breakpoints.tablet) BREAKPOINT_MODES['tablet'] = msg.breakpoints.tablet;
        if (msg.breakpoints.mobile) BREAKPOINT_MODES['mobile'] = msg.breakpoints.mobile;
      }
      await handleGenerateCSS(msg.options as ExportOptions);
    } else if (msg.type === 'save-settings') {
      figma.root.setPluginData('pluginSettings', JSON.stringify(msg.settings));
      figma.ui.postMessage({ type: 'settings-saved' });
    } else if (msg.type === 'load-settings') {
      var stored = figma.root.getPluginData('pluginSettings');
      figma.ui.postMessage({
        type: 'settings-loaded',
        settings: stored ? JSON.parse(stored) : null
      });
    } else if (msg.type === 'clear-settings') {
      figma.root.setPluginData('pluginSettings', '');
      figma.ui.postMessage({ type: 'settings-cleared' });
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

async function handleScanTextStyles() {
  var textStyles = await figma.getLocalTextStylesAsync();
  figma.ui.postMessage({
    type: 'textstyles-scanned',
    count: textStyles.length
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

  // Check if modes are light/dark (substring match for names like "Light Mode", "Dark Theme", etc.)
  for (var i = 0; i < modes.length; i++) {
    var modeName = modes[i].name.toLowerCase();
    for (var j = 0; j < THEME_MODES.length; j++) {
      if (modeName.indexOf(THEME_MODES[j]) !== -1) {
        return 'theme';
      }
    }
  }

  return 'single';
}

// Extract breakpoint values from Figma variables (viewport in Dimension Foundations)
// Returns detected breakpoints and the source variable name, or null if not found
async function extractBreakpointsFromVariables(): Promise<{ breakpoints: Record<string, number>; sourceName: string } | null> {
  var collections = await figma.variables.getLocalVariableCollectionsAsync();

  for (var ci = 0; ci < collections.length; ci++) {
    var collection = collections[ci];
    if (collection.remote) continue;

    var parsed = parseCollectionName(collection.name);
    // Look for Dimension Foundations collection
    if (parsed.domain !== 'dimension' || parsed.layerType !== 'foundations') continue;

    // Must have multiple modes
    if (collection.modes.length < 2) continue;

    // Check if modes are breakpoint-type
    var bpKeys = Object.keys(BREAKPOINT_MODES);
    var modeHasBP = true;
    for (var mi = 0; mi < collection.modes.length; mi++) {
      var modeLower = collection.modes[mi].name.toLowerCase();
      var found = false;
      for (var bi = 0; bi < bpKeys.length; bi++) {
        if (modeLower.indexOf(bpKeys[bi]) !== -1) { found = true; break; }
      }
      if (!found) { modeHasBP = false; break; }
    }
    if (!modeHasBP) continue;

    // Scan variables for "viewport" in name (prefer "viewport--min", fall back to "viewport")
    var viewportMinVar: Variable | null = null;
    var viewportVar: Variable | null = null;

    for (var vi = 0; vi < collection.variableIds.length; vi++) {
      var varId = collection.variableIds[vi];
      var variable = await figma.variables.getVariableByIdAsync(varId);
      if (!variable) continue;
      if (variable.resolvedType !== 'FLOAT') continue;

      var nameLower = variable.name.toLowerCase();
      if (nameLower.indexOf('viewport') !== -1 && nameLower.indexOf('min') !== -1) {
        viewportMinVar = variable;
        break; // Prefer viewport--min
      }
      if (nameLower.indexOf('viewport') !== -1 && !viewportVar) {
        viewportVar = variable;
      }
    }

    var targetVar = viewportMinVar || viewportVar;
    if (!targetVar) continue;

    // Extract the value for each mode as the breakpoint
    var breakpoints: Record<string, number> = {};
    for (var mi = 0; mi < collection.modes.length; mi++) {
      var mode = collection.modes[mi];
      var modeLower = mode.name.toLowerCase();
      var rawValue: any = targetVar.valuesByMode[mode.modeId];

      // Resolve if alias
      if (rawValue && typeof rawValue === 'object' && 'type' in rawValue
          && rawValue.type === 'VARIABLE_ALIAS') {
        try {
          var aliasVar = await figma.variables.getVariableByIdAsync(rawValue.id);
          if (aliasVar) {
            var aliasCollection = await figma.variables.getVariableCollectionByIdAsync(aliasVar.variableCollectionId);
            if (aliasCollection && aliasCollection.modes.length > 0) {
              rawValue = aliasVar.valuesByMode[aliasCollection.modes[0].modeId];
            }
          }
        } catch (e) {
          // Skip if alias resolution fails
        }
      }

      if (typeof rawValue === 'number') {
        for (var bi = 0; bi < bpKeys.length; bi++) {
          if (modeLower.indexOf(bpKeys[bi]) !== -1) {
            breakpoints[bpKeys[bi]] = rawValue;
          }
        }
      }
    }

    // Only return if we found at least 2 breakpoints
    if (Object.keys(breakpoints).length >= 2) {
      return { breakpoints: breakpoints, sourceName: targetVar.name };
    }
  }

  return null;
}

// Check if a variable has different values/aliases across modes
function hasModeVariance(
  variable: VariableInfo,
  modes: Array<{ modeId: string; name: string; breakpointPx: number }>,
  options: ExportOptions
): boolean {
  if (modes.length <= 1) return false;

  var firstValue = formatCSSValue(variable.valuesByMode[modes[0].modeId], variable, options);

  for (var i = 1; i < modes.length; i++) {
    var value = variable.valuesByMode[modes[i].modeId];
    if (!value) continue;
    var cssValue = formatCSSValue(value, variable, options);
    if (cssValue !== firstValue) return true;
  }

  return false;
}

// Check if a variable needs media queries (alias that changes reference, or non-clampable value)
function needsMediaQueries(
  variable: VariableInfo,
  modes: Array<{ modeId: string; name: string; breakpointPx: number }>,
  options: ExportOptions
): boolean {
  // If variable has mode variance, check if it's clampable numeric
  if (!hasModeVariance(variable, modes, options)) return false;

  // Non-FLOAT types always need media queries (can't use clamp)
  if (variable.resolvedType !== 'FLOAT') return true;

  // Check if any mode has an alias value
  for (var i = 0; i < modes.length; i++) {
    var value = variable.valuesByMode[modes[i].modeId];
    if (value && value.isAlias) return true;
  }

  // Numeric values without aliases can use clamp
  return false;
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
        description: variable.description || '',
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

  // Track viewport-relative variables and candidates for reporting
  var viewportRelativeVars: string[] = [];
  var viewportCandidates: ViewportCandidate[] = [];

  // Track proportion variables and candidates for reporting
  var proportionVars: string[] = [];
  var proportionCandidates: ProportionCandidate[] = [];

  // Track non-linear variables and candidates for reporting
  var nonLinearVars: string[] = [];
  var nonLinearCandidates: NonLinearCandidate[] = [];

  // Generate CSS with deduplication
  var css = generateCSSOutput(collectionGroups, collections, options, outputtedCSSNames, errors, viewportRelativeVars, viewportCandidates, proportionVars, proportionCandidates, nonLinearVars, nonLinearCandidates);

  // Append text styles section if enabled
  var textStyleCount = 0;
  if (options.includeTextStyles) {
    var allTextStyles = await figma.getLocalTextStylesAsync();
    textStyleCount = allTextStyles.length;
    var textStyleLines = await generateTextStyleCSS(options, variableMap);
    if (textStyleLines.length > 0) {
      css += '\n' + textStyleLines.join('\n');
    }
  }

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
        errors: errors,
        viewportRelativeVars: viewportRelativeVars,
        viewportCandidates: viewportCandidates,
        proportionVars: proportionVars,
        proportionCandidates: proportionCandidates,
        nonLinearVars: nonLinearVars,
        nonLinearCandidates: nonLinearCandidates,
        textStyleCount: textStyleCount
      }
    }
  });
}

function getVariableGroup(variableName: string): string {
  var lastSlash = variableName.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return variableName.substring(0, lastSlash);
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
  errors: string[],
  viewportRelativeVars: string[],
  viewportCandidates: ViewportCandidate[],
  proportionVars: string[],
  proportionCandidates: ProportionCandidate[],
  nonLinearVars: string[],
  nonLinearCandidates: NonLinearCandidate[]
): string {
  var lines: string[] = [];
  var timestamp = new Date().toISOString();

  // Header
  lines.push('/* ==========================================================================');
  lines.push('   DESIGN TOKENS — Generated from Figma Variables');
  if (options.includeTimestamp) {
    lines.push('   Date: ' + timestamp);
  }
  lines.push('   Mode: ' + (options.outputMode === 'fluid' ? 'Fluid (clamp)' : 'Fixed (per-breakpoint)'));
  lines.push('   Direction: ' + (options.breakpointDirection === 'mobile-first' ? 'Mobile-first (min-width)' : 'Desktop-first (max-width)'));
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
      sectionLines = generateBreakpointCSS(collection, variables, options, outputtedCSSNames, errors, viewportRelativeVars, viewportCandidates, proportionVars, proportionCandidates, nonLinearVars, nonLinearCandidates);
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
  errors: string[],
  viewportRelativeVars: string[],
  viewportCandidates: ViewportCandidate[],
  proportionVars: string[],
  proportionCandidates: ProportionCandidate[],
  nonLinearVars: string[],
  nonLinearCandidates: NonLinearCandidate[]
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
    resultLines = generateFluidCSS(sortedModes, variables, options, outputtedCSSNames, errors, viewportRelativeVars, viewportCandidates, proportionVars, proportionCandidates, nonLinearVars, nonLinearCandidates);
  } else {
    // 'fixed' mode: output raw values per breakpoint using @media queries
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
  errors: string[],
  viewportRelativeVars: string[],
  viewportCandidates: ViewportCandidate[],
  proportionVars: string[],
  proportionCandidates: ProportionCandidate[],
  nonLinearVars: string[],
  nonLinearCandidates: NonLinearCandidate[]
): string[] {
  var lines: string[] = [];

  // Direction: mobile-first uses smallest breakpoint as default, desktop-first uses largest
  var isDesktopFirst = options.breakpointDirection !== 'mobile-first';
  var defaultMode = isDesktopFirst ? modes[0] : modes[modes.length - 1];
  // Always use largest mode for candidate detection (modes sorted largest-first)
  var largestMode = modes[0];

  // Separate variables into:
  // 1. Variables that can use clamp()/min() - numeric FLOAT values without aliases
  // 2. Variables that need media queries - aliases that change, or non-FLOAT types
  var clampableVars: VariableInfo[] = [];
  var mediaQueryVars: VariableInfo[] = [];

  for (var vi = 0; vi < variables.length; vi++) {
    var variable = variables[vi];
    var value = variable.valuesByMode[largestMode.modeId];
    if (!value) continue;

    // Check if we should skip this variable
    if (shouldSkipVariable(variable, value, outputtedCSSNames, errors)) {
      continue;
    }

    if (needsMediaQueries(variable, modes, options)) {
      mediaQueryVars.push(variable);
    } else {
      clampableVars.push(variable);

      // Check if this is a viewport-relative candidate (for UI display)
      // Only check FLOAT variables that have mode variance
      if (variable.resolvedType === 'FLOAT' && !value.isAlias && hasModeVariance(variable, modes, options)) {
        var reason = getViewportCandidateReason(variable);
        if (reason) {
          viewportCandidates.push({
            cssName: variable.cssName,
            originalName: variable.name,
            reason: reason
          });
        }

        // Check if this is a proportion candidate (for UI display)
        var columnCount = getProportionColumnCount(variable);
        if (columnCount !== null) {
          proportionCandidates.push({
            cssName: variable.cssName,
            originalName: variable.name,
            columnCount: columnCount
          });
        }

        // Check if this is a non-linear candidate (for UI display)
        // Skip proportion and viewport-relative variables — they're semantically different
        if (getProportionColumnCount(variable) === null && !getViewportCandidateReason(variable)) {
          var deviation = getNonLinearDeviation(variable, modes);
          if (deviation) {
            nonLinearCandidates.push({
              cssName: variable.cssName,
              originalName: variable.name,
              collectionId: variable.collectionId,
              collectionName: variable.collectionName,
              group: getVariableGroup(variable.name),
              deviationL: deviation.deviationL,
              deviationT: deviation.deviationT,
              maxDeviation: Math.max(deviation.deviationL, deviation.deviationT),
              desktopVal: deviation.desktopVal,
              laptopVal: deviation.laptopVal,
              laptopExpected: deviation.laptopExpected,
              tabletVal: deviation.tabletVal,
              tabletExpected: deviation.tabletExpected,
              mobileVal: deviation.mobileVal,
              modeValues: deviation.modeValues
            });
          }
        }
      }
    }
  }

  // Output :root with default mode values and clamp()/min() for numeric variables
  lines.push(':root {');

  for (var vi = 0; vi < clampableVars.length; vi++) {
    var variable = clampableVars[vi];
    var value = variable.valuesByMode[defaultMode.modeId];
    var cssValue = formatCSSValue(value, variable, options);

    if (cssValue !== null) {
      if (options.includeIds) {
        lines.push('  /* ' + variable.id + ' */');
      }

      // Check if this variable has different numeric values across modes
      if (hasModeVariance(variable, modes, options) && variable.resolvedType === 'FLOAT' && !value.isAlias) {
        // Check if this is a proportion variable
        if (shouldUseProportion(variable, options)) {
          var columnCount = getProportionColumnCount(variable);
          if (columnCount !== null) {
            proportionVars.push(variable.cssName);
            lines.push('  /* Proportion: ' + columnCount + '/12 columns (flex/grid-ready) */');
            lines.push('  ' + variable.cssName + ': ' + columnCount + ';');
            lines.push('  ' + variable.cssName + '--fr: ' + columnCount + 'fr;');
          } else {
            // Fallback if column count detection failed but user selected it
            lines.push('  ' + variable.cssName + ': ' + cssValue + ';');
          }
        } else if (shouldUsePiecewiseClamp(variable, options)) {
          // Piecewise clamp: Desktop→Laptop segment in :root
          nonLinearVars.push(variable.cssName);
          lines.push('  /* Piecewise clamp: non-linear scaling (3 segments) */');
          var piecewiseRootValue = generatePiecewiseClampValue(modes[0], modes[1], variable);
          lines.push('  ' + variable.cssName + ': ' + piecewiseRootValue + ';');
        } else {
          var fluidResult = generateFluidValue(modes, variable, options, viewportRelativeVars);
          // Add comment for viewport-relative variables
          if (fluidResult.isViewportRelative) {
            lines.push('  /* Viewport-relative: uses min() instead of clamp() */');
          }
          lines.push('  ' + variable.cssName + ': ' + fluidResult.value + ';');
        }
      } else {
        lines.push('  ' + variable.cssName + ': ' + cssValue + ';');
      }

      outputtedCSSNames.add(variable.cssName);
    }
  }

  // Also output default mode values for media query variables
  for (var vi = 0; vi < mediaQueryVars.length; vi++) {
    var variable = mediaQueryVars[vi];
    var value = variable.valuesByMode[defaultMode.modeId];
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

  // Output media queries for variables that need them (aliases with changing refs, non-numeric values)
  // These are OUTSIDE @supports because they're not fallbacks - they're the primary mechanism
  if (mediaQueryVars.length > 0) {
    if (isDesktopFirst) {
      // Desktop-first: iterate from second-largest to smallest, max-width
      for (var i = 1; i < modes.length; i++) {
        var mode = modes[i];
        var prevMode = modes[i - 1];

        var varsForThisBreakpoint: Array<{ variable: VariableInfo; cssValue: string }> = [];
        for (var vi = 0; vi < mediaQueryVars.length; vi++) {
          var variable = mediaQueryVars[vi];
          var val = variable.valuesByMode[mode.modeId];
          if (!val) continue;
          var cssValue = formatCSSValue(val, variable, options);
          if (cssValue === null) continue;
          varsForThisBreakpoint.push({ variable: variable, cssValue: cssValue });
        }

        if (varsForThisBreakpoint.length > 0) {
          lines.push('');
          lines.push('@media (max-width: ' + (prevMode.breakpointPx - 1) + 'px) {');
          lines.push('  :root {');
          for (var vi = 0; vi < varsForThisBreakpoint.length; vi++) {
            var item = varsForThisBreakpoint[vi];
            lines.push('    ' + item.variable.cssName + ': ' + item.cssValue + ';');
          }
          lines.push('  }');
          lines.push('}');
        }
      }
    } else {
      // Mobile-first: iterate from second-smallest to largest, min-width
      for (var i = modes.length - 2; i >= 0; i--) {
        var mode = modes[i];

        var varsForThisBreakpoint: Array<{ variable: VariableInfo; cssValue: string }> = [];
        for (var vi = 0; vi < mediaQueryVars.length; vi++) {
          var variable = mediaQueryVars[vi];
          var val = variable.valuesByMode[mode.modeId];
          if (!val) continue;
          var cssValue = formatCSSValue(val, variable, options);
          if (cssValue === null) continue;
          varsForThisBreakpoint.push({ variable: variable, cssValue: cssValue });
        }

        if (varsForThisBreakpoint.length > 0) {
          lines.push('');
          lines.push('@media (min-width: ' + mode.breakpointPx + 'px) {');
          lines.push('  :root {');
          for (var vi = 0; vi < varsForThisBreakpoint.length; vi++) {
            var item = varsForThisBreakpoint[vi];
            lines.push('    ' + item.variable.cssName + ': ' + item.cssValue + ';');
          }
          lines.push('  }');
          lines.push('}');
        }
      }
    }
  }

  // Piecewise clamp media queries for non-linear variables
  // These output intermediate clamp segments in @media blocks
  if (options.nonLinearOverrides && options.nonLinearOverrides.length > 0) {
    var piecewiseVars = clampableVars.filter(function(v) {
      return shouldUsePiecewiseClamp(v, options)
        && !shouldUseProportion(v, options)
        && !shouldUseViewportRelative(v, options)
        && hasModeVariance(v, modes, options)
        && v.resolvedType === 'FLOAT';
    });

    if (piecewiseVars.length > 0 && modes.length >= 3) {
      if (isDesktopFirst) {
        // Desktop-first: Laptop→Tablet segment, then Tablet→Mobile
        lines.push('');
        lines.push('/* Piecewise clamp: Laptop \u2192 Tablet segment */');
        lines.push('@media (max-width: ' + (modes[0].breakpointPx - 1) + 'px) {');
        lines.push('  :root {');
        for (var vi = 0; vi < piecewiseVars.length; vi++) {
          var v = piecewiseVars[vi];
          lines.push('    ' + v.cssName + ': ' + generatePiecewiseClampValue(modes[1], modes[2], v) + ';');
        }
        lines.push('  }');
        lines.push('}');

        if (modes.length >= 4) {
          lines.push('');
          lines.push('/* Piecewise clamp: Tablet \u2192 Mobile segment */');
          lines.push('@media (max-width: ' + (modes[1].breakpointPx - 1) + 'px) {');
          lines.push('  :root {');
          for (var vi = 0; vi < piecewiseVars.length; vi++) {
            var v = piecewiseVars[vi];
            lines.push('    ' + v.cssName + ': ' + generatePiecewiseClampValue(modes[2], modes[3], v) + ';');
          }
          lines.push('  }');
          lines.push('}');
        }
      } else {
        // Mobile-first: Tablet→Laptop segment, then Laptop→Desktop
        if (modes.length >= 4) {
          lines.push('');
          lines.push('/* Piecewise clamp: Tablet \u2192 Laptop segment */');
          lines.push('@media (min-width: ' + modes[2].breakpointPx + 'px) {');
          lines.push('  :root {');
          for (var vi = 0; vi < piecewiseVars.length; vi++) {
            var v = piecewiseVars[vi];
            lines.push('    ' + v.cssName + ': ' + generatePiecewiseClampValue(modes[2], modes[1], v) + ';');
          }
          lines.push('  }');
          lines.push('}');
        }

        lines.push('');
        lines.push('/* Piecewise clamp: Laptop \u2192 Desktop segment */');
        lines.push('@media (min-width: ' + modes[1].breakpointPx + 'px) {');
        lines.push('  :root {');
        for (var vi = 0; vi < piecewiseVars.length; vi++) {
          var v = piecewiseVars[vi];
          lines.push('    ' + v.cssName + ': ' + generatePiecewiseClampValue(modes[1], modes[0], v) + ';');
        }
        lines.push('  }');
        lines.push('}');
      }
    }
  }

  // Fallback media queries for clampable variables (for older browsers that don't support clamp/min)
  // Only include if option is enabled
  if (options.includeLegacyFallbacks) {
    var clampableWithVariance = clampableVars.filter(function(v) {
      return hasModeVariance(v, modes, options)
        && !shouldUseProportion(v, options)
        && !shouldUseViewportRelative(v, options);
    });

    if (clampableWithVariance.length > 0) {
      lines.push('');
      lines.push('/* Fallback for older browsers */');
      lines.push('@supports not (width: clamp(1px, 1vw, 2px)) {');

      if (isDesktopFirst) {
        for (var i = 1; i < modes.length; i++) {
          var mode = modes[i];
          var prevMode = modes[i - 1];

          lines.push('  @media (max-width: ' + (prevMode.breakpointPx - 1) + 'px) {');
          lines.push('    :root {');

          for (var vi = 0; vi < clampableWithVariance.length; vi++) {
            var variable = clampableWithVariance[vi];
            var val = variable.valuesByMode[mode.modeId];
            if (!val) continue;
            var cv = formatCSSValue(val, variable, options);
            if (cv !== null) {
              lines.push('      ' + variable.cssName + ': ' + cv + ';');
            }
          }

          lines.push('    }');
          lines.push('  }');
        }
      } else {
        for (var i = modes.length - 2; i >= 0; i--) {
          var mode = modes[i];

          lines.push('  @media (min-width: ' + mode.breakpointPx + 'px) {');
          lines.push('    :root {');

          for (var vi = 0; vi < clampableWithVariance.length; vi++) {
            var variable = clampableWithVariance[vi];
            var val = variable.valuesByMode[mode.modeId];
            if (!val) continue;
            var cv = formatCSSValue(val, variable, options);
            if (cv !== null) {
              lines.push('      ' + variable.cssName + ': ' + cv + ';');
            }
          }

          lines.push('    }');
          lines.push('  }');
        }
      }

      lines.push('}');
    }
  }

  return lines;
}

// Check if a variable is a candidate for viewport-relative treatment
// Returns the reason if it's a candidate, null otherwise
function getViewportCandidateReason(variable: VariableInfo): 'name' | 'description' | null {
  var nameLower = variable.name.toLowerCase();
  var descLower = variable.description.toLowerCase();
  if (nameLower.indexOf('viewport') !== -1) return 'name';
  if (descLower.indexOf('viewport') !== -1) return 'description';
  return null;
}

// Check if a variable should be treated as viewport-relative based on options
function shouldUseViewportRelative(variable: VariableInfo, options: ExportOptions): boolean {
  // If overrides are provided, use them exclusively
  if (options.viewportRelativeOverrides && options.viewportRelativeOverrides.length > 0) {
    return options.viewportRelativeOverrides.indexOf(variable.cssName) !== -1;
  }
  // Otherwise, no automatic detection - user must explicitly select
  return false;
}

// Keywords in variable names that indicate unitless numeric values (no px suffix)
// These CSS properties accept unitless numbers: font-weight, column-count, opacity,
// z-index, flex-grow/shrink, order, aspect-ratio, etc.
// NOTE: line-height is intentionally excluded — design systems typically define
// line-height in pixels (e.g., 38px from font-size × 1.5). A unitless CSS
// line-height of 38 would mean 38× the font-size, which is catastrophically wrong.
var UNITLESS_KEYWORDS: string[] = [
  'weight', 'column-count', 'column count', 'columncount',
  'opacity', 'z-index', 'zindex', 'z index',
  'order', 'flex-grow', 'flex-shrink', 'flex grow', 'flex shrink',
  'ratio', 'columns', 'rows', 'count'
];

// Check if a keyword appears as a complete segment in a name, not as a substring
// within a larger word. Segments are bounded by separators: - / . space or string edges.
// e.g., "order" matches "flex-order" and "z-order" but NOT "border-width"
// "ratio" matches "aspect-ratio" but NOT "decoration"
// "count" matches "column-count" but NOT "counter"
function matchesAsSegment(text: string, keyword: string): boolean {
  var pos = 0;
  while (pos <= text.length - keyword.length) {
    var idx = text.indexOf(keyword, pos);
    if (idx === -1) return false;
    var before = idx === 0 || '-/. '.indexOf(text.charAt(idx - 1)) !== -1;
    var afterIdx = idx + keyword.length;
    var after = afterIdx === text.length || '-/. '.indexOf(text.charAt(afterIdx)) !== -1;
    if (before && after) return true;
    pos = idx + 1;
  }
  return false;
}

// Check if a FLOAT variable should be exported without a unit (unitless number)
// Detection is by naming convention: if the variable name contains a unitless keyword
// as a complete segment (bounded by hyphens, slashes, dots, spaces, or string edges).
// This prevents false positives like "border" matching "order" or "decoration" matching "ratio".
function isUnitless(variable: VariableInfo): boolean {
  var nameLower = variable.name.toLowerCase();
  var cssNameLower = variable.cssName.toLowerCase();
  for (var i = 0; i < UNITLESS_KEYWORDS.length; i++) {
    if (matchesAsSegment(nameLower, UNITLESS_KEYWORDS[i]) || matchesAsSegment(cssNameLower, UNITLESS_KEYWORDS[i])) {
      return true;
    }
  }
  return false;
}

// CSS font-style keywords that should be output unquoted when found as STRING values
var FONT_STYLE_KEYWORDS: string[] = ['italic', 'oblique', 'normal'];

// Check if a STRING value is a CSS font-style keyword (should be output unquoted)
function isFontStyleValue(value: string): boolean {
  var lower = value.toLowerCase().trim();
  for (var i = 0; i < FONT_STYLE_KEYWORDS.length; i++) {
    if (lower === FONT_STYLE_KEYWORDS[i] || lower.indexOf('oblique ') === 0) {
      return true;
    }
  }
  return false;
}

// Proportion name to column count mapping (based on 12-column grid)
// IMPORTANT: Array is ordered from longest to shortest names to ensure
// "three-quarters" matches before "quarter", "two-thirds" before "third", etc.
// Each entry has multiple patterns to handle different naming conventions
// (hyphens, spaces, or concatenated)
var PROPORTION_COLUMNS: Array<{ patterns: string[]; columns: number }> = [
  { patterns: ['three-quarters', 'three quarters', 'threequarters', 'three-quarter', 'three quarter', 'threequarter'], columns: 9 },
  { patterns: ['two-thirds', 'two thirds', 'twothirds', 'two-third', 'two third', 'twothird'], columns: 8 },
  { patterns: ['quarter'], columns: 3 },
  { patterns: ['whole'], columns: 12 },
  { patterns: ['third'], columns: 4 },
  { patterns: ['half'], columns: 6 }
];

// Check if a variable is a candidate for proportion treatment
// Returns the column count if it's a proportion, null otherwise
function getProportionColumnCount(variable: VariableInfo): number | null {
  var nameLower = variable.name.toLowerCase();

  // Must contain "proportion" or "proportions" in the name
  if (nameLower.indexOf('proportion') === -1) return null;

  // Skip viewport-relative proportions (handled separately)
  if (nameLower.indexOf('viewport') !== -1) return null;

  // Check for known proportion names (array is ordered longest-first to avoid
  // substring conflicts like "quarter" matching before "three-quarters")
  for (var i = 0; i < PROPORTION_COLUMNS.length; i++) {
    var prop = PROPORTION_COLUMNS[i];
    for (var j = 0; j < prop.patterns.length; j++) {
      if (nameLower.indexOf(prop.patterns[j]) !== -1) {
        return prop.columns;
      }
    }
  }

  return null;
}

// Check if a variable should be treated as a proportion
// Proportions are always-on: any variable with a detectable proportion name outputs as grid/flex values
function shouldUseProportion(variable: VariableInfo, options: ExportOptions): boolean {
  return getProportionColumnCount(variable) !== null;
}

// Non-linear detection: any numeric variable with at least one mode value
// that differs from another is a candidate for piecewise clamp scaling.
// No threshold — the user decides which variables to opt-in via the UI.

function getNonLinearDeviation(
  variable: VariableInfo,
  modes: Array<{ modeId: string; name: string; breakpointPx: number }>
): { deviationL: number; deviationT: number; desktopVal: number; laptopVal: number; laptopExpected: number; tabletVal: number; tabletExpected: number; mobileVal: number; modeValues: Array<{ name: string; value: number; breakpointPx: number }> } | null {
  // Need at least 2 modes
  if (modes.length < 2) return null;

  // Must be FLOAT with no aliases across all modes
  if (variable.resolvedType !== 'FLOAT') return null;

  var modeValues: Array<{ name: string; value: number; breakpointPx: number }> = [];
  for (var i = 0; i < modes.length; i++) {
    var val = variable.valuesByMode[modes[i].modeId];
    if (!val || val.isAlias) return null;
    if (typeof val.resolved !== 'number') return null;
    modeValues.push({ name: modes[i].name, value: val.resolved as number, breakpointPx: modes[i].breakpointPx });
  }

  // Skip if all mode values are identical (no scaling)
  var allSame = true;
  for (var i = 1; i < modeValues.length; i++) {
    if (modeValues[i].value !== modeValues[0].value) {
      allSame = false;
      break;
    }
  }
  if (allSame) return null;

  // Extract values for backward-compatible fields
  var dVal = modeValues[0].value;
  var mVal = modeValues[modeValues.length - 1].value;
  var lVal = modeValues.length >= 2 ? modeValues[1].value : dVal;
  var tVal = modeValues.length >= 3 ? modeValues[2].value : mVal;

  // Calculate deviation data (for 4-mode case, used by visualization)
  var deviationL = 0;
  var deviationT = 0;
  var laptopExpected = lVal;
  var tabletExpected = tVal;

  if (modes.length >= 4 && dVal !== mVal) {
    var dVP = modes[0].breakpointPx;
    var lVP = modes[1].breakpointPx;
    var tVP = modes[2].breakpointPx;
    var mVP = modes[3].breakpointPx;
    var slope = (dVal - mVal) / (dVP - mVP);
    laptopExpected = mVal + slope * (lVP - mVP);
    tabletExpected = mVal + slope * (tVP - mVP);
    var range = Math.abs(dVal - mVal);
    if (range > 0) {
      deviationL = Math.abs(lVal - laptopExpected) / range;
      deviationT = Math.abs(tVal - tabletExpected) / range;
    }
  }

  return {
    deviationL: deviationL,
    deviationT: deviationT,
    desktopVal: dVal,
    laptopVal: lVal,
    laptopExpected: laptopExpected,
    tabletVal: tVal,
    tabletExpected: tabletExpected,
    mobileVal: mVal,
    modeValues: modeValues
  };
}

function shouldUsePiecewiseClamp(variable: VariableInfo, options: ExportOptions): boolean {
  if (options.nonLinearOverrides && options.nonLinearOverrides.length > 0) {
    return options.nonLinearOverrides.indexOf(variable.cssName) !== -1;
  }
  return false;
}

// Generate a clamp() value for a single segment between two adjacent breakpoints
function generatePiecewiseClampValue(
  fromMode: { modeId: string; name: string; breakpointPx: number },
  toMode: { modeId: string; name: string; breakpointPx: number },
  variable: VariableInfo
): string {
  var fromVal = variable.valuesByMode[fromMode.modeId];
  var toVal = variable.valuesByMode[toMode.modeId];

  var fromValue = fromVal ? fromVal.resolved : null;
  var toValue = toVal ? toVal.resolved : null;

  var unitless = isUnitless(variable);
  var unit = unitless ? '' : 'px';

  if (typeof fromValue !== 'number' || typeof toValue !== 'number') {
    return fromValue + unit;
  }

  if (fromValue === toValue) {
    return round(fromValue, 2) + unit;
  }

  var fromVP = fromMode.breakpointPx;
  var toVP = toMode.breakpointPx;

  var slope = (fromValue - toValue) / (fromVP - toVP);
  var intercept = toValue - slope * toVP;

  var slopeVW = round(slope * 100, 4);
  var interceptPx = round(intercept, 2);

  var minPx = round(Math.min(fromValue, toValue), 2);
  var maxPx = round(Math.max(fromValue, toValue), 2);

  var preferred: string;
  if (interceptPx >= 0) {
    preferred = interceptPx + unit + ' + ' + slopeVW + 'vw';
  } else {
    preferred = slopeVW + 'vw - ' + Math.abs(interceptPx) + unit;
  }

  return 'clamp(' + minPx + unit + ', calc(' + preferred + '), ' + maxPx + unit + ')';
}

// Generate CSS value for a variable - either clamp() or min() for viewport-relative
function generateFluidValue(
  modes: Array<{ modeId: string; name: string; breakpointPx: number }>,
  variable: VariableInfo,
  options: ExportOptions,
  viewportRelativeVars: string[]
): { value: string; isViewportRelative: boolean } {
  var maxMode = modes[0];
  var minMode = modes[modes.length - 1];

  var maxVal = variable.valuesByMode[maxMode.modeId];
  var minVal = variable.valuesByMode[minMode.modeId];

  var maxValue = maxVal ? maxVal.resolved : null;
  var minValue = minVal ? minVal.resolved : null;

  // Determine unit suffix — unitless variables (font-weight, count, etc.) get no unit
  var unitless = isUnitless(variable);
  var unit = unitless ? '' : 'px';

  if (typeof maxValue !== 'number' || typeof minValue !== 'number') {
    return { value: maxValue + unit, isViewportRelative: false };
  }

  // Check if this variable should use viewport-relative formula
  if (shouldUseViewportRelative(variable, options)) {
    // Track this variable for reporting
    viewportRelativeVars.push(variable.cssName);
    // Use min(100vw, maxValue) - the container should be 100% of viewport up to max
    return {
      value: 'min(100vw, ' + round(maxValue, 2) + unit + ')',
      isViewportRelative: true
    };
  }

  // If unitless and values are equal across breakpoints, just output the value
  if (unitless && maxValue === minValue) {
    return { value: String(round(maxValue, 2)), isViewportRelative: false };
  }

  // Standard clamp() interpolation
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
    preferred = interceptPx + unit + ' + ' + slopeVW + 'vw';
  } else {
    preferred = slopeVW + 'vw - ' + Math.abs(interceptPx) + unit;
  }

  return {
    value: 'clamp(' + minPx + unit + ', calc(' + preferred + '), ' + maxPx + unit + ')',
    isViewportRelative: false
  };
}

// Legacy function for backward compatibility - delegates to generateFluidValue
function generateClamp(
  modes: Array<{ modeId: string; name: string; breakpointPx: number }>,
  variable: VariableInfo,
  options: ExportOptions
): string {
  var dummyTracker: string[] = [];
  return generateFluidValue(modes, variable, options, dummyTracker).value;
}

function generateSteppedCSS(
  modes: Array<{ modeId: string; name: string; breakpointPx: number }>,
  variables: VariableInfo[],
  options: ExportOptions,
  outputtedCSSNames: Set<string>,
  errors: string[]
): string[] {
  var lines: string[] = [];

  // Direction: mobile-first uses smallest breakpoint as default, desktop-first uses largest
  var isDesktopFirst = options.breakpointDirection !== 'mobile-first';
  var defaultMode = isDesktopFirst ? modes[0] : modes[modes.length - 1];

  lines.push(':root {');

  for (var vi = 0; vi < variables.length; vi++) {
    var variable = variables[vi];
    var value = variable.valuesByMode[defaultMode.modeId];
    if (!value) continue;

    // Check if we should skip this variable
    if (shouldSkipVariable(variable, value, outputtedCSSNames, errors)) {
      continue;
    }

    // Proportions always output as grid/flex values, even in fixed mode
    if (shouldUseProportion(variable, options)) {
      var columnCount = getProportionColumnCount(variable);
      if (columnCount !== null) {
        if (options.includeIds) {
          lines.push('  /* ' + variable.id + ' */');
        }
        lines.push('  /* Proportion: ' + columnCount + '/12 columns (flex/grid-ready) */');
        lines.push('  ' + variable.cssName + ': ' + columnCount + ';');
        lines.push('  ' + variable.cssName + '--fr: ' + columnCount + 'fr;');
        outputtedCSSNames.add(variable.cssName);
        continue;
      }
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

  if (isDesktopFirst) {
    // Desktop-first: iterate from second-largest to smallest, max-width
    for (var i = 1; i < modes.length; i++) {
      var mode = modes[i];
      var prevMode = modes[i - 1];

      lines.push('');
      lines.push('@media (max-width: ' + (prevMode.breakpointPx - 1) + 'px) {');
      lines.push('  :root {');

      for (var vi = 0; vi < variables.length; vi++) {
        var variable = variables[vi];
        if (shouldUseProportion(variable, options)) continue;
        var value = variable.valuesByMode[mode.modeId];
        if (!value) continue;
        if (!outputtedCSSNames.has(variable.cssName)) continue;
        var cssValue = formatCSSValue(value, variable, options);
        if (cssValue !== null) {
          lines.push('    ' + variable.cssName + ': ' + cssValue + ';');
        }
      }

      lines.push('  }');
      lines.push('}');
    }
  } else {
    // Mobile-first: iterate from second-smallest to largest, min-width
    for (var i = modes.length - 2; i >= 0; i--) {
      var mode = modes[i];

      lines.push('');
      lines.push('@media (min-width: ' + mode.breakpointPx + 'px) {');
      lines.push('  :root {');

      for (var vi = 0; vi < variables.length; vi++) {
        var variable = variables[vi];
        if (shouldUseProportion(variable, options)) continue;
        var value = variable.valuesByMode[mode.modeId];
        if (!value) continue;
        if (!outputtedCSSNames.has(variable.cssName)) continue;
        var cssValue = formatCSSValue(value, variable, options);
        if (cssValue !== null) {
          lines.push('    ' + variable.cssName + ': ' + cssValue + ';');
        }
      }

      lines.push('  }');
      lines.push('}');
    }
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

  // Generate :root with default (light) mode
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

  // If we have both light and dark modes, generate all theme CSS
  if (darkMode && lightMode) {
    var usePrefersColorScheme = options.darkModeOutput === 'prefers-color-scheme' || options.darkModeOutput === 'both';
    var useClass = options.darkModeOutput === 'class' || options.darkModeOutput === 'both';

    // Generate @media (prefers-color-scheme: light) for explicit light mode
    if (usePrefersColorScheme) {
      lines.push('');
      lines.push('@media (prefers-color-scheme: light) {');
      lines.push('  :root {');

      for (var vi = 0; vi < variables.length; vi++) {
        var variable = variables[vi];
        var lightValue = variable.valuesByMode[lightMode.modeId];

        if (!lightValue) continue;

        // Only output if this variable was in the main :root block
        if (!outputtedCSSNames.has(variable.cssName)) continue;

        var lightCss = formatCSSValue(lightValue, variable, options);

        // Output ALL values to ensure complete token chain
        // Even if light === dark, the variable must be declared for alias resolution
        if (lightCss !== null) {
          lines.push('    ' + variable.cssName + ': ' + lightCss + ';');
        }
      }

      lines.push('  }');
      lines.push('}');
    }

    // Generate @media (prefers-color-scheme: dark)
    if (usePrefersColorScheme) {
      lines.push('');
      lines.push('@media (prefers-color-scheme: dark) {');
      lines.push('  :root {');

      for (var vi = 0; vi < variables.length; vi++) {
        var variable = variables[vi];
        var darkValue = variable.valuesByMode[darkMode.modeId];

        if (!darkValue) continue;

        // Only output if this variable was in the main :root block
        if (!outputtedCSSNames.has(variable.cssName)) continue;

        var darkCss = formatCSSValue(darkValue, variable, options);

        // Output ALL values to ensure complete token chain
        // Even if light === dark, the variable must be declared for alias resolution
        if (darkCss !== null) {
          lines.push('    ' + variable.cssName + ': ' + darkCss + ';');
        }
      }

      lines.push('  }');
      lines.push('}');
    }

    // Generate explicit theme selectors for manual switching
    lines.push('');
    lines.push('/* Explicit theme selectors - These override system preferences');
    lines.push('   and enable manual theme switching via JavaScript */');

    // Generate [data-theme="light"]
    lines.push('[data-theme="light"] {');

    for (var vi = 0; vi < variables.length; vi++) {
      var variable = variables[vi];
      var lightValue = variable.valuesByMode[lightMode.modeId];

      if (!lightValue) continue;

      // Only output if this variable was in the main :root block
      if (!outputtedCSSNames.has(variable.cssName)) continue;

      var lightCss = formatCSSValue(lightValue, variable, options);

      // Output ALL values to ensure complete token chain
      // Even if light === dark, the variable must be declared for alias resolution
      if (lightCss !== null) {
        lines.push('  ' + variable.cssName + ': ' + lightCss + ';');
      }
    }

    lines.push('}');

    // Generate [data-theme="dark"] only if useClass is true
    if (useClass) {
      lines.push('');
      lines.push('[data-theme="dark"] {');

      for (var vi = 0; vi < variables.length; vi++) {
        var variable = variables[vi];
        var darkValue = variable.valuesByMode[darkMode.modeId];

        if (!darkValue) continue;

        // Only output if this variable was in the main :root block
        if (!outputtedCSSNames.has(variable.cssName)) continue;

        var darkCss = formatCSSValue(darkValue, variable, options);

        // Output ALL values to ensure complete token chain
        // Even if light === dark, the variable must be declared for alias resolution
        if (darkCss !== null) {
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
    var rounded = round(value.resolved as number, 2);
    if (isUnitless(variable)) {
      return String(rounded);
    }
    return rounded + 'px';
  } else if (variable.resolvedType === 'STRING') {
    // Font-style keywords (italic, oblique, normal) should be unquoted in CSS
    if (typeof value.resolved === 'string' && isFontStyleValue(value.resolved)) {
      return value.resolved.toLowerCase().trim();
    }
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

// ============================================
// TEXT STYLE EXPORT (FEAT-04)
// ============================================

// Slugify a Figma text style name to a CSS-safe identifier
// e.g., "Short-form/Heading/Heading 1" → "heading-heading-1"
function generateTextStyleName(styleName: string): string {
  // Remove common prefixes like "Short-form/" or "Long-form/"
  var cleaned = styleName
    .replace(/^(?:Short-form|Long-form|SF|LF)\s*\/\s*/i, '');

  return cleaned
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Map Figma font style name to CSS numeric font-weight
function figmaStyleToWeight(styleName: string): number {
  var lower = styleName.toLowerCase();
  if (lower.indexOf('thin') !== -1 || lower.indexOf('hairline') !== -1) return 100;
  if (lower.indexOf('extralight') !== -1 || lower.indexOf('ultralight') !== -1) return 200;
  if (lower.indexOf('light') !== -1) return 300;
  if (lower.indexOf('medium') !== -1) return 500;
  if (lower.indexOf('semibold') !== -1 || lower.indexOf('demibold') !== -1) return 600;
  if (lower.indexOf('extrabold') !== -1 || lower.indexOf('ultrabold') !== -1) return 800;
  if (lower.indexOf('bold') !== -1) return 700;
  if (lower.indexOf('black') !== -1 || lower.indexOf('heavy') !== -1) return 900;
  return 400; // Regular/Normal
}

// Extract raw CSS value from a text style property
function formatRawTextProperty(style: TextStyle, property: string): string {
  switch (property) {
    case 'fontFamily':
      return '"' + style.fontName.family + '"';
    case 'fontSize':
      return round(style.fontSize, 2) + 'px';
    case 'fontWeight':
      return String(figmaStyleToWeight(style.fontName.style));
    case 'fontStyle':
      return style.fontName.style.toLowerCase().indexOf('italic') !== -1 ? 'italic' : 'normal';
    case 'lineHeight': {
      var lh = style.lineHeight as { readonly unit: string; readonly value: number };
      if (lh.unit === 'PIXELS') {
        return round(lh.value, 2) + 'px';
      } else if (lh.unit === 'PERCENT') {
        return round(lh.value / 100, 2).toFixed(2);
      }
      return 'normal';
    }
    case 'letterSpacing': {
      var ls = style.letterSpacing as { readonly unit: string; readonly value: number };
      if (ls.unit === 'PIXELS') {
        return round(ls.value, 2) + 'px';
      } else if (ls.unit === 'PERCENT') {
        return round(ls.value / 100, 3).toFixed(3) + 'em';
      }
      return '0px';
    }
    default:
      return '';
  }
}

// Resolve a text style property to a var() reference if bound to a variable, else raw value
// NOTE: Fallback values are intentionally omitted from var() references because the bound
// variable is typically responsive (different values per breakpoint via clamp() or @media).
// A static fallback like "20px" would be incorrect when the variable resolves to different
// values across viewports. The var() reference alone is correct — if the variable is missing,
// the browser's inherited/initial value is a safer fallback than a wrong static value.
function resolveTextStyleProperty(
  style: TextStyle,
  property: string,
  variableMap: Map<string, VariableInfo>
): { value: string; varRef: string | null } {
  var boundVars = (style as any).boundVariables;
  if (boundVars && boundVars[property]) {
    var binding = boundVars[property];
    var varId: string | null = null;
    if (typeof binding === 'object' && binding !== null && 'id' in binding) {
      varId = (binding as any).id;
    }
    if (varId) {
      var varInfo = variableMap.get(varId);
      if (varInfo) {
        return { value: formatRawTextProperty(style, property), varRef: 'var(' + varInfo.cssName + ')' };
      }
    }
  }

  return { value: formatRawTextProperty(style, property), varRef: null };
}

// Generate the text styles CSS section
async function generateTextStyleCSS(
  options: ExportOptions,
  variableMap: Map<string, VariableInfo>
): Promise<string[]> {
  var lines: string[] = [];
  var textStyles = await figma.getLocalTextStylesAsync();

  if (textStyles.length === 0) return lines;

  lines.push('/* --------------------------------------------------------------------------');
  lines.push('   TEXT STYLES — Composite typography tokens from Figma Text Styles');
  lines.push('   Format: ' + (options.textStyleFormat === 'scss-mixin' ? 'SCSS Mixins' : options.textStyleFormat === 'css-class' ? 'CSS Classes' : 'CSS Custom Properties'));
  lines.push('   -------------------------------------------------------------------------- */');
  lines.push('');

  // For CSS vars format, wrap in :root
  if (options.textStyleFormat === 'css-vars') {
    lines.push(':root {');
  }

  for (var i = 0; i < textStyles.length; i++) {
    var style = textStyles[i];
    var cssName = generateTextStyleName(style.name);

    var family = resolveTextStyleProperty(style, 'fontFamily', variableMap);
    var size = resolveTextStyleProperty(style, 'fontSize', variableMap);
    var weight = resolveTextStyleProperty(style, 'fontWeight', variableMap);
    var fontStyle = resolveTextStyleProperty(style, 'fontStyle', variableMap);
    var lineHeight = resolveTextStyleProperty(style, 'lineHeight', variableMap);
    var letterSpacing = resolveTextStyleProperty(style, 'letterSpacing', variableMap);

    var familyVal = family.varRef || family.value;
    var sizeVal = size.varRef || size.value;
    var weightVal = weight.varRef || weight.value;
    var fontStyleVal = fontStyle.varRef || fontStyle.value;
    var lineHeightVal = lineHeight.varRef || lineHeight.value;
    var letterSpacingVal = letterSpacing.varRef || letterSpacing.value;

    if (options.textStyleFormat === 'scss-mixin') {
      lines.push('@mixin ' + cssName + ' {');
      lines.push('  font-family: ' + familyVal + ';');
      lines.push('  font-size: ' + sizeVal + ';');
      lines.push('  font-style: ' + fontStyleVal + ';');
      lines.push('  font-weight: ' + weightVal + ';');
      lines.push('  line-height: ' + lineHeightVal + ';');
      lines.push('  letter-spacing: ' + letterSpacingVal + ';');
      lines.push('}');

    } else if (options.textStyleFormat === 'css-class') {
      lines.push('.' + cssName + ' {');
      lines.push('  font-family: ' + familyVal + ';');
      lines.push('  font-size: ' + sizeVal + ';');
      lines.push('  font-style: ' + fontStyleVal + ';');
      lines.push('  font-weight: ' + weightVal + ';');
      lines.push('  line-height: ' + lineHeightVal + ';');
      lines.push('  letter-spacing: ' + letterSpacingVal + ';');
      lines.push('}');

    } else if (options.textStyleFormat === 'css-vars') {
      lines.push('  --' + cssName + '-family: ' + familyVal + ';');
      lines.push('  --' + cssName + '-size: ' + sizeVal + ';');
      lines.push('  --' + cssName + '-style: ' + fontStyleVal + ';');
      lines.push('  --' + cssName + '-weight: ' + weightVal + ';');
      lines.push('  --' + cssName + '-line-height: ' + lineHeightVal + ';');
      lines.push('  --' + cssName + '-letter-spacing: ' + letterSpacingVal + ';');
    }

    lines.push('');
  }

  // Close :root for CSS vars format
  if (options.textStyleFormat === 'css-vars') {
    lines.push('}');
  }

  return lines;
}
