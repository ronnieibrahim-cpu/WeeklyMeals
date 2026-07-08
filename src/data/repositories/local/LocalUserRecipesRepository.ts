import { Recipe } from '@/domain/models';

import { UserRecipesRepository } from '../UserRecipesRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:userRecipes:v1';

export class LocalUserRecipesRepository implements UserRecipesRepository {
  load(): Promise<Record<string, Recipe> | null> {
    return kvStore.getJSON<Record<string, Recipe>>(KEY);
  }

  save(map: Record<string, Recipe>): Promise<void> {
    return kvStore.setJSON(KEY, map);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localUserRecipesRepository = new LocalUserRecipesRepository();
