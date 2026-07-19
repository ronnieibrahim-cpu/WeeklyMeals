import { RecipeNotesMap } from '@/domain/models';

/** Persistence boundary for per-recipe notes (M4.4), household-synced. */
export interface RecipeNotesRepository {
  load(): Promise<RecipeNotesMap | null>;
  save(map: RecipeNotesMap): Promise<void>;
  clear(): Promise<void>;
}
