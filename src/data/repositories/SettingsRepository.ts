/** How the app picks light vs. dark: follow the OS, or force one. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Persistence boundary for app-wide settings (currently just theme preference). */
export interface SettingsRepository {
  load(): Promise<ThemePreference | null>;
  save(themePreference: ThemePreference): Promise<void>;
}
