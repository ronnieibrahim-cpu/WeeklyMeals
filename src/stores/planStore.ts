import { create } from 'zustand';

import { IntakeAnswers } from '@/domain/models';

interface PlanState {
  /** This week's captured intake answers (set when the questionnaire completes). */
  intake: IntakeAnswers | null;
  setIntake: (intake: IntakeAnswers) => void;
  clearIntake: () => void;
}

/**
 * Holds the in-progress weekly plan. For now just the intake answers; meal
 * generation, the shopping list, and the schedule are layered on in later steps.
 */
export const usePlanStore = create<PlanState>((set) => ({
  intake: null,
  setIntake: (intake) => set({ intake }),
  clearIntake: () => set({ intake: null }),
}));
