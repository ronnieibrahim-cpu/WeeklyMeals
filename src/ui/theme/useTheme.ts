import { useContext } from 'react';

import { ThemeContext } from './ThemeProvider';

/** Access the active theme (colors, spacing, radius, typography). */
export function useTheme() {
  return useContext(ThemeContext);
}
