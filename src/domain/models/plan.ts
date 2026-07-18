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
  /** When this device last changed `servings` (M4.1). Same shape as
   * `ratedAtISO` (settable repeatedly, newer-wins with a deterministic
   * tie-break) — see `resolveServings` in syncMerge.ts. Excluded from
   * `mealBaseKey` so a servings-only edit merges independently rather than
   * looking like a diverged meal body. */
  servingsChangedAtISO?: string | null;
  /** M4.2: 0-2 side/sauce recipe ids composed onto this main's plate, at
   * generation time or edited after via the meal detail screen. An empty
   * array is a real, explicit "no sides tonight" choice, not "not decided
   * yet" — that distinction lives in whether `sidesChangedAtISO` is set. */
  sideRecipeIds?: string[];
  /** When this device last changed `sideRecipeIds` (M4.2). Same shape as
   * `servingsChangedAtISO` — settable repeatedly, newer-wins with a
   * deterministic tie-break — see `resolveSides` in syncMerge.ts. Excluded
   * from `mealBaseKey` so a sides-only edit merges independently rather than
   * looking like a diverged meal body. */
  sidesChangedAtISO?: string | null;
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
  weekStartISO: string; // local calendar date the plan starts, `YYYY-MM-DD` (see localDateString/parseWeekStart in schedule.ts — never a UTC instant, or a reader in another timezone derives the wrong day)
  intake: IntakeAnswers;
  meals: PlannedMeal[];
  status: PlanStatus;
  createdAtISO: string;
}
