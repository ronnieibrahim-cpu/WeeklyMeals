import { CookModeRepository, CookModeSteps } from '../CookModeRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:cookMode:v1';

export class LocalCookModeRepository implements CookModeRepository {
  load(): Promise<CookModeSteps | null> {
    return kvStore.getJSON<CookModeSteps>(KEY);
  }

  save(steps: CookModeSteps): Promise<void> {
    return kvStore.setJSON(KEY, steps);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localCookModeRepository = new LocalCookModeRepository();
