import { spacing, radius, Spacing, Radius } from './tokens';
import { lightColors, darkColors, ThemeColors } from './colors';
import { typography, Typography } from './typography';

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: Spacing;
  radius: Radius;
  typography: Typography;
}

/** Build a complete theme object for the given resolved mode. */
export function createTheme(mode: ThemeMode): Theme {
  return {
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    typography,
  };
}
