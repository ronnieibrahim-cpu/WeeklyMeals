import { IntakeAnswers } from './intake';

export interface PlannedMeal {
  recipeId: string;
  servings: number; // scaled to the number of people
  dayIndex: number; // 0–6 within the week
  locked: boolean; // user "kept" it during review
  cooked?: boolean; // marked done during the week (progress tracking)
  cookedAtISO?: string | null; // when this device last toggled `cooked` (sync merge key)
  rating?: 1 | 2 | 3 | 4 | 5; // set any time, not gated on `cooked` (M2.1)
  ratedAtISO?: string | null; // when this device last set/edited `rating` (sync merge key)
  /** When this device last changed `recipeId` (M2.2 re-roll). Undefined at
   * generation/approval (epoch 0) — only `rerollMeal` stamps it. Sync merge
   * key: when two devices disagree on `recipeId` for the same day, this
   * decides whose whole meal body (cooked/rating included) wins, so a
   * rating for the outgoing dish can never attach to the new one. */
  recipeChangedAtISO?: string;
  isLeftoverDay?: boolean; // reuses a prior meal instead of cooking
  leftoverFromRecipeId?: string;
}

export type PlanStatus = 'draft' | 'approved' | 'completed';

export interface WeeklyPlan {
  id: string;
  weekStartISO: string; // start of the plan week
  intake: IntakeAnswers;
  meals: PlannedMeal[];
  status: PlanStatus;
  createdAtISO: string;
}
