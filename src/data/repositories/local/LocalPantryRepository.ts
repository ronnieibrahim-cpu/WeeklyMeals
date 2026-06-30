import { PantryRepository } from '../PantryRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:pantry:v1';

export class LocalPantryRepository implements PantryRepository {
  load(): Promise<string[] | null> {
    return kvStore.getJSON<string[]>(KEY);
  }

  save(items: string[]): Promise<void> {
    return kvStore.setJSON(KEY, items);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localPantryRepository = new LocalPantryRepository();
