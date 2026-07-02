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
   * Record a batch of weekly-review ratings, replacing any earlier rating for the
   * same meal (so inline day-by-day ratings and the wizard never double-count).
   */
  submitReview: (events: RatingEvent[]) => void;
  /** One-tap star rating for a single meal, straight from a card. Implies cooked. */
  rateMeal: (planId: string, recipeId: string, enjoyment: number) => void;
  reset: () => void;
}

const keyOf = (e: Pick<RatingEvent, 'planId' | 'recipeId'>) => `${e.planId}|${e.recipeId}`;

/** Preferences are always derived from the full rating history, so edits are safe. */
function derivePreferences(ratings: RatingEvent[]): PreferenceProfile {
  return applyRatings(createDefaultPreferences(), ratings, recipesById);
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
    const byKey = new Map(get().ratings.map((r) => [keyOf(r), r]));
    for (const e of events) {
      const existing = byKey.get(keyOf(e));
      byKey.set(keyOf(e), existing ? { ...e, id: existing.id } : e);
    }
    const ratings = Array.from(byKey.values());
    const preferences = derivePreferences(ratings);
    set({ ratings, preferences });
    persist({ ...get(), ratings, preferences });
  },

  rateMeal: (planId, recipeId, enjoyment) => {
    const now = new Date().toISOString();
    const ratings = [...get().ratings];
    const i = ratings.findIndex((r) => keyOf(r) === keyOf({ planId, recipeId }));
    if (i >= 0) ratings[i] = { ...ratings[i], cooked: true, enjoyment, ratedAtISO: now };
    else ratings.push({ id: createId(), planId, recipeId, cooked: true, enjoyment, ratedAtISO: now });
    const preferences = derivePreferences(ratings);
    set({ ratings, preferences });
    persist({ ...get(), ratings, preferences });
  },

  reset: () => {
    const preferences = createDefaultPreferences();
    set({ preferences, favorites: [], ratings: [] });
    persist({ preferences, favorites: [], ratings: [] });
  },
}));
