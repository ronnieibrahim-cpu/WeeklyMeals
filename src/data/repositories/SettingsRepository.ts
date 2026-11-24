/** How the app picks light vs. dark: follow the OS, or force one. */
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * App-wide, this-device-only settings. Never synced to the household: the
 * list-email address is personal, and this repo is public, so it must live
 * only in device storage, never in code.
 */
export interface AppSettings {
  themePreference: ThemePreference;
  /** Where "Approve this week" offers to email the H-E-B list. Empty = off. */
  hebListEmail: string;
}

/** Persistence boundary for app-wide settings. */
export interface SettingsRepository {
  load(): Promise<Partial<AppSettings> | null>;
  save(settings: AppSettings): Promise<void>;
}
