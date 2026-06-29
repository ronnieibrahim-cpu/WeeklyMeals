import { useEffect, useState } from 'react';
import { ColorSchemeName, useColorScheme as useRNColorScheme } from 'react-native';

/**
 * On web with static rendering the color scheme must be recomputed on the client
 * after hydration, otherwise the server-rendered markup mismatches.
 */
export function useColorScheme(): ColorSchemeName {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();
  return hasHydrated ? colorScheme : 'light';
}
