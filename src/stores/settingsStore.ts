import { create } from 'zustand';

/** How the app picks light vs. dark: follow the OS, or force one. */
export type ThemePreference = 'system' | 'light' | 'dark';

interface SettingsState {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

/**
 * App-wide settings. In-memory for now; persistence is wired through the
 * data layer (repository) in a later step without changing this interface.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  themePreference: 'system',
  setThemePreference: (themePreference) => set({ themePreference }),
}));
