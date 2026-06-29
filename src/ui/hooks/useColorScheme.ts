import { ColorSchemeName, useColorScheme as useRNColorScheme } from 'react-native';

/** Native color scheme. The web variant (.web.ts) handles static-render hydration. */
export function useColorScheme(): ColorSchemeName {
  return useRNColorScheme();
}
