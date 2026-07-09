import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny JSON key-value wrapper over AsyncStorage. Works on native (iOS) and
 * web (IndexedDB/localStorage). The single place the app touches device storage,
 * so swapping to a cloud backend later means changing only this file's callers.
 */
export const kvStore = {
  /**
   * `isValid`, when passed, guards against valid-JSON-but-wrong-shape data
   * (a corrupt/partial write, or a manual storage edit) the same way the
   * JSON.parse try/catch already guards against unparseable data — treated
   * as "no data" rather than reaching a screen that assumes the shape and
   * throws (P2-3).
   */
  async getJSON<T>(key: string, isValid?: (value: unknown) => value is T): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (isValid && !isValid(parsed)) return null;
    return parsed as T;
  },

  async setJSON<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
