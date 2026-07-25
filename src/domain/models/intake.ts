import { Cuisine, Protein } from './common';

/** One Sunday's answers. Defaults are seeded from the Profile. */
export interface IntakeAnswers {
  dinners: number;
  /** Adult-equivalent portions per meal (e.g. 2.5), not a plain headcount —
   * see `engine/portions.ts`. Renamed from `people` (M4.1) so the value
   * itself signals it can be fractional. */
  servingsPerMeal: number;
  budget: number;
  maxPrepMinutes: number;
  maxCookMinutes: number;
  cuisines: Cuisine[]; // empty = no preference
  proteins: Protein[]; // proteins craving this week; empty = no preference
  healthyVsComfort: number; // 0 healthy … 1 comfort
  dietaryRestrictions: string[];
  ingredientsAtHome: string[];
  adventurousness: number; // 0 safe … 1 adventurous
  /**
   * How many of this week's dinners should be Instant Pot recipes (0 = none).
   * The engine reserves this many nights for recipes that genuinely declare
   * `equipment: ['Instant Pot']` before filling the rest of the week, so the
   * answer is always acted on. Optional for backward compatibility: a plan or
   * draft persisted before this question existed reads as 0.
   */
  instantPotNights?: number;
}
