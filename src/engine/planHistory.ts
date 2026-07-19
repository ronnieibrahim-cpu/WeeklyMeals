import { WeeklyPlan } from '@/domain/models';

/**
 * M5.0: fold `outgoing` (the plan being replaced — by `approve()` or a
 * synced week-replacement adopted via `hydrateFromSync()`) into the rolling
 * per-device archive `history`, stamped `status: 'completed'`. Pure — no
 * React, no I/O, no store imports — so both call sites can call it directly
 * against whatever's currently in `usePlanHistoryStore`.
 *
 * Rules:
 * - **Dedupe by `plan.id`**: re-archiving the same id (e.g. this device
 *   already archived a plan, then something else archives the identical
 *   outgoing plan again) REPLACES the existing entry rather than
 *   duplicating it — the newest snapshot always wins, so the archive
 *   reflects the plan's final state (its last rating, its final cooked
 *   count) rather than whatever it looked like the first time it was
 *   archived.
 * - **Same `weekStartISO`, different `id`, both count**: a week that got
 *   re-approved mid-week (a fresh draft approved over an existing active
 *   plan for the same calendar week) is still a real week of cooking — it
 *   is NOT deduped against the other plan for that week. The cap below is
 *   what ages the older one out, not a weekStartISO uniqueness rule.
 * - **Sorted newest-first, fully deterministic**: `weekStartISO` descending,
 *   tie broken by `createdAtISO` descending, tie broken by `id` descending.
 *   Two devices that each archive the same set of plans — even in a
 *   different call order — end up with the identical array, which matters
 *   because this is per-device state built independently on each phone
 *   (see `planHistoryStore.ts`'s doc comment), not merged over sync.
 * - **Capped at `cap`** (default 6): once the sorted archive exceeds the
 *   cap, the oldest entries (by the same sort) are dropped.
 */
export function archivePlan(history: WeeklyPlan[], outgoing: WeeklyPlan, cap = 6): WeeklyPlan[] {
  const archived: WeeklyPlan = { ...outgoing, status: 'completed' };
  const withoutSameId = history.filter((p) => p.id !== archived.id);
  const next = [...withoutSameId, archived];
  next.sort((a, b) => {
    if (a.weekStartISO !== b.weekStartISO) return b.weekStartISO.localeCompare(a.weekStartISO);
    if (a.createdAtISO !== b.createdAtISO) return b.createdAtISO.localeCompare(a.createdAtISO);
    return b.id.localeCompare(a.id);
  });
  return next.slice(0, cap);
}
