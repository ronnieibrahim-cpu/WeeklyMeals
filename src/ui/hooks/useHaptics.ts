import { Platform, Vibration } from 'react-native';

/**
 * Light haptic tick for check-off/lock/rate actions. Built on the `Vibration`
 * API already used by cook mode's timer (no new dependency, e.g. expo-haptics,
 * needed for a single short pulse) — no-ops safely on web, where `Vibration`
 * isn't supported.
 */
export function useHaptics() {
  const light = () => {
    if (Platform.OS === 'web') return;
    Vibration.vibrate(10);
  };
  return { light };
}
