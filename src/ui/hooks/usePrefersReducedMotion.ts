import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Whether the user has asked for reduced motion — the OS setting on native,
 * the `prefers-reduced-motion` media query on web. Defaults to false until
 * the platform reports otherwise, then stays live if the setting changes.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduced(query.matches);
      const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
      query.addEventListener('change', listener);
      return () => query.removeEventListener('change', listener);
    }

    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduced(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
