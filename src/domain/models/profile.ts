import { Cuisine, Difficulty, Protein, SpiceLevel } from './common';

export interface HouseholdMember {
  id: string;
  name?: string;
  /** Local calendar date, `YYYY-MM-DD` (same format as `weekStartISO` — see
   * `localDateString`/`parseWeekStart` in `engine/schedule.ts`). The
   * preferred source for a member's age: since the portion factor is
   * derived from it at read time (see `engine/portions.ts`), a household
   * right-sizes itself as a child grows with zero manual edits. */
  birthDateISO?: string;
  /** Fallback only, used when `birthDateISO` is unknown (or for
   * pre-migration rows that predate it). A static age goes stale — prefer
   * `birthDateISO` whenever it's known. */
  ageYears?: number;
  isChild: boolean;
  /** Per-person override ("eats like an adult") — always counts as a full
   * adult-equivalent serving regardless of computed age. */
  eatsLikeAdult?: boolean;
}

/** The household's long-lived preferences. Seeds intake defaults and the engine. */
export interface Profile {
  id: string;
  familySize: number;
  members: HouseholdMember[];
  cookingSkill: Difficulty;
  favoriteCuisines: Cuisine[];
  dislikedCuisines: Cuisine[];
  preferredProteins: Protein[];
  dislikedIngredients: string[];
  allergies: string[];
  dietaryRestrictions: string[]; // e.g. ['vegetarian', 'gluten-free']
  spiceLevel: SpiceLevel;
  weeklyBudget: number; // USD
  avgCookMinutes: number;
  shoppingDay: number; // 0–6 (Sun–Sat)
  mealPrepDay: number; // 0–6
  favoriteStore: string; // 'HEB'
  equipment: string[]; // ['Oven', 'AirFryer', 'SlowCooker', ...]
  nutritionPriorities: string[]; // ['HighProtein', 'LowCarb', ...]
  targetCaloriesPerMeal?: number;
  targetProteinPerMeal?: number;
  pantryStaples: string[]; // things always on hand
}
