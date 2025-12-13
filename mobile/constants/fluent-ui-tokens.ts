/**
 * Fluent UI Design Tokens
 * Based on Microsoft Fluent UI Design System
 * https://fluent2.microsoft.design/
 */

// Fluent UI Color Palette
export const FluentColors = {
  // Brand colors
  brand: {
    primary: '#0078D4', // Fluent Blue
    primaryHover: '#106EBE',
    primaryPressed: '#005A9E',
    primaryDisabled: '#C8E6F5',
    secondary: '#605E5C',
    tertiary: '#A19F9D',
  },
  
  // Neutral colors
  neutral: {
    white: '#FFFFFF',
    black: '#000000',
    gray2: '#FAF9F8',
    gray4: '#F3F2F1',
    gray6: '#EDEBE9',
    gray8: '#E1DFDD',
    gray10: '#D2D0CE',
    gray12: '#C8C6C4',
    gray14: '#B3B0AD',
    gray16: '#A19F9D',
    gray18: '#8A8886',
    gray20: '#797775',
    gray22: '#605E5C',
    gray24: '#484644',
    gray26: '#323130',
    gray28: '#201F1E',
    gray30: '#11100F',
  },
  
  // Semantic colors
  semantic: {
    success: '#107C10',
    successBackground: '#DFF6DD',
    warning: '#FFAA44',
    warningBackground: '#FFF4CE',
    error: '#D13438',
    errorBackground: '#FDE7E9',
    info: '#0078D4',
    infoBackground: '#DEECF9',
  },
  
  // Text colors
  text: {
    primary: '#323130',
    secondary: '#605E5C',
    disabled: '#A19F9D',
    inverse: '#FFFFFF',
    brand: '#0078D4',
  },
  
  // Border colors
  border: {
    default: '#EDEBE9',
    hover: '#C8C6C4',
    focus: '#0078D4',
    disabled: '#F3F2F1',
  },
  
  // Background colors
  background: {
    default: '#FFFFFF',
    secondary: '#FAF9F8',
    tertiary: '#F3F2F1',
    hover: '#F3F2F1',
    pressed: '#EDEBE9',
    disabled: '#F3F2F1',
  },
};

// Fluent UI Spacing Scale (4px base unit)
export const FluentSpacing = {
  none: 0,
  xxs: 2,   // 0.5 * 4
  xs: 4,    // 1 * 4
  s: 8,     // 2 * 4
  m: 12,    // 3 * 4
  l: 16,    // 4 * 4
  xl: 20,   // 5 * 4
  xxl: 24,  // 6 * 4
  xxxl: 32, // 8 * 4
  xxxxl: 40, // 10 * 4
  xxxxxl: 48, // 12 * 4
};

// Fluent UI Typography
export const FluentTypography = {
  fontFamily: {
    base: 'Segoe UI, system-ui, -apple-system, sans-serif',
    monospace: 'Consolas, Courier New, monospace',
  },
  
  fontSize: {
    base: 14,
    small: 12,
    medium: 14,
    large: 16,
    xlarge: 18,
    xxlarge: 20,
    xxxlarge: 24,
    xxxxlarge: 28,
    xxxxxlarge: 32,
  },
  
  fontWeight: {
    regular: '400' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  
  lineHeight: {
    base: 20,
    small: 16,
    medium: 20,
    large: 24,
    xlarge: 28,
    xxlarge: 32,
  },
};

// Fluent UI Border Radius
export const FluentBorderRadius = {
  none: 0,
  small: 2,
  medium: 4,
  large: 8,
  xlarge: 12,
  round: 9999,
};

// Fluent UI Shadows (elevation)
export const FluentShadows = {
  none: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Fluent UI Animation Durations
export const FluentAnimations = {
  durationUltraFast: 50,
  durationFaster: 100,
  durationFast: 150,
  durationNormal: 200,
  durationSlow: 300,
  durationSlower: 400,
  durationUltraSlow: 500,
};

// Fluent UI Component Tokens
export const FluentComponents = {
  button: {
    minHeight: 32,
    paddingHorizontal: FluentSpacing.l,
    paddingVertical: FluentSpacing.s,
    borderRadius: FluentBorderRadius.medium,
    fontSize: FluentTypography.fontSize.medium,
    fontWeight: FluentTypography.fontWeight.semibold,
  },
  
  textInput: {
    minHeight: 32,
    paddingHorizontal: FluentSpacing.m,
    paddingVertical: FluentSpacing.s,
    borderRadius: FluentBorderRadius.medium,
    fontSize: FluentTypography.fontSize.medium,
    borderWidth: 1,
  },
  
  card: {
    borderRadius: FluentBorderRadius.large,
    padding: FluentSpacing.l,
    backgroundColor: FluentColors.background.default,
  },
};
