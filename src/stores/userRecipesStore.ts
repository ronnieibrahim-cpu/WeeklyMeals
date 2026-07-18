import { useMemo } from 'react';
import { create } from 'zustand';

import { recipesById as seedRecipesById, RECIPES as SEED_RECIPES } from '@/data/seed/recipes';
import { localUserRecipesRepository } from '@/data/repositories/local/LocalUserRecipesRepository';
import { isMain, Recipe } from '@/domain/models';
import { buildUserRecipe, UserRecipeInput } from '@/engine/userRecipes';

interface UserRecipesState {
  /** Source of truth — per-device only, never synced (M3.5). */
  recipesMap: Record<string, Recipe>;
  /** Derived array, kept in sync with recipesMap on every change. */
  list: Recipe[];
  hydrated: boolean;
  init: () => Promise<void>;
  /** Returns the new recipe's id. */
  addRecipe: (input: UserRecipeInput) => string;
  updateRecipe: (id: string, input: UserRecipeInput) => void;
  deleteRecipe: (id: string) => void;
}

function persist(map: Record<string, Recipe>) {
  void localUserRecipesRepository.save(map);
}

export const useUserRecipesStore = create<UserRecipesState>((set, get) => ({
  recipesMap: {},
  list: [],
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const recipesMap = (await localUserRecipesRepository.load()) ?? {};
    set({ recipesMap, list: Object.values(recipesMap), hydrated: true });
  },

  addRecipe: (input) => {
    const recipe = buildUserRecipe(input);
    const recipesMap = { ...get().recipesMap, [recipe.id]: recipe };
    set({ recipesMap, list: Object.values(recipesMap) });
    persist(recipesMap);
    return recipe.id;
  },

  updateRecipe: (id, input) => {
    if (!get().recipesMap[id]) return;
    const recipe = buildUserRecipe(input, id);
    const recipesMap = { ...get().recipesMap, [id]: recipe };
    set({ recipesMap, list: Object.values(recipesMap) });
    persist(recipesMap);
  },

  deleteRecipe: (id) => {
    if (!get().recipesMap[id]) return;
    const recipesMap = { ...get().recipesMap };
    delete recipesMap[id];
    set({ recipesMap, list: Object.values(recipesMap) });
    persist(recipesMap);
  },
}));

/**
 * Non-React accessors, for use inside other stores' actions (planStore,
 * learningStore) exactly the way `useProfileStore.getState()` etc. are
 * already used there — these read the live store state at call time, they
 * are not memoized/reactive themselves.
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
