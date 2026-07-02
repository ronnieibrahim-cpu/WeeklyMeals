import {
  IntakeAnswers,
  PlannedMeal,
  PreferenceProfile,
  Profile,
  Recipe,
  Season,
} from '@/domain/models';

/** Everything the engine needs to score and pick a week. */
export interface GenerateContext {
  intake: IntakeAnswers;
  profile: Profile;
  preferences?: PreferenceProfile;
  /** Ingredients on hand to build the week around (lowercased names matched loosely). */
  pantry: string[];
  season: Season;
  /** Recipes the user locked during review; always kept, never re-scored out. */
  lockedRecipeIds?: string[];
  /** Favorited recipes get a reintroduction bonus. */
  favoriteRecipeIds?: string[];
  /** Meals from recent archived weeks — penalized so weeks don't repeat back-to-back. */
  recentRecipeIds?: string[];
}

export interface RecommendationProvider {
  /** Produce up to `intake.dinners` planned meals from the candidate recipes. */
  generate(ctx: GenerateContext, recipes: Recipe[]): PlannedMeal[];
}

/**
 * Soft-scoring weights. Tunable in one place and easy to unit-test.
 * `pantry` is high because the user asked to strongly build around what they have.
 */
export const WEIGHTS = {
  pantry: 3.0,
  preference: 1.5,
  affinity: 1.4, // learned positive likes (cuisine/protein/technique)
  favorite: 1.0, // periodic reintroduction of favorited recipes
  variety: 1.3,
  budget: 0.9,
  time: 0.5,
  nutrition: 1.0,
  healthyComfort: 1.1,
  adventurous: 0.8,
  season: 0.4,
  ratingsPenalty: 2.0,
  repeatPenalty: 1.5, // cooked it in the last couple weeks — give it a rest
} as const;
