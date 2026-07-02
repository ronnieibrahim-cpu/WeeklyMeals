import { create } from 'zustand';

import { recipesById } from '@/data/seed/recipes';
import { localLearningRepository } from '@/data/repositories/local/LocalLearningRepository';
import { PreferenceProfile, RatingEvent } from '@/domain/models';
import { applyRatings, createDefaultPreferences } from '@/engine/learning';
import { createId } from '@/utils/id';

interface LearningState {
  preferences: PreferenceProfile;
  favorites: string[];
  ratings: RatingEvent[];
  hydrated: boolean;
  init: () => Promise<void>;
  isFavorite: (recipeId: string) => boolean;
  toggleFavorite: (recipeId: string) => void;
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

function persist(state: { preferences: PreferenceProfile; favorites: string[]; ratings: RatingEvent[] }) {
  void localLearningRepository.save({
    preferences: state.preferences,
    favorites: state.favorites,
    ratings: state.ratings,
  });
}

export const useLearningStore = create<LearningState>((set, get) => ({
  preferences: createDefaultPreferences(),
  favorites: [],
  ratings: [],
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const data = await localLearningRepository.load();
    set({
      preferences: data?.preferences ?? createDefaultPreferences(),
      favorites: data?.favorites ?? [],
      ratings: data?.ratings ?? [],
      hydrated: true,
    });
  },

  isFavorite: (recipeId) => get().favorites.includes(recipeId),

  toggleFavorite: (recipeId) => {
    const favorites = get().favorites.includes(recipeId)
      ? get().favorites.filter((id) => id !== recipeId)
      : [...get().favorites, recipeId];
    set({ favorites });
    persist({ ...get(), favorites });
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
    set({ preferences, favorites: [], ratings: [] });
    persist({ preferences, favorites: [], ratings: [] });
  },
}));
