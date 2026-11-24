import { create } from 'zustand';

import { localSettingsRepository } from '@/data/repositories/local/LocalSettingsRepository';
import { ThemePreference } from '@/data/repositories/SettingsRepository';

export type { ThemePreference };

interface SettingsState {
  themePreference: ThemePreference;
  /** This device only — see AppSettings. Empty string means the feature is off. */
  hebListEmail: string;
  hydrated: boolean;
  init: () => Promise<void>;
  setThemePreference: (preference: ThemePreference) => void;
  setHebListEmail: (address: string) => void;
}

/** App-wide settings, persisted via SettingsRepository (kvStore key `wm:settings:v1`). */
export const useSettingsStore = create<SettingsState>((set, get) => {
  const persist = () => {
    const { themePreference, hebListEmail } = get();
    void localSettingsRepository.save({ themePreference, hebListEmail });
  };

  return {
    themePreference: 'system',
    hebListEmail: '',
    hydrated: false,

    init: async () => {
      if (get().hydrated) return;
      const stored = await localSettingsRepository.load();
      const themePreference =
        stored?.themePreference === 'light' || stored?.themePreference === 'dark' ? stored.themePreference : 'system';
      const hebListEmail = typeof stored?.hebListEmail === 'string' ? stored.hebListEmail : '';
      set({ themePreference, hebListEmail, hydrated: true });
    },

    setThemePreference: (themePreference) => {
      set({ themePreference });
      persist();
    },

    setHebListEmail: (address) => {
      set({ hebListEmail: address.trim() });
      persist();
    },
  };
});
