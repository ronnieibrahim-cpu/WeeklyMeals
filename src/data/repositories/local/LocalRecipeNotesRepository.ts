import { RecipeNotesMap } from '@/domain/models';

import { RecipeNotesRepository } from '../RecipeNotesRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:recipeNotes:v1';

export class LocalRecipeNotesRepository implements RecipeNotesRepository {
  load(): Promise<RecipeNotesMap | null> {
    return kvStore.getJSON<RecipeNotesMap>(KEY);
  }

  save(map: RecipeNotesMap): Promise<void> {
    return kvStore.setJSON(KEY, map);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localRecipeNotesRepository = new LocalRecipeNotesRepository();
