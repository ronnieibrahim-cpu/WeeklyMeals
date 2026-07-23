import { UserRecipeSyncMap } from '@/domain/models';

import { UserRecipesRepository } from '../UserRecipesRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:userRecipes:v1';

export class LocalUserRecipesRepository implements UserRecipesRepository {
  load(): Promise<unknown> {
    return kvStore.getJSON<unknown>(KEY);
  }

  save(map: UserRecipeSyncMap): Promise<void> {
    return kvStore.setJSON(KEY, map);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localUserRecipesRepository = new LocalUserRecipesRepository();
