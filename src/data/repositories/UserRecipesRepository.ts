import { UserRecipeSyncMap } from '@/domain/models';

/**
 * Persistence boundary for family-authored recipes (M3.5, household-synced
 * as of M5.4). `load()` returns `unknown` rather than `UserRecipeSyncMap`
 * because a device may still hold the pre-M5.4 persisted shape (a plain
 * `Record<id, Recipe>`, no envelope) — the caller (`userRecipesStore.init`)
 * is responsible for migrating via `migrateUserRecipesMap`
 * (`src/engine/userRecipes.ts`) before trusting the shape. `save`/`clear`
 * always operate on the current enveloped shape.
 */
export interface UserRecipesRepository {
  load(): Promise<unknown>;
  save(map: UserRecipeSyncMap): Promise<void>;
  clear(): Promise<void>;
}
