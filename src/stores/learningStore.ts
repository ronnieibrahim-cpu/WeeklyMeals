import { create } from 'zustand';

import { recipesById } from '@/data/seed/recipes';
import { localLearningRepository } from '@/data/repositories/local/LocalLearningRepository';
import { PreferenceProfile, RatingEvent } from '@/domain/models';
import { applyRatings, createDefaultPreferences } from '@/engine/learning';

interface LearningState {
  preferences: PreferenceProfile;
  favorites: string[];
  ratings: RatingEvent[];
  hydrated: boolean;
  init: () => Promise<void>;
  isFavorite: (recipeId: string) => boolean;
  toggleFavorite: (recipeId: string) => void;
  /** Record a batch of weekly-review ratings and update preferences. */
  submitReview: (events: RatingEvent[]) => void;
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

  submitReview: (events) => {
    const ratings = [...get().ratings, ...events];
    const preferences = applyRatings(get().preferences, events, recipesById);
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
