import { Recipe } from './recipe';

/**
 * M5.4: household-synced family recipes. Mirrors `ManualItem`'s envelope
 * shape (`src/domain/models/shopping.ts`) — a full recipe body plus the sync
 * metadata needed for a deterministic per-key merge (`mergeUserRecipes` in
 * `src/engine/syncMerge.ts`): newest `updatedAtISO` wins the recipe body,
 * `deleted`/`deletedAtISO` is a soft-delete tombstone resolved independently
 * by its own timestamp, same as `ManualItem.deleted`.
 *
 * This is the PERSISTED/sync shape only. `useUserRecipesStore`'s public
 * surface (`recipesMap`, `list`, `getAnyRecipe`, `allRecipesList`,
 * `allRecipesById`) stays a plain, unenveloped `Recipe`-only view — every
 * recipe-pool/allergy/meal-resolution consumer depends on that — derived
 * from this map by filtering out `deleted` entries and unwrapping `.recipe`.
 */
export interface UserRecipeEntry {
  recipe: Recipe;
  /** Last edit to the recipe body (NOT deleted/deletedAtISO, which has its
   * own independent timestamp — mirrors `ManualItem.updatedAtISO`). */
  updatedAtISO: string;
  /** Soft-delete flag, resolved by the same newer-timestamp-wins rule as
   * `ManualItem.deleted` — never a hard removal, so a delete on one device
   * can't be silently resurrected by a stale copy on another. */
  deleted: boolean;
  deletedAtISO: string | null;
}

/** recipe id -> its enveloped sync entry. */
export type UserRecipeSyncMap = Record<string, UserRecipeEntry>;
