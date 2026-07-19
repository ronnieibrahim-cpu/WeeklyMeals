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
  /**
   * M4.6: cook-mode progress "travels with the dish" ON THIS DEVICE when
   * `planStore.moveMeal` swaps two uncooked days — swaps whatever's saved
   * under `cookModeKey(planId, dayA)` and `cookModeKey(planId, dayB)`,
   * handling all four presence combinations (both saved, only one saved,
   * neither saved) since a day with no cook-mode progress is a perfectly
   * normal case, not an error. A no-op (both absent) still persists nothing
   * new but is harmless to call.
   *
   * Known, accepted limit: cook-mode progress is per-device and not synced
   * (M3.4 decision — cooking is a real-time, one-person activity, unlike
   * checked/cooked/rating state). So this only carries progress on the
   * device that performed the swap. The OTHER phone's local progress for
   * dayA/dayB is left as-is until that phone's own plan syncs the swap in;
   * at that point its cook mode naturally resets to step 0 for the changed
   * days via the ordinary content-addressed `plateKey` mismatch check in
   * `getStep` (the plate under that dayIndex is now different content) —
   * deterministic and safe, just not carried across devices.
   */
  swapProgress: (planId: string, dayA: number, dayB: number) => void;
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

  swapProgress: (planId, dayA, dayB) => {
    if (dayA === dayB) return;
    const keyA = cookModeKey(planId, dayA);
    const keyB = cookModeKey(planId, dayB);
    const current = get().steps;
    const progressA = current[keyA];
    const progressB = current[keyB];
    if (progressA === undefined && progressB === undefined) return;

    const steps = { ...current };
    if (progressB === undefined) delete steps[keyA];
    else steps[keyA] = progressB;
    if (progressA === undefined) delete steps[keyB];
    else steps[keyB] = progressA;

    set({ steps });
    void localCookModeRepository.save(steps);
  },
}));
