import { createContext, ReactNode, useMemo } from 'react';

import { useSettingsStore } from '@/stores/settingsStore';
import { useColorScheme } from '@/ui/hooks/useColorScheme';

import { createTheme, Theme, ThemeMode } from './createTheme';

export const ThemeContext = createContext<Theme>(createTheme('light'));

/**
 * Resolves the active theme from the user's preference + the OS color scheme,
 * and provides it to the whole tree. Re-renders only when the resolved mode changes.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useSettingsStore((s) => s.themePreference);

  const mode: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const theme = useMemo(() => createTheme(mode), [mode]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
