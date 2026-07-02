import { PlannedMeal, PlanStatus, ShoppingItem, ShoppingList, WeeklyPlan } from '@/domain/models';

/**
 * Merges plan + shopping-list state pulled from a household sync partner
 * with local state, instead of one whole side overwriting the other.
 *
 * Every function here is pure and, by construction, commutative and
 * idempotent: merge(A, B) === merge(B, A), and merging a result with either
 * of its own inputs again changes nothing. That's what lets two phones poll
 * and push independently on a plain 20s timer and still converge, without a
 * server-side merge step.
 */

/** The two pieces of state a household syncs, decoupled from the Supabase
 * row shape so this module never has to import the sync/data edge. */
export interface SyncMergePayload {
  plan: WeeklyPlan | null;
  shoppingList: ShoppingList | null;
}

/** Canonical JSON: object keys sorted recursively, `undefined` values
 * omitted (matching JSON.stringify's own behavior), so two structurally
 * equal objects always produce the same string regardless of the order
 * their keys happened to be created in. Used both as a comparison and as a
 * deterministic (if arbitrary) tie-breaker when no timestamp decides. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue;
      out[key] = sortKeysDeep(v);
    }
    return out;
  }
  return value;
}

/** A missing or unparseable timestamp is always older than any real one. */
function tsOf(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Date.parse(iso) || 0;
}

/** Deterministic, commutative pick between two values with no natural
 * ordering: whichever has the lexicographically larger canonical key wins.
 * If the keys are equal the values are content-identical, so it doesn't
 * matter which is returned. */
function chooseBase<T>(a: T, b: T, key: (v: T) => string): T {
  return key(a) >= key(b) ? a : b;
}

/** Resolve one boolean flag (checked / cooked) between two sides.
 * Commutative and idempotent: ties — including both timestamps missing —
 * resolve to true, so a real toggle on either device is never silently
 * lost to a stale "false". */
function resolveFlag(
  a: { flag: boolean; atISO?: string | null },
  b: { flag: boolean; atISO?: string | null },
): { flag: boolean; atISO: string | null } {
  const aTs = tsOf(a.atISO);
  const bTs = tsOf(b.atISO);
  if (aTs !== bTs) {
    const later = aTs > bTs ? a : b;
    return { flag: later.flag, atISO: new Date(Math.max(aTs, bTs)).toISOString() };
  }
  return { flag: a.flag || b.flag, atISO: aTs ? new Date(aTs).toISOString() : null };
}

function itemKey(i: Pick<ShoppingItem, 'ingredientName' | 'unit'>): string {
  return `${i.ingredientName}|${i.unit}`;
}

function itemBaseKey(i: ShoppingItem): string {
  const { checked: _checked, checkedAtISO: _checkedAtISO, ...rest } = i;
  return stableStringify(rest);
}

function resolveChecked(a: ShoppingItem, b: ShoppingItem): Pick<ShoppingItem, 'checked' | 'checkedAtISO'> {
  const { flag, atISO } = resolveFlag(
    { flag: a.checked, atISO: a.checkedAtISO },
    { flag: b.checked, atISO: b.checkedAtISO },
  );
  return { checked: flag, checkedAtISO: atISO };
}

/**
 * Merge two shopping lists for the SAME plan (caller must check
 * `a.planId === b.planId`). Items are unioned by ingredient+unit; per item,
 * whichever side toggled `checked` more recently wins that item's state,
 * and every other field (quantity/price/department/...) is otherwise
 * assumed identical between two lists built for the same plan — the rare
 * case where it isn't falls back to the same deterministic tie-break as
 * everything else, so the function stays commutative even then.
 */
export function mergeShoppingLists(a: ShoppingList, b: ShoppingList): ShoppingList {
  const aByKey = new Map(a.items.map((i) => [itemKey(i), i] as const));
  const bByKey = new Map(b.items.map((i) => [itemKey(i), i] as const));
  const keys = Array.from(new Set([...aByKey.keys(), ...bByKey.keys()])).sort();

  const items: ShoppingItem[] = keys.map((k) => {
    const ai = aByKey.get(k);
    const bi = bByKey.get(k);
    if (ai && bi) {
      const base = chooseBase(ai, bi, itemBaseKey);
      return { ...base, ...resolveChecked(ai, bi) };
    }
    return (ai ?? bi)!;
  });

  const aTs = tsOf(a.generatedAtISO);
  const bTs = tsOf(b.generatedAtISO);
  const aMeta = {
    planId: a.planId,
    estimatedTotal: a.estimatedTotal,
    costPerServing: a.costPerServing,
    generatedAtISO: a.generatedAtISO,
  };
  const bMeta = {
    planId: b.planId,
    estimatedTotal: b.estimatedTotal,
    costPerServing: b.costPerServing,
    generatedAtISO: b.generatedAtISO,
  };
  const meta = aTs !== bTs ? (aTs > bTs ? aMeta : bMeta) : chooseBase(aMeta, bMeta, stableStringify);

  return { ...meta, items };
}

const STATUS_RANK: Record<PlanStatus, number> = { draft: 0, approved: 1, completed: 2 };

/** Status only ever advances (draft -> approved -> completed); merging
 * takes the more-advanced side. Commutative (it's a max over a fixed rank). */
function mergeStatus(a: PlanStatus, b: PlanStatus): PlanStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/** Once a review is submitted anywhere it stays submitted (ratchet); if
 * both sides somehow recorded one, keep the earliest. Commutative. */
function mergeReviewedAt(a?: string, b?: string): string | undefined {
  if (a && b) return a < b ? a : b;
  return a ?? b;
}

function mealBaseKey(m: PlannedMeal): string {
  const { cooked: _cooked, cookedAtISO: _cookedAtISO, ...rest } = m;
  return stableStringify(rest);
}

function resolveCooked(a: PlannedMeal, b: PlannedMeal): Pick<PlannedMeal, 'cooked' | 'cookedAtISO'> {
  const { flag, atISO } = resolveFlag(
    { flag: !!a.cooked, atISO: a.cookedAtISO },
    { flag: !!b.cooked, atISO: b.cookedAtISO },
  );
  return { cooked: flag, cookedAtISO: atISO };
}

/**
 * Merge two copies of the SAME plan (caller must check `a.id === b.id`).
 * Meals are matched by dayIndex; per meal, whichever side toggled `cooked`
 * more recently wins that meal's state. weekStartISO/intake/createdAtISO
 * are set once at generation and never mutated afterwards by any store
 * action, so they're identical between two copies of the same plan id by
 * construction — status and reviewedAtISO are the only other fields that
 * can legitimately diverge, and both are merged as one-way ratchets.
 */
export function mergePlanMeals(a: WeeklyPlan, b: WeeklyPlan): WeeklyPlan {
  const aByDay = new Map(a.meals.map((m) => [m.dayIndex, m]));
  const bByDay = new Map(b.meals.map((m) => [m.dayIndex, m]));
  const days = Array.from(new Set([...aByDay.keys(), ...bByDay.keys()])).sort((x, y) => x - y);

  const meals: PlannedMeal[] = days.map((day) => {
    const am = aByDay.get(day);
    const bm = bByDay.get(day);
    if (am && bm) {
      const base = chooseBase(am, bm, mealBaseKey);
      return { ...base, ...resolveCooked(am, bm) };
    }
    return (am ?? bm)!;
  });

  return {
    id: a.id,
    weekStartISO: a.weekStartISO,
    intake: a.intake,
    createdAtISO: a.createdAtISO,
    status: mergeStatus(a.status, b.status),
    reviewedAtISO: mergeReviewedAt(a.reviewedAtISO, b.reviewedAtISO),
    meals,
  };
}

/**
 * Top-level merge for a full sync payload. If the two sides are looking at
 * different plans (different id), the newer plan (by createdAtISO) wins
 * outright — a freshly generated week is never silently deleted, but it
 * also never resurrects a plan that's genuinely been superseded. If both
 * sides share a plan id, per-item/per-meal merging takes over.
 */
export function mergeSyncPayload(local: SyncMergePayload, remote: SyncMergePayload): SyncMergePayload {
  if (!local.plan) return remote;
  if (!remote.plan) return local;

  if (local.plan.id !== remote.plan.id) {
    const localTs = tsOf(local.plan.createdAtISO);
    const remoteTs = tsOf(remote.plan.createdAtISO);
    if (localTs !== remoteTs) return localTs > remoteTs ? local : remote;
    return chooseBase(local, remote, stableStringify);
  }

  const plan = mergePlanMeals(local.plan, remote.plan);

  let shoppingList: ShoppingList | null = null;
  if (local.shoppingList && remote.shoppingList && local.shoppingList.planId === remote.shoppingList.planId) {
    shoppingList = mergeShoppingLists(local.shoppingList, remote.shoppingList);
  } else if (local.shoppingList && local.shoppingList.planId === plan.id) {
    shoppingList = local.shoppingList;
  } else if (remote.shoppingList && remote.shoppingList.planId === plan.id) {
    shoppingList = remote.shoppingList;
  }

  return { plan, shoppingList };
}
