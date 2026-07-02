import { SettingsRepository, ThemePreference } from '../SettingsRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:settings:v1';

interface StoredSettings {
  themePreference: ThemePreference;
}

export class LocalSettingsRepository implements SettingsRepository {
  async load(): Promise<ThemePreference | null> {
    const stored = await kvStore.getJSON<StoredSettings>(KEY);
    return stored?.themePreference ?? null;
  }

  save(themePreference: ThemePreference): Promise<void> {
    return kvStore.setJSON<StoredSettings>(KEY, { themePreference });
  }
}

export const localSettingsRepository = new LocalSettingsRepository();
