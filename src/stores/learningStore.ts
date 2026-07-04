import { create } from 'zustand';

import { recipesById } from '@/data/seed/recipes';
import { localLearningRepository } from '@/data/repositories/local/LocalLearningRepository';
import { FavoritesMap, KidApprovedMap, PreferenceProfile, RatingEvent } from '@/domain/models';
import { applyRatings, createDefaultPreferences, migrateFavoritesToMap } from '@/engine/learning';
import { createId } from '@/utils/id';

function flaggedIds(map: FavoritesMap | KidApprovedMap): string[] {
  return Object.entries(map)
    .filter(([, entry]) => entry.flag)
    .map(([id]) => id);
}

interface LearningState {
  preferences: PreferenceProfile;
  /** Source of truth (M3.1, household-synced). */
  favoritesMap: FavoritesMap;
  /** Derived favorited ids, kept in sync with favoritesMap on every change —
   * existing consumers (meal detail heart, profile count, scoring's
   * favoriteRecipeIds) read this and need no changes. */
  favorites: string[];
  ratings: RatingEvent[];
  hydrated: boolean;
  init: () => Promise<void>;
  isFavorite: (recipeId: string) => boolean;
  toggleFavorite: (recipeId: string) => void;
  /** Adopt a synced favorites map after a household sync merge (mirrors
   * planStore.hydrateFromSync) — replaces local state without re-stamping
   * timestamps, since the merge already resolved them. */
  hydrateFavoritesFromSync: (map: FavoritesMap) => void;
  /** Source of truth for the M3.2 "Kids approved" badge, household-synced
   * exactly like favoritesMap (same TimestampedFlagMap shape, same merge). */
  kidApprovedMap: KidApprovedMap;
  /** Derived kid-approved ids, kept in sync with kidApprovedMap. */
  kidApproved: string[];
  isKidApproved: (recipeId: string) => boolean;
  toggleKidApproved: (recipeId: string) => void;
  hydrateKidApprovedFromSync: (map: KidApprovedMap) => void;
  /**
   * Record or edit the rating for one (planId, recipeId) meal and recompute
   * the whole PreferenceProfile from scratch by re-folding the full rating
   * history (M2.1). Recomputing from zero every time — rather than folding
   * this one event onto the existing profile — makes edits/re-rates
   * structurally incapable of double-counting: there is no running total to
   * accidentally count twice.
   */
  rateRecipe: (event: Omit<RatingEvent, 'id'>) => void;
  /** Remove one recipe from the blocked list so it can be recommended again. */
  unblockRecipe: (recipeId: string) => void;
  reset: () => void;
}

function persist(state: {
  preferences: PreferenceProfile;
  favoritesMap: FavoritesMap;
  kidApprovedMap: KidApprovedMap;
  ratings: RatingEvent[];
}) {
  void localLearningRepository.save({
    preferences: state.preferences,
    favoritesMap: state.favoritesMap,
    kidApprovedMap: state.kidApprovedMap,
    ratings: state.ratings,
  });
}

export const useLearningStore = create<LearningState>((set, get) => ({
  preferences: createDefaultPreferences(),
  favoritesMap: {},
  favorites: [],
  kidApprovedMap: {},
  kidApproved: [],
  ratings: [],
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const data = await localLearningRepository.load();
    // M3.1 migration: old persisted data only has the plain-array shape.
    const favoritesMap =
      data?.favoritesMap ?? migrateFavoritesToMap(data?.favorites ?? [], new Date().toISOString());
    const kidApprovedMap = data?.kidApprovedMap ?? {};
    set({
      preferences: data?.preferences ?? createDefaultPreferences(),
      favoritesMap,
      favorites: flaggedIds(favoritesMap),
      kidApprovedMap,
      kidApproved: flaggedIds(kidApprovedMap),
      ratings: data?.ratings ?? [],
      hydrated: true,
    });
  },

  isFavorite: (recipeId) => !!get().favoritesMap[recipeId]?.flag,

  toggleFavorite: (recipeId) => {
    const prev = get().favoritesMap;
    const favoritesMap: FavoritesMap = {
      ...prev,
      [recipeId]: { flag: !prev[recipeId]?.flag, atISO: new Date().toISOString() },
    };
    set({ favoritesMap, favorites: flaggedIds(favoritesMap) });
    persist({ ...get(), favoritesMap });
  },

  hydrateFavoritesFromSync: (map) => {
    set({ favoritesMap: map, favorites: flaggedIds(map) });
    persist({ ...get(), favoritesMap: map });
  },

  isKidApproved: (recipeId) => !!get().kidApprovedMap[recipeId]?.flag,

  toggleKidApproved: (recipeId) => {
    const prev = get().kidApprovedMap;
    const kidApprovedMap: KidApprovedMap = {
      ...prev,
      [recipeId]: { flag: !prev[recipeId]?.flag, atISO: new Date().toISOString() },
    };
    set({ kidApprovedMap, kidApproved: flaggedIds(kidApprovedMap) });
    persist({ ...get(), kidApprovedMap });
  },

  hydrateKidApprovedFromSync: (map) => {
    set({ kidApprovedMap: map, kidApproved: flaggedIds(map) });
    persist({ ...get(), kidApprovedMap: map });
  },

  rateRecipe: (event) => {
    const prevRatings = get().ratings;
    const idx = prevRatings.findIndex((r) => r.planId === event.planId && r.recipeId === event.recipeId);
    const withId: RatingEvent = { id: idx >= 0 ? prevRatings[idx].id : createId(), ...event };
    const ratings = idx >= 0 ? prevRatings.map((r, i) => (i === idx ? withId : r)) : [...prevRatings, withId];
    const preferences = applyRatings(createDefaultPreferences(), ratings, recipesById);
    set({ ratings, preferences });
    persist({ ...get(), ratings, preferences });
  },

  unblockRecipe: (recipeId) => {
    const prev = get().preferences;
    if (!prev.blockedRecipeIds.includes(recipeId)) return;
    const preferences = {
      ...prev,
      blockedRecipeIds: prev.blockedRecipeIds.filter((id) => id !== recipeId),
    };
    set({ preferences });
    persist({ ...get(), preferences });
  },

  reset: () => {
    const preferences = createDefaultPreferences();
    set({ preferences, favoritesMap: {}, favorites: [], kidApprovedMap: {}, kidApproved: [], ratings: [] });
    persist({ preferences, favoritesMap: {}, kidApprovedMap: {}, ratings: [] });
  },
}));
