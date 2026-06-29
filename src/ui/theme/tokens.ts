/**
 * Mode-independent design tokens: the raw spacing and radius scales.
 * Colors and typography live in their own modules and combine with these in createTheme().
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
