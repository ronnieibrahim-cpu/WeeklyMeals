import { AppSettings, SettingsRepository } from '../SettingsRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:settings:v1';

// Same key as before: older saves hold only `themePreference`, and the
// missing `hebListEmail` simply reads as "off".
export class LocalSettingsRepository implements SettingsRepository {
  async load(): Promise<Partial<AppSettings> | null> {
    const stored = await kvStore.getJSON<Partial<AppSettings>>(KEY);
    if (!stored || typeof stored !== 'object') return null;
    return stored;
  }

  save(settings: AppSettings): Promise<void> {
    return kvStore.setJSON<AppSettings>(KEY, settings);
  }
}

export const localSettingsRepository = new LocalSettingsRepository();
