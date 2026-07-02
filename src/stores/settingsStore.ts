import { create } from 'zustand';

import { localSettingsRepository } from '@/data/repositories/local/LocalSettingsRepository';
import { ThemePreference } from '@/data/repositories/SettingsRepository';

export type { ThemePreference };

interface SettingsState {
  themePreference: ThemePreference;
  hydrated: boolean;
  init: () => Promise<void>;
  setThemePreference: (preference: ThemePreference) => void;
}

/** App-wide settings, persisted via SettingsRepository (kvStore key `wm:settings:v1`). */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  themePreference: 'system',
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const themePreference = (await localSettingsRepository.load()) ?? 'system';
    set({ themePreference, hydrated: true });
  },

  setThemePreference: (themePreference) => {
    set({ themePreference });
    void localSettingsRepository.save(themePreference);
  },
}));
