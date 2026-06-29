import { Cuisine, Protein } from './common';

/**
 * Derived, evolving preferences — the heart of "gets better every week".
 * Affinities range roughly -1 (avoid) … +1 (favor) and are updated from RatingEvents.
 */
export interface PreferenceProfile {
  cuisineAffinity: Partial<Record<Cuisine, number>>;
  proteinAffinity: Partial<Record<Protein, number>>;
  vegetableAffinity: Record<string, number>;
  techniqueAffinity: Record<string, number>;
  spiceTolerance: number; // shifts away from repeated "too spicy/too bland"
  complexityPreference: number; // shifts toward easier on repeated "too much prep"
  budgetSensitivity: number; // rises on repeated "too expensive"
  leftoverTolerance: number; // falls on repeated "too many leftovers"
  mealsRated: number;
  avgEnjoyment: number;
  blockedRecipeIds: string[]; // repeatedly disliked
}
