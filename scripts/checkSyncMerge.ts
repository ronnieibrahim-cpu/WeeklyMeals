/**
 * Standalone assertions for the sync-merge engine (M1.6). Run with:
 *
 *   npx tsx --tsconfig ./tsconfig.json scripts/checkSyncMerge.ts
 *
 * These are the checks CLAUDE.md requires for any change to safety/
 * correctness-critical shared logic; there's no test runner installed in
 * this repo yet (PROJECT.md #11), so they live here for now. They should
 * migrate into the real test suite once M2.5 sets one up.
 */
import assert from 'node:assert/strict';

import { IntakeAnswers, PlannedMeal, ShoppingItem, ShoppingList, WeeklyPlan } from '@/domain/models';
import { mergePlanMeals, mergeShoppingLists, mergeSyncPayload, stableStringify } from '@/engine/syncMerge';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const INTAKE = {} as IntakeAnswers; // opaque payload the merge never inspects

function item(over: Partial<ShoppingItem> & Pick<ShoppingItem, 'ingredientName' | 'unit'>): ShoppingItem {
  return {
    quantity: 1,
    department: 'Produce',
    estimatedPrice: 1,
    checked: false,
    checkedAtISO: null,
    fromRecipeIds: [],
    ...over,
  };
}

function list(planId: string, items: ShoppingItem[], generatedAtISO = '2026-01-01T00:00:00.000Z'): ShoppingList {
  return { planId, items, estimatedTotal: 0, costPerServing: 0, generatedAtISO };
}

function meal(dayIndex: number, over: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    recipeId: `r${dayIndex}`,
    servings: 4,
    dayIndex,
    locked: false,
    cooked: false,
    cookedAtISO: null,
    rating: undefined,
    ratedAtISO: null,
    ...over,
  };
}

function plan(id: string, meals: PlannedMeal[], over: Partial<WeeklyPlan> = {}): WeeklyPlan {
  return {
    id,
    weekStartISO: '2026-06-29T00:00:00.000Z',
    intake: INTAKE,
    meals,
    status: 'approved',
    createdAtISO: '2026-06-29T00:00:00.000Z',
    ...over,
  };
}

const t1 = '2026-07-01T10:00:00.000Z';
const t2 = '2026-07-01T10:05:00.000Z'; // later than t1

// ---------------------------------------------------------------------------
// (a) Cross-checks converge: A checks 1-3, B checks 4-6 -> both merge orders
//     yield all six checked, regardless of who merges first.
// ---------------------------------------------------------------------------
check('(a) cross-device checks converge, order-independent', () => {
  const names = ['milk', 'eggs', 'bread', 'rice', 'beans', 'salsa'];
  const base = names.map((n) => item({ ingredientName: n, unit: 'piece' }));

  const a = list(
    'plan-1',
    base.map((it, i) => (i < 3 ? { ...it, checked: true, checkedAtISO: t1 } : it)),
  );
  const b = list(
    'plan-1',
    base.map((it, i) => (i >= 3 ? { ...it, checked: true, checkedAtISO: t1 } : it)),
  );

  const mergedAB = mergeShoppingLists(a, b);
  const mergedBA = mergeShoppingLists(b, a);

  assert.equal(mergedAB.items.every((i) => i.checked), true, 'A,B merge should have all six checked');
  assert.equal(mergedBA.items.every((i) => i.checked), true, 'B,A merge should have all six checked');
  assert.equal(stableStringify(mergedAB), stableStringify(mergedBA), 'merge(A,B) must equal merge(B,A)');
});

// ---------------------------------------------------------------------------
// (b) A newer uncheck beats an older check.
// ---------------------------------------------------------------------------
check('(b) newer uncheck beats older check', () => {
  const older = list('plan-1', [item({ ingredientName: 'milk', unit: 'piece', checked: true, checkedAtISO: t1 })]);
  const newer = list('plan-1', [item({ ingredientName: 'milk', unit: 'piece', checked: false, checkedAtISO: t2 })]);

  const merged = mergeShoppingLists(older, newer);
  assert.equal(merged.items[0].checked, false, 'the later uncheck must win');
  assert.equal(merged.items[0].checkedAtISO, t2);

  // Order shouldn't matter.
  const mergedFlipped = mergeShoppingLists(newer, older);
  assert.equal(mergedFlipped.items[0].checked, false);
});

// ---------------------------------------------------------------------------
// (c) Items present on only one side survive the merge.
// ---------------------------------------------------------------------------
check('(c) one-sided items survive', () => {
  const a = list('plan-1', [item({ ingredientName: 'milk', unit: 'piece' })]);
  const b = list('plan-1', [item({ ingredientName: 'eggs', unit: 'piece' })]);

  const merged = mergeShoppingLists(a, b);
  const names = merged.items.map((i) => i.ingredientName).sort();
  assert.deepEqual(names, ['eggs', 'milk']);
});

// ---------------------------------------------------------------------------
// (d) Legacy data with no timestamps loads and merges (epoch-0 semantics):
//     a real, timestamped check beats an untouched legacy item, and two
//     legacy items with no timestamp on either side don't crash and resolve
//     via the true-wins tie-break.
// ---------------------------------------------------------------------------
check('(d) legacy (missing-timestamp) data merges without crashing', () => {
  const legacyUnchecked = list('plan-1', [
    item({ ingredientName: 'milk', unit: 'piece', checked: false, checkedAtISO: undefined }),
    item({ ingredientName: 'eggs', unit: 'piece', checked: true, checkedAtISO: undefined }),
  ]);
  const freshCheck = list('plan-1', [
    item({ ingredientName: 'milk', unit: 'piece', checked: true, checkedAtISO: t1 }),
    item({ ingredientName: 'eggs', unit: 'piece', checked: false, checkedAtISO: undefined }),
  ]);

  const merged = mergeShoppingLists(legacyUnchecked, freshCheck);
  const byName = Object.fromEntries(merged.items.map((i) => [i.ingredientName, i]));

  // A real timestamp always beats a missing one, regardless of which side
  // had the timestamp.
  assert.equal(byName.milk.checked, true, 'a real timestamp must beat a missing one');
  // Both missing (both epoch-0): tie-break is true-wins.
  assert.equal(byName.eggs.checked, true, 'true must win a tie between two missing timestamps');
});

// ---------------------------------------------------------------------------
// (e) planId-differ path keeps the newer plan (by createdAtISO), not
//     "whichever happens to be remote".
// ---------------------------------------------------------------------------
check('(e) differing planId keeps the newer plan either direction', () => {
  const older = { plan: plan('plan-old', [meal(0)], { createdAtISO: t1 }), shoppingList: null };
  const newer = { plan: plan('plan-new', [meal(0)], { createdAtISO: t2 }), shoppingList: null };

  // Newer plan is "local", older is "remote": local must NOT be clobbered.
  const keepLocal = mergeSyncPayload(newer, older);
  assert.equal(keepLocal.plan?.id, 'plan-new', 'a newer local plan must survive a stale remote pull');

  // Newer plan is "remote": local (older) must be replaced by it.
  const takeRemote = mergeSyncPayload(older, newer);
  assert.equal(takeRemote.plan?.id, 'plan-new', 'a genuinely newer remote plan should replace an older local one');
});

// ---------------------------------------------------------------------------
// (f) Idempotence: merge(merge(A,B), B) === merge(A,B).
// ---------------------------------------------------------------------------
check('(f) merge(merge(A,B), B) === merge(A,B) [shopping lists]', () => {
  const a = list('plan-1', [
    item({ ingredientName: 'milk', unit: 'piece', checked: true, checkedAtISO: t1 }),
    item({ ingredientName: 'rice', unit: 'cup' }),
  ]);
  const b = list('plan-1', [
    item({ ingredientName: 'milk', unit: 'piece' }),
    item({ ingredientName: 'eggs', unit: 'piece', checked: true, checkedAtISO: t2 }),
  ]);

  const merged = mergeShoppingLists(a, b);
  const mergedAgain = mergeShoppingLists(merged, b);
  assert.equal(stableStringify(mergedAgain), stableStringify(merged));
});

check('(f) merge(merge(A,B), B) === merge(A,B) [plan meals]', () => {
  const a = plan('plan-1', [meal(0, { cooked: true, cookedAtISO: t1 }), meal(1)]);
  const b = plan('plan-1', [meal(0), meal(1, { cooked: true, cookedAtISO: t2 })]);

  const merged = mergePlanMeals(a, b);
  const mergedAgain = mergePlanMeals(merged, b);
  assert.equal(stableStringify(mergedAgain), stableStringify(merged));
});

check('(f) merge(merge(A,B), B) === merge(A,B) [full sync payload]', () => {
  const a = {
    plan: plan('plan-1', [meal(0, { cooked: true, cookedAtISO: t1 })]),
    shoppingList: list('plan-1', [item({ ingredientName: 'milk', unit: 'piece', checked: true, checkedAtISO: t1 })]),
  };
  const b = {
    plan: plan('plan-1', [meal(0)]),
    shoppingList: list('plan-1', [item({ ingredientName: 'eggs', unit: 'piece', checked: true, checkedAtISO: t2 })]),
  };

  const merged = mergeSyncPayload(a, b);
  const mergedAgain = mergeSyncPayload(merged, b);
  assert.equal(stableStringify(mergedAgain), stableStringify(merged));
});

// ---------------------------------------------------------------------------
// (g) M2.1: cross-device ratings of different meals converge, order-
//     independent — the rating analogue of check (a) for shopping lists.
// ---------------------------------------------------------------------------
check('(g) cross-device ratings of different meals converge, order-independent', () => {
  const a = plan('plan-1', [meal(0, { rating: 5, ratedAtISO: t1 }), meal(1)]);
  const b = plan('plan-1', [meal(0), meal(1, { rating: 3, ratedAtISO: t1 })]);

  const mergedAB = mergePlanMeals(a, b);
  const mergedBA = mergePlanMeals(b, a);

  assert.equal(mergedAB.meals.find((m) => m.dayIndex === 0)?.rating, 5);
  assert.equal(mergedAB.meals.find((m) => m.dayIndex === 1)?.rating, 3);
  assert.equal(stableStringify(mergedAB), stableStringify(mergedBA), 'merge(A,B) must equal merge(B,A)');
});

// ---------------------------------------------------------------------------
// (h) M2.1: a newer rating edit beats an older rating for the same meal —
//     e.g. rate 5, then change your mind to 1; the edit must win, not the
//     original.
// ---------------------------------------------------------------------------
check('(h) newer rating edit beats an older rating', () => {
  const older = plan('plan-1', [meal(0, { rating: 5, ratedAtISO: t1 })]);
  const newer = plan('plan-1', [meal(0, { rating: 1, ratedAtISO: t2 })]);

  const merged = mergePlanMeals(older, newer);
  assert.equal(merged.meals[0].rating, 1, 'the later rating edit must win');
  assert.equal(merged.meals[0].ratedAtISO, t2);

  const mergedFlipped = mergePlanMeals(newer, older);
  assert.equal(mergedFlipped.meals[0].rating, 1);
});

// ---------------------------------------------------------------------------
// (i) M2.2: device A re-rolls a day (new recipeId + recipeChangedAtISO),
//     device B is unchanged -> both merge orders converge to A's new recipe,
//     not a field-by-field mix of the two.
// ---------------------------------------------------------------------------
check('(i) a re-roll on one device beats an unchanged meal on the other, order-independent', () => {
  const a = plan('plan-1', [meal(0, { recipeId: 'new-recipe', recipeChangedAtISO: t2 })]);
  const b = plan('plan-1', [meal(0)]); // unchanged: recipeId 'r0', no recipeChangedAtISO (epoch 0)

  const mergedAB = mergePlanMeals(a, b);
  const mergedBA = mergePlanMeals(b, a);

  assert.equal(mergedAB.meals[0].recipeId, 'new-recipe', 'the re-rolled recipe must win');
  assert.equal(stableStringify(mergedAB), stableStringify(mergedBA), 'merge(A,B) must equal merge(B,A)');
});

// ---------------------------------------------------------------------------
// (j) M2.2 + M2.1 interaction: device B rates the OLD dish, then device A
//     re-rolls that day to a new dish -> the converged meal must have A's
//     new recipe and NO rating (B's rating described a dish that no longer
//     exists in the plan; it must never attach to the new one).
// ---------------------------------------------------------------------------
check('(j) a re-roll discards a rating that belonged to the outgoing recipe', () => {
  const b = plan('plan-1', [meal(0, { rating: 5, ratedAtISO: t1 })]); // rated the original dish
  const a = plan('plan-1', [meal(0, { recipeId: 'new-recipe', recipeChangedAtISO: t2 })]); // re-rolled after B's rating

  const merged = mergePlanMeals(a, b);
  assert.equal(merged.meals[0].recipeId, 'new-recipe', 'the re-rolled recipe must win');
  assert.equal(merged.meals[0].rating, undefined, "the old dish's rating must not survive onto the new dish");
  assert.equal(merged.meals[0].ratedAtISO, null);

  const mergedFlipped = mergePlanMeals(b, a);
  assert.equal(stableStringify(merged), stableStringify(mergedFlipped), 'merge(A,B) must equal merge(B,A)');
});

// ---------------------------------------------------------------------------
// (k) M2.2: both devices re-roll the same day to DIFFERENT recipes -> the
//     newer recipeChangedAtISO wins outright on both merge orders.
// ---------------------------------------------------------------------------
check('(k) two different re-rolls of the same day: the newer one wins, order-independent', () => {
  const a = plan('plan-1', [meal(0, { recipeId: 'recipe-A', recipeChangedAtISO: t1 })]);
  const b = plan('plan-1', [meal(0, { recipeId: 'recipe-B', recipeChangedAtISO: t2 })]);

  const mergedAB = mergePlanMeals(a, b);
  const mergedBA = mergePlanMeals(b, a);

  assert.equal(mergedAB.meals[0].recipeId, 'recipe-B', 'the later re-roll must win');
  assert.equal(stableStringify(mergedAB), stableStringify(mergedBA), 'merge(A,B) must equal merge(B,A)');
});

// ---------------------------------------------------------------------------
// (l) M2.2: idempotence holds for the diverged-recipe path too:
//     merge(merge(A,B), B) === merge(A,B).
// ---------------------------------------------------------------------------
check('(l) merge(merge(A,B), B) === merge(A,B) [diverged recipe]', () => {
  const a = plan('plan-1', [meal(0, { recipeId: 'recipe-A', recipeChangedAtISO: t1 })]);
  const b = plan('plan-1', [meal(0, { recipeId: 'recipe-B', recipeChangedAtISO: t2 })]);

  const merged = mergePlanMeals(a, b);
  const mergedAgain = mergePlanMeals(merged, b);
  assert.equal(stableStringify(mergedAgain), stableStringify(merged));
});

// ---------------------------------------------------------------------------
// Extra: commutativity of the full payload merge on the common (same-planId) path.
// ---------------------------------------------------------------------------
check('commutativity: mergeSyncPayload(A,B) === mergeSyncPayload(B,A)', () => {
  const a = {
    plan: plan('plan-1', [meal(0, { cooked: true, cookedAtISO: t1 }), meal(1)]),
    shoppingList: list('plan-1', [item({ ingredientName: 'milk', unit: 'piece', checked: true, checkedAtISO: t1 })]),
  };
  const b = {
    plan: plan('plan-1', [meal(0), meal(1, { cooked: true, cookedAtISO: t2 })]),
    shoppingList: list('plan-1', [item({ ingredientName: 'milk', unit: 'piece' }), item({ ingredientName: 'eggs', unit: 'piece' })]),
  };

  assert.equal(stableStringify(mergeSyncPayload(a, b)), stableStringify(mergeSyncPayload(b, a)));
});

console.log(`\n${passed} assertions passed.`);
