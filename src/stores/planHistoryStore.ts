import { create } from 'zustand';

import { localPlanHistoryRepository } from '@/data/repositories/local/LocalPlanHistoryRepository';
import { WeeklyPlan } from '@/domain/models';
import { archivePlan } from '@/engine/planHistory';

interface PlanHistoryState {
  history: WeeklyPlan[];
  hydrated: boolean;
  init: () => Promise<void>;
  /** Fold `plan` into the rolling 6-week archive (see `archivePlan`'s doc
   * comment in `src/engine/planHistory.ts` for the dedupe/sort/cap rules)
   * and persist. Called by `planStore.approve()`/`hydrateFromSync()` with
   * whatever plan is about to be replaced — never called from the UI.
   * Async: it self-hydrates first (F8a, July 2026 sweep) so it can never
   * fold into a still-empty `history` at the exact rollover moment. Callers
   * stay fire-and-forget (`void`). */
  archive: (plan: WeeklyPlan) => Promise<void>;
}

/**
 * M5.0: a rolling archive of the last 6 cooked weeks, browsable read-only
 * from the Schedule tab — reflection only, no re-planning, no shopping-list
 * interaction, nothing that feeds back into scoring.
 *
 * PER-DEVICE, deliberately NOT household-synced — same decision class as
 * cook-mode progress (M3.4 — see `cookModeStore.ts`'s doc comment). There
 * is no new sync payload and no merge logic here: each device archives
 * whatever plan it's replacing at the moment it replaces it (on its own
 * `approve()` or on adopting a genuine week-replacement via
 * `hydrateFromSync()`), so over time both phones in a household build
 * equivalent archives independently, just via two different sequences of
 * local events rather than one merged one. A brand-new device (or one that
 * reinstalls) simply starts with an empty archive — there's nothing to
 * catch up on, since this is a reflection surface, not state anything else
 * depends on (Product Law: nothing here touches the shopping list or
 * scoring).
 */
export const usePlanHistoryStore = create<PlanHistoryState>((set, get) => ({
  history: [],
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const history = (await localPlanHistoryRepository.load()) ?? [];
    set({ history, hydrated: true });
  },

  archive: async (plan) => {
    // F8a (July 2026 sweep): a launch-time sync poll can adopt the partner's
    // new week — precisely the archive-worthy moment — before this store's
    // own init() has resolved. Folding into a still-empty `history` would
    // then persist a 1-entry array over up to 5 stored weeks. Ensure
    // hydration first; init() itself no-ops if already hydrated.
    if (!get().hydrated) await get().init();
    const next = archivePlan(get().history, plan);
    set({ history: next });
    void localPlanHistoryRepository.save(next);
  },
}));
