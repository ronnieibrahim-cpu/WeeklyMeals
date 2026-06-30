import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny JSON key-value wrapper over AsyncStorage. Works on native (iOS) and
 * web (IndexedDB/localStorage). The single place the app touches device storage,
 * so swapping to a cloud backend later means changing only this file's callers.
 */
export const kvStore = {
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJSON<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
