import { create } from 'zustand';

import { localCookModeRepository } from '@/data/repositories/local/LocalCookModeRepository';
import { CookModeSteps } from '@/data/repositories/CookModeRepository';

interface CookModeState {
  steps: CookModeSteps;
  hydrated: boolean;
  init: () => Promise<void>;
  setStep: (key: string, index: number) => void;
}

/** planId + dayIndex identify one meal-on-a-day; cook mode remembers which
 * step you were on for it, per device (M3.4) — not household-synced, since
 * cooking is a real-time, one-person activity, unlike checked/cooked/rating
 * state. */
export function cookModeKey(planId: string, dayIndex: number): string {
  return `${planId}:${dayIndex}`;
}

export const useCookModeStore = create<CookModeState>((set, get) => ({
  steps: {},
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const steps = (await localCookModeRepository.load()) ?? {};
    set({ steps, hydrated: true });
  },

  setStep: (key, index) => {
    const steps = { ...get().steps, [key]: index };
    set({ steps });
    void localCookModeRepository.save(steps);
  },
}));
