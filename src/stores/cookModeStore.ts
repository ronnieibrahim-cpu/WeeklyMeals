import { create } from 'zustand';

import { localCookModeRepository } from '@/data/repositories/local/LocalCookModeRepository';
import { CookModeSteps } from '@/data/repositories/CookModeRepository';

interface CookModeState {
  steps: CookModeSteps;
  hydrated: boolean;
  init: () => Promise<void>;
  setStep: (key: string, index: number, plateKey: string) => void;
  /** The saved step for `key`, or 0 if there's no saved progress, it's in
   * the pre-M4.2 bare-number format, or its `plateKey` doesn't match the
   * live plate's (M4.2 part 2) — a side removed, swapped, or changed via
   * sync must never leave cook mode pointing at a different dish's step. */
  getStep: (key: string, plateKey: string) => number;
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

  setStep: (key, index, plateKey) => {
    const steps = { ...get().steps, [key]: { index, plateKey } };
    set({ steps });
    void localCookModeRepository.save(steps);
  },

  getStep: (key, plateKey) => {
    const saved = get().steps[key];
    if (!saved || typeof saved === 'number') return 0;
    return saved.plateKey === plateKey ? saved.index : 0;
  },
}));
