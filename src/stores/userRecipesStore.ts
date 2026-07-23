import { useMemo } from 'react';
import { create } from 'zustand';

import { recipesById as seedRecipesById, RECIPES as SEED_RECIPES } from '@/data/seed/recipes';
import { localUserRecipesRepository } from '@/data/repositories/local/LocalUserRecipesRepository';
import { isMain, Recipe, UserRecipeSyncMap } from '@/domain/models';
import { buildUserRecipe, migrateUserRecipesMap, UserRecipeInput } from '@/engine/userRecipes';

interface UserRecipesState {
  /** Source of truth (household-synced as of M5.4) — the full enveloped
   * sync map, including soft-deleted (tombstoned) entries. Not read
   * directly by recipe-pool/allergy/meal-resolution consumers; see
   * `recipesMap`/`list` below for the view they use. */
  syncMap: UserRecipeSyncMap;
  /** Derived, LIVE-ONLY, unwrapped view of `syncMap` (deleted entries
   * filtered out, `.recipe` unwrapped) — every existing consumer
   * (`getAnyRecipe`, `allRecipesList`, `allRecipesById`, the Recipes tab,
   * generation/reroll/pinning) depends on this staying exactly a plain
   * `id -> Recipe` map, unaware sync exists at all. */
  recipesMap: Record<string, Recipe>;
  /** Derived array, kept in sync with recipesMap on every change. */
  list: Recipe[];
  hydrated: boolean;
  init: () => Promise<void>;
  /** Returns the new recipe's id. */
  addRecipe: (input: UserRecipeInput) => string;
  updateRecipe: (id: string, input: UserRecipeInput) => void;
  /** Soft-delete (M5.4) — never a hard removal, so a delete on one device
   * can't be silently resurrected by a stale copy on another once synced.
   * Disappears from `recipesMap`/`list` exactly like a hard delete did
   * before M5.4. */
  deleteRecipe: (id: string) => void;
  /** Adopt a synced recipes map after a household sync merge (mirrors
   * manualItemsStore.hydrateFromSync / recipeNotesStore.hydrateFromSync). */
  hydrateUserRecipesFromSync: (map: UserRecipeSyncMap) => void;
}

function deriveViews(map: UserRecipeSyncMap): { recipesMap: Record<string, Recipe>; list: Recipe[] } {
  const recipesMap: Record<string, Recipe> = {};
  for (const entry of Object.values(map)) {
    if (entry.deleted) continue;
    recipesMap[entry.recipe.id] = entry.recipe;
  }
  return { recipesMap, list: Object.values(recipesMap) };
}

function persist(map: UserRecipeSyncMap) {
  void localUserRecipesRepository.save(map);
}

export const useUserRecipesStore = create<UserRecipesState>((set, get) => ({
  syncMap: {},
  recipesMap: {},
  list: [],
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const raw = await localUserRecipesRepository.load();
    const syncMap = migrateUserRecipesMap(raw);
    set({ syncMap, ...deriveViews(syncMap), hydrated: true });
  },

  addRecipe: (input) => {
    const recipe = buildUserRecipe(input);
    const now = new Date().toISOString();
    const syncMap: UserRecipeSyncMap = {
      ...get().syncMap,
      [recipe.id]: { recipe, updatedAtISO: now, deleted: false, deletedAtISO: null },
    };
    set({ syncMap, ...deriveViews(syncMap) });
    persist(syncMap);
    return recipe.id;
  },

  updateRecipe: (id, input) => {
    const existing = get().syncMap[id];
    if (!get().recipesMap[id] || !existing) return;
    const recipe = buildUserRecipe(input, id);
    const now = new Date().toISOString();
    const syncMap: UserRecipeSyncMap = {
      ...get().syncMap,
      // Body edit only — deleted/deletedAtISO inherit from `existing` (an
      // edit never touches them, mirroring manualItemsStore.edit) rather
      // than being forced to false/null; the `recipesMap[id]` guard above
      // already guarantees this entry is currently live.
      [id]: { ...existing, recipe, updatedAtISO: now },
    };
    set({ syncMap, ...deriveViews(syncMap) });
    persist(syncMap);
  },

  deleteRecipe: (id) => {
    const existing = get().syncMap[id];
    if (!existing) return;
    const now = new Date().toISOString();
    const syncMap: UserRecipeSyncMap = {
      ...get().syncMap,
      [id]: { ...existing, deleted: true, deletedAtISO: now, updatedAtISO: now },
    };
    set({ syncMap, ...deriveViews(syncMap) });
    persist(syncMap);
  },

  hydrateUserRecipesFromSync: (map) => {
    set({ syncMap: map, ...deriveViews(map) });
    persist(map);
  },
}));

/**
 * Non-React accessors, for use inside other stores' actions (planStore,
 * learningStore) exactly the way `useProfileStore.getState()` etc. are
 * already used there — these read the live store state at call time, they
 * are not memoized/reactive themselves.
 *
 * All four of these (plus `mainRecipesList`) read ONLY `recipesMap`/`list` —
 * the derived, live-only, unwrapped view — never `syncMap`. That is the
 * M5.4 backward-compatibility contract every recipe-pool/allergy/
 * meal-resolution consumer depends on: a soft-deleted or enveloped entry can
 * never leak in here.
 */
export function getAnyRecipe(id: string): Recipe | undefined {
  return seedRecipesById[id] ?? useUserRecipesStore.getState().recipesMap[id];
}

export function allRecipesList(): Recipe[] {
  return [...SEED_RECIPES, ...useUserRecipesStore.getState().list];
}

export function allRecipesById(): Record<string, Recipe> {
  return { ...seedRecipesById, ...useUserRecipesStore.getState().recipesMap };
}

/** M4.2 part 2: `allRecipesList()` filtered to mains only (`RECIPES` now
 * also contains sides/sauces). Every consumer that picks or lists "a main"
 * — generation, re-roll, swap, the Recipes browse tab — uses this, not a
 * hand-rolled filter, so the main/side split stays defined in one place
 * (`isMain()`). */
export function mainRecipesList(): Recipe[] {
  return allRecipesList().filter(isMain);
}

/** Reactive hooks for screens — re-render when a family recipe is added,
 * edited, or deleted, unlike the plain accessors above. */
export function useRecipesById(): Record<string, Recipe> {
  const userMap = useUserRecipesStore((s) => s.recipesMap);
  return useMemo(() => ({ ...seedRecipesById, ...userMap }), [userMap]);
}

export function useAllRecipes(): Recipe[] {
  const userList = useUserRecipesStore((s) => s.list);
  return useMemo(() => [...SEED_RECIPES, ...userList], [userList]);
}

/** M4.2 part 2: `useAllRecipes()` filtered to mains only — used by the
 * Recipes browse tab so sides/sauces stay reachable only through a meal's
 * plate view, not as independently browsable/searchable dishes. */
export function useMainRecipes(): Recipe[] {
  const all = useAllRecipes();
  return useMemo(() => all.filter(isMain), [all]);
}
