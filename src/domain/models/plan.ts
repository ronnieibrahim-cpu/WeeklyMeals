import { IntakeAnswers } from './intake';

export interface PlannedMeal {
  recipeId: string;
  servings: number; // scaled to the number of people
  dayIndex: number; // 0–6 within the week
  locked: boolean; // user "kept" it during review
  cooked?: boolean; // marked done during the week (progress tracking)
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
