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
  /** Kid-approved recipes (M3.2) get a modest tie-breaking bonus. */
  kidApprovedRecipeIds?: string[];
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
  // M2.4: hand-curated recipes (cookbook-quality steps/ingredients, verified
  // allergen data) get a modest flat bonus over the 311 imported ones, whose
  // content quality is estimated. Enough to win ties/near-ties, not enough to
  // bury a clearly better imported match on the other factors.
  curated: 0.1,
  // M3.2: "Kids approved" recipes get a flat bonus, same order of magnitude
  // as `curated` — enough to win ties/near-ties for a family with picky
  // kids, never enough to override the explicit profile/questionnaire or
  // bury a clearly better match on the other factors.
  kidApproved: 0.15,
  // M2.6: learned spice/complexity/budget/leftover/vegetable dials, averaged
  // into one -1…1 nudge in scoring.ts. Kept well below preference (1.5) and
  // affinity (1.4) so learning-from-ratings can shift picks but never
  // override the profile/questionnaire the user explicitly set.
  learnedDials: 0.8,
  ratingsPenalty: 2.0,
  // M4.2 part 2: a small nudge for a side sharing the main's cuisine
  // (MILESTONE-4.md Rule 3 — "prefer sides that fit the main's cuisine").
  // Deliberately modest: strong enough to break ties toward a cuisine-fitting
  // side, never strong enough to exclude a better-scoring cross-cuisine one.
  // `scoreSide` uses this INSTEAD OF `variety` (see scoring.ts) —
  // `varietyBonus`'s cuisine/protein-repeat penalty is calibrated for "don't
  // pick the same cuisine twice across a week of mains," which inverts into
  // exactly the wrong signal at plate scope (it would penalize a
  // cuisine-fitting side, and penalize a second vegetable side for sharing
  // primaryProtein: 'None' with the first).
  sideCuisineFit: 0.4,
} as const;
