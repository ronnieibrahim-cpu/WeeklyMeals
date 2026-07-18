/**
 * M2.5: migrated from scripts/checkSyncMerge.ts (M1.6/M2.1/M2.2 sync-merge
 * assertions) into the real test suite, per that script's own note that it
 * should move here once a runner existed. Same fixtures and cases, translated
 * to jest's describe/it/expect.
 */
import { FavoritesMap, IntakeAnswers, ManualItem, ManualItemMap, PlannedMeal, ShoppingItem, ShoppingList, WeeklyPlan } from '@/domain/models';
import { mergeManualItems, mergePlanMeals, mergeShoppingLists, mergeSyncPayload, mergeTimestampedFlagMap, stableStringify } from './syncMerge';

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
    servingsChangedAtISO: null,
    sideRecipeIds: undefined,
    sidesChangedAtISO: null,
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

function favMap(entries: Record<string, { flag: boolean; atISO: string }> = {}): FavoritesMap {
  return entries;
}

function manualItem(over: Partial<ManualItem> & Pick<ManualItem, 'displayName'>): ManualItem {
  return {
    department: 'DryGoods',
    checked: false,
    checkedAtISO: null,
    deleted: false,
    deletedAtISO: null,
    updatedAtISO: '2026-01-01T00:00:00.000Z',
    createdAtISO: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function manualMap(entries: Record<string, ManualItem> = {}): ManualItemMap {
  return entries;
}

const t1 = '2026-07-01T10:00:00.000Z';
const t2 = '2026-07-01T10:05:00.000Z'; // later than t1

describe('mergeShoppingLists', () => {
  it('(a) cross-device checks converge, order-independent', () => {
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

    expect(mergedAB.items.every((i) => i.checked)).toBe(true);
    expect(mergedBA.items.every((i) => i.checked)).toBe(true);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('(b) newer uncheck beats older check', () => {
    const older = list('plan-1', [item({ ingredientName: 'milk', unit: 'piece', checked: true, checkedAtISO: t1 })]);
    const newer = list('plan-1', [item({ ingredientName: 'milk', unit: 'piece', checked: false, checkedAtISO: t2 })]);

    const merged = mergeShoppingLists(older, newer);
    expect(merged.items[0].checked).toBe(false);
    expect(merged.items[0].checkedAtISO).toBe(t2);

    const mergedFlipped = mergeShoppingLists(newer, older);
    expect(mergedFlipped.items[0].checked).toBe(false);
  });

  it('(c) one-sided items survive', () => {
    const a = list('plan-1', [item({ ingredientName: 'milk', unit: 'piece' })]);
    const b = list('plan-1', [item({ ingredientName: 'eggs', unit: 'piece' })]);

    const merged = mergeShoppingLists(a, b);
    const names = merged.items.map((i) => i.ingredientName).sort();
    expect(names).toEqual(['eggs', 'milk']);
  });

  it('(d) legacy (missing-timestamp) data merges without crashing', () => {
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

    // A real timestamp always beats a missing one, regardless of side.
    expect(byName.milk.checked).toBe(true);
    // Both missing (both epoch-0): tie-break is true-wins.
    expect(byName.eggs.checked).toBe(true);
  });

  it('(f) merge(merge(A,B), B) === merge(A,B) [shopping lists]', () => {
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
    expect(stableStringify(mergedAgain)).toBe(stableStringify(merged));
  });
});

describe('mergeSyncPayload — cross-plan (differing id)', () => {
  it('(e) differing planId keeps the newer plan either direction', () => {
    const older = { plan: plan('plan-old', [meal(0)], { createdAtISO: t1 }), shoppingList: null, favorites: favMap(), kidApproved: favMap(), manualItems: manualMap() };
    const newer = { plan: plan('plan-new', [meal(0)], { createdAtISO: t2 }), shoppingList: null, favorites: favMap(), kidApproved: favMap(), manualItems: manualMap() };

    // Newer plan is "local", older is "remote": local must NOT be clobbered.
    const keepLocal = mergeSyncPayload(newer, older);
    expect(keepLocal.plan?.id).toBe('plan-new');

    // Newer plan is "remote": local (older) must be replaced by it.
    const takeRemote = mergeSyncPayload(older, newer);
    expect(takeRemote.plan?.id).toBe('plan-new');
  });
});

describe('mergePlanMeals — cooked/rating (M1.6/M2.1)', () => {
  it('(f) merge(merge(A,B), B) === merge(A,B) [plan meals]', () => {
    const a = plan('plan-1', [meal(0, { cooked: true, cookedAtISO: t1 }), meal(1)]);
    const b = plan('plan-1', [meal(0), meal(1, { cooked: true, cookedAtISO: t2 })]);

    const merged = mergePlanMeals(a, b);
    const mergedAgain = mergePlanMeals(merged, b);
    expect(stableStringify(mergedAgain)).toBe(stableStringify(merged));
  });

  it('(g) cross-device ratings of different meals converge, order-independent', () => {
    const a = plan('plan-1', [meal(0, { rating: 5, ratedAtISO: t1 }), meal(1)]);
    const b = plan('plan-1', [meal(0), meal(1, { rating: 3, ratedAtISO: t1 })]);

    const mergedAB = mergePlanMeals(a, b);
    const mergedBA = mergePlanMeals(b, a);

    expect(mergedAB.meals.find((m) => m.dayIndex === 0)?.rating).toBe(5);
    expect(mergedAB.meals.find((m) => m.dayIndex === 1)?.rating).toBe(3);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('(h) newer rating edit beats an older rating', () => {
    const older = plan('plan-1', [meal(0, { rating: 5, ratedAtISO: t1 })]);
    const newer = plan('plan-1', [meal(0, { rating: 1, ratedAtISO: t2 })]);

    const merged = mergePlanMeals(older, newer);
    expect(merged.meals[0].rating).toBe(1);
    expect(merged.meals[0].ratedAtISO).toBe(t2);

    const mergedFlipped = mergePlanMeals(newer, older);
    expect(mergedFlipped.meals[0].rating).toBe(1);
  });
});

describe('mergePlanMeals — servings (M4.1)', () => {
  it('(o) merge(merge(A,B), B) === merge(A,B) [servings]', () => {
    const a = plan('plan-1', [meal(0, { servings: 6, servingsChangedAtISO: t1 }), meal(1)]);
    const b = plan('plan-1', [meal(0), meal(1, { servings: 3, servingsChangedAtISO: t2 })]);

    const merged = mergePlanMeals(a, b);
    const mergedAgain = mergePlanMeals(merged, b);
    expect(stableStringify(mergedAgain)).toBe(stableStringify(merged));
  });

  it('(p) cross-device servings edits of different meals converge, order-independent', () => {
    const a = plan('plan-1', [meal(0, { servings: 6, servingsChangedAtISO: t1 }), meal(1)]);
    const b = plan('plan-1', [meal(0), meal(1, { servings: 2, servingsChangedAtISO: t1 })]);

    const mergedAB = mergePlanMeals(a, b);
    const mergedBA = mergePlanMeals(b, a);

    expect(mergedAB.meals.find((m) => m.dayIndex === 0)?.servings).toBe(6);
    expect(mergedAB.meals.find((m) => m.dayIndex === 1)?.servings).toBe(2);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('(q) a newer servings edit on the same meal beats an older one, both merge orders', () => {
    const older = plan('plan-1', [meal(0, { servings: 4, servingsChangedAtISO: t1 })]);
    const newer = plan('plan-1', [meal(0, { servings: 6, servingsChangedAtISO: t2 })]);

    const merged = mergePlanMeals(older, newer);
    expect(merged.meals[0].servings).toBe(6);
    expect(merged.meals[0].servingsChangedAtISO).toBe(t2);

    const mergedFlipped = mergePlanMeals(newer, older);
    expect(mergedFlipped.meals[0].servings).toBe(6);
  });

  it('(r) a tie on servingsChangedAtISO (e.g. both null, pre-migration data) resolves deterministically either direction', () => {
    const a = plan('plan-1', [meal(0, { servings: 4, servingsChangedAtISO: null })]);
    const b = plan('plan-1', [meal(0, { servings: 6, servingsChangedAtISO: null })]);

    const mergedAB = mergePlanMeals(a, b);
    const mergedBA = mergePlanMeals(b, a);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('(s) the race this feature introduces: a re-roll wins the whole meal body, even against a servings edit with a NEWER timestamp on the losing side', () => {
    // Device A re-rolls day 0 to a new recipe at t1.
    const a = plan('plan-1', [meal(0, { recipeId: 'new-recipe', recipeChangedAtISO: t1 })]);
    // Device B, unaware of the re-roll, bumps servings on the ORIGINAL
    // recipe at t2 — chronologically newer than the re-roll, but it's the
    // wrong dish now.
    const b = plan('plan-1', [meal(0, { servings: 8, servingsChangedAtISO: t2 })]);

    const mergedAB = mergePlanMeals(a, b);
    const mergedBA = mergePlanMeals(b, a);

    // The re-roll wins the ENTIRE meal body — including servings — no
    // matter how fresh B's servings timestamp is, because recipeId
    // diverged and `resolveDivergedRecipe` gates the whole thing on
    // recipeChangedAtISO, not on any individual field's own timestamp.
    expect(mergedAB.meals[0].recipeId).toBe('new-recipe');
    expect(mergedAB.meals[0].servings).toBe(4); // A's original servings (the meal() default), not B's 8
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));

    // Idempotence for this case too.
    const mergedAgain = mergePlanMeals(mergedAB, b);
    expect(stableStringify(mergedAgain)).toBe(stableStringify(mergedAB));
  });
});

describe('mergePlanMeals — sides (M4.2 part 2)', () => {
  it('(t) merge(merge(A,B), B) === merge(A,B) [sides]', () => {
    const a = plan('plan-1', [meal(0, { sideRecipeIds: ['side-a'], sidesChangedAtISO: t1 }), meal(1)]);
    const b = plan('plan-1', [meal(0), meal(1, { sideRecipeIds: ['side-b'], sidesChangedAtISO: t2 })]);

    const merged = mergePlanMeals(a, b);
    const mergedAgain = mergePlanMeals(merged, b);
    expect(stableStringify(mergedAgain)).toBe(stableStringify(merged));
  });

  it('(u) cross-device sides edits of different meals converge, order-independent', () => {
    const a = plan('plan-1', [meal(0, { sideRecipeIds: ['side-a'], sidesChangedAtISO: t1 }), meal(1)]);
    const b = plan('plan-1', [meal(0), meal(1, { sideRecipeIds: ['side-b'], sidesChangedAtISO: t1 })]);

    const mergedAB = mergePlanMeals(a, b);
    const mergedBA = mergePlanMeals(b, a);

    expect(mergedAB.meals.find((m) => m.dayIndex === 0)?.sideRecipeIds).toEqual(['side-a']);
    expect(mergedAB.meals.find((m) => m.dayIndex === 1)?.sideRecipeIds).toEqual(['side-b']);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('(v) a newer sides edit on the same meal beats an older one, both merge orders', () => {
    const older = plan('plan-1', [meal(0, { sideRecipeIds: ['side-old'], sidesChangedAtISO: t1 })]);
    const newer = plan('plan-1', [meal(0, { sideRecipeIds: ['side-new'], sidesChangedAtISO: t2 })]);

    const merged = mergePlanMeals(older, newer);
    expect(merged.meals[0].sideRecipeIds).toEqual(['side-new']);
    expect(merged.meals[0].sidesChangedAtISO).toBe(t2);

    const mergedFlipped = mergePlanMeals(newer, older);
    expect(mergedFlipped.meals[0].sideRecipeIds).toEqual(['side-new']);
  });

  it('(w) a tie on sidesChangedAtISO (both null/missing) resolves deterministically either direction', () => {
    const a = plan('plan-1', [meal(0, { sideRecipeIds: ['side-a'], sidesChangedAtISO: null })]);
    const b = plan('plan-1', [meal(0, { sideRecipeIds: ['side-b'], sidesChangedAtISO: null })]);

    const mergedAB = mergePlanMeals(a, b);
    const mergedBA = mergePlanMeals(b, a);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('(x) the specific race this feature introduces: one phone swaps a side while the other re-rolls the same day — the re-roll wins the whole plate, even against a NEWER sides timestamp on the losing side', () => {
    // Device A re-rolls day 0 to a whole new plate (main + sides) at t1.
    const a = plan('plan-1', [
      meal(0, { recipeId: 'new-recipe', recipeChangedAtISO: t1, sideRecipeIds: ['new-side'], sidesChangedAtISO: t1 }),
    ]);
    // Device B, unaware of the re-roll, removes a side from the ORIGINAL
    // recipe's plate at t2 — chronologically newer than the re-roll, but
    // it's the wrong dish now.
    const b = plan('plan-1', [meal(0, { sideRecipeIds: [], sidesChangedAtISO: t2 })]);

    const mergedAB = mergePlanMeals(a, b);
    const mergedBA = mergePlanMeals(b, a);

    // The re-roll wins the ENTIRE meal body — including sideRecipeIds — no
    // matter how fresh B's sidesChangedAtISO is, because recipeId diverged
    // and `resolveDivergedRecipe` gates the whole thing on
    // recipeChangedAtISO, not on any individual field's own timestamp.
    expect(mergedAB.meals[0].recipeId).toBe('new-recipe');
    expect(mergedAB.meals[0].sideRecipeIds).toEqual(['new-side']);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));

    // Idempotence for this case too.
    const mergedAgain = mergePlanMeals(mergedAB, b);
    expect(stableStringify(mergedAgain)).toBe(stableStringify(mergedAB));
  });
});

describe('mergePlanMeals — diverged recipe (M2.2 re-roll)', () => {
  it('(i) a re-roll on one device beats an unchanged meal on the other, order-independent', () => {
    const a = plan('plan-1', [meal(0, { recipeId: 'new-recipe', recipeChangedAtISO: t2 })]);
    const b = plan('plan-1', [meal(0)]); // unchanged: recipeId 'r0', no recipeChangedAtISO (epoch 0)

    const mergedAB = mergePlanMeals(a, b);
    const mergedBA = mergePlanMeals(b, a);

    expect(mergedAB.meals[0].recipeId).toBe('new-recipe');
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('(j) a re-roll discards a rating that belonged to the outgoing recipe', () => {
    const b = plan('plan-1', [meal(0, { rating: 5, ratedAtISO: t1 })]); // rated the original dish
    const a = plan('plan-1', [meal(0, { recipeId: 'new-recipe', recipeChangedAtISO: t2 })]); // re-rolled after B's rating

    const merged = mergePlanMeals(a, b);
    expect(merged.meals[0].recipeId).toBe('new-recipe');
    expect(merged.meals[0].rating).toBeUndefined();
    expect(merged.meals[0].ratedAtISO).toBeNull();

    const mergedFlipped = mergePlanMeals(b, a);
    expect(stableStringify(merged)).toBe(stableStringify(mergedFlipped));
  });

  it('(k) two different re-rolls of the same day: the newer one wins, order-independent', () => {
    const a = plan('plan-1', [meal(0, { recipeId: 'recipe-A', recipeChangedAtISO: t1 })]);
    const b = plan('plan-1', [meal(0, { recipeId: 'recipe-B', recipeChangedAtISO: t2 })]);

    const mergedAB = mergePlanMeals(a, b);
    const mergedBA = mergePlanMeals(b, a);

    expect(mergedAB.meals[0].recipeId).toBe('recipe-B');
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('(l) merge(merge(A,B), B) === merge(A,B) [diverged recipe]', () => {
    const a = plan('plan-1', [meal(0, { recipeId: 'recipe-A', recipeChangedAtISO: t1 })]);
    const b = plan('plan-1', [meal(0, { recipeId: 'recipe-B', recipeChangedAtISO: t2 })]);

    const merged = mergePlanMeals(a, b);
    const mergedAgain = mergePlanMeals(merged, b);
    expect(stableStringify(mergedAgain)).toBe(stableStringify(merged));
  });
});

describe('mergeSyncPayload — full payload', () => {
  it('(f) merge(merge(A,B), B) === merge(A,B) [full sync payload]', () => {
    const a = {
      plan: plan('plan-1', [meal(0, { cooked: true, cookedAtISO: t1 })]),
      shoppingList: list('plan-1', [item({ ingredientName: 'milk', unit: 'piece', checked: true, checkedAtISO: t1 })]),
      favorites: favMap({ 'recipe-a': { flag: true, atISO: t1 } }),
      kidApproved: favMap(),
      manualItems: manualMap(),
    };
    const b = {
      plan: plan('plan-1', [meal(0)]),
      shoppingList: list('plan-1', [item({ ingredientName: 'eggs', unit: 'piece', checked: true, checkedAtISO: t2 })]),
      favorites: favMap({ 'recipe-b': { flag: true, atISO: t2 } }),
      kidApproved: favMap(),
      manualItems: manualMap(),
    };

    const merged = mergeSyncPayload(a, b);
    const mergedAgain = mergeSyncPayload(merged, b);
    expect(stableStringify(mergedAgain)).toBe(stableStringify(merged));
  });

  it('commutativity: mergeSyncPayload(A,B) === mergeSyncPayload(B,A)', () => {
    const a = {
      plan: plan('plan-1', [meal(0, { cooked: true, cookedAtISO: t1 }), meal(1)]),
      shoppingList: list('plan-1', [item({ ingredientName: 'milk', unit: 'piece', checked: true, checkedAtISO: t1 })]),
      favorites: favMap({ 'recipe-a': { flag: true, atISO: t1 } }),
      kidApproved: favMap({ 'recipe-x': { flag: true, atISO: t1 } }),
      manualItems: manualMap(),
    };
    const b = {
      plan: plan('plan-1', [meal(0), meal(1, { cooked: true, cookedAtISO: t2 })]),
      shoppingList: list('plan-1', [
        item({ ingredientName: 'milk', unit: 'piece' }),
        item({ ingredientName: 'eggs', unit: 'piece' }),
      ]),
      favorites: favMap({ 'recipe-b': { flag: true, atISO: t2 } }),
      kidApproved: favMap({ 'recipe-y': { flag: true, atISO: t2 } }),
      manualItems: manualMap(),
    };

    expect(stableStringify(mergeSyncPayload(a, b))).toBe(stableStringify(mergeSyncPayload(b, a)));
  });

  it('(m) favorites merge independently of plan state, including when one side has no plan', () => {
    const withPlan = {
      plan: plan('plan-1', [meal(0)]),
      shoppingList: null,
      favorites: favMap({ 'recipe-a': { flag: true, atISO: t1 } }),
      kidApproved: favMap(),
      manualItems: manualMap(),
    };
    const noPlan = {
      plan: null,
      shoppingList: null,
      favorites: favMap({ 'recipe-b': { flag: true, atISO: t2 } }),
      kidApproved: favMap(),
      manualItems: manualMap(),
    };

    const merged = mergeSyncPayload(withPlan, noPlan);
    expect(merged.plan?.id).toBe('plan-1');
    expect(Object.keys(merged.favorites).sort()).toEqual(['recipe-a', 'recipe-b']);

    const flipped = mergeSyncPayload(noPlan, withPlan);
    expect(stableStringify(merged)).toBe(stableStringify(flipped));
  });

  it('(n) kidApproved merges independently too, and a newer un-approve beats an older approve (M3.2)', () => {
    const a = {
      plan: plan('plan-1', [meal(0)]),
      shoppingList: null,
      favorites: favMap(),
      kidApproved: favMap({ 'recipe-a': { flag: true, atISO: t1 }, 'recipe-shared': { flag: true, atISO: t1 } }),
      manualItems: manualMap(),
    };
    const b = {
      plan: plan('plan-1', [meal(0)]),
      shoppingList: null,
      favorites: favMap(),
      kidApproved: favMap({ 'recipe-b': { flag: true, atISO: t1 }, 'recipe-shared': { flag: false, atISO: t2 } }),
      manualItems: manualMap(),
    };

    const merged = mergeSyncPayload(a, b);
    expect(merged.kidApproved['recipe-a'].flag).toBe(true);
    expect(merged.kidApproved['recipe-b'].flag).toBe(true);
    expect(merged.kidApproved['recipe-shared'].flag).toBe(false); // newer un-approve wins

    const flipped = mergeSyncPayload(b, a);
    expect(stableStringify(merged)).toBe(stableStringify(flipped));
  });
});

describe('mergeTimestampedFlagMap (M3.1 favorites, reused by M3.2 kidApproved)', () => {
  it('two devices favoriting different recipes converge to the union', () => {
    const a = favMap({ 'recipe-a': { flag: true, atISO: t1 } });
    const b = favMap({ 'recipe-b': { flag: true, atISO: t1 } });

    const mergedAB = mergeTimestampedFlagMap(a, b);
    const mergedBA = mergeTimestampedFlagMap(b, a);

    expect(mergedAB['recipe-a'].flag).toBe(true);
    expect(mergedAB['recipe-b'].flag).toBe(true);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('an unfavorite with a newer timestamp beats an older favorite', () => {
    const favorited = favMap({ 'recipe-a': { flag: true, atISO: t1 } });
    const unfavorited = favMap({ 'recipe-a': { flag: false, atISO: t2 } });

    const merged = mergeTimestampedFlagMap(favorited, unfavorited);
    expect(merged['recipe-a'].flag).toBe(false);
    expect(merged['recipe-a'].atISO).toBe(t2);

    const flipped = mergeTimestampedFlagMap(unfavorited, favorited);
    expect(flipped['recipe-a'].flag).toBe(false);
  });

  it('merge(merge(A,B), B) === merge(A,B) [favorites]', () => {
    const a = favMap({ 'recipe-a': { flag: true, atISO: t1 } });
    const b = favMap({ 'recipe-b': { flag: true, atISO: t2 } });

    const merged = mergeTimestampedFlagMap(a, b);
    const mergedAgain = mergeTimestampedFlagMap(merged, b);
    expect(stableStringify(mergedAgain)).toBe(stableStringify(merged));
  });
});

describe('mergeManualItems (M3.3)', () => {
  it('concurrent adds of the same name on two devices converge to one row, not a duplicate', () => {
    const a = manualMap({ milk: manualItem({ displayName: 'Milk', department: 'Dairy', createdAtISO: t1, updatedAtISO: t1 }) });
    const b = manualMap({ milk: manualItem({ displayName: 'milk', department: 'Dairy', createdAtISO: t1, updatedAtISO: t1 }) });

    const mergedAB = mergeManualItems(a, b);
    const mergedBA = mergeManualItems(b, a);

    expect(Object.keys(mergedAB)).toEqual(['milk']);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('delete-vs-check race: an approve-clear deleting an item on one device and a check on the other in the same window converge to the same state either direction', () => {
    // Device A: user checked "eggs" earlier, then approved a new week, which
    // clears checked manual items — soft-deleting it at t2.
    const deletedByApprove = manualMap({
      eggs: manualItem({ displayName: 'eggs', checked: true, checkedAtISO: t1, deleted: true, deletedAtISO: t2 }),
    });
    // Device B: hasn't seen the approve yet, and — in that same window —
    // independently taps the checkbox again (already checked, re-checking
    // is a no-op in the UI, but a real device could also be checking it for
    // the first time at a nearby timestamp).
    const checkedElsewhere = manualMap({
      eggs: manualItem({ displayName: 'eggs', checked: true, checkedAtISO: t2, deleted: false, deletedAtISO: null }),
    });

    const mergedAB = mergeManualItems(deletedByApprove, checkedElsewhere);
    const mergedBA = mergeManualItems(checkedElsewhere, deletedByApprove);

    // deleted/checked are resolved independently by timestamp: deleted has
    // the only (later-or-equal) real deletedAtISO, so it wins regardless of
    // which side merges first.
    expect(mergedAB.eggs.deleted).toBe(true);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('tombstone override: a newer re-add always beats an older delete, in either device order', () => {
    const deletedOnly = manualMap({
      butter: manualItem({ displayName: 'butter', deleted: true, deletedAtISO: t1, updatedAtISO: t1 }),
    });
    // Re-added later (fresh deletedAtISO stamped false, per the store's
    // "reviving a tombstoned key" contract — see manualItemsStore.add).
    const reAdded = manualMap({
      butter: manualItem({ displayName: 'butter', deleted: false, deletedAtISO: t2, updatedAtISO: t2 }),
    });

    const mergedAB = mergeManualItems(deletedOnly, reAdded);
    const mergedBA = mergeManualItems(reAdded, deletedOnly);

    expect(mergedAB.butter.deleted).toBe(false);
    expect(mergedBA.butter.deleted).toBe(false);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('a rename (tombstone old key + new key) leaves the old key deleted and the new key present, converging either direction', () => {
    const before = manualMap({ soda: manualItem({ displayName: 'soda', updatedAtISO: t1 }) });
    // Local device renamed "soda" -> "sparkling water": tombstones "soda",
    // adds a fresh entry at "sparkling water".
    const afterRename = manualMap({
      soda: manualItem({ displayName: 'soda', deleted: true, deletedAtISO: t2, updatedAtISO: t1 }),
      'sparkling water': manualItem({ displayName: 'sparkling water', createdAtISO: t2, updatedAtISO: t2 }),
    });

    const mergedAB = mergeManualItems(before, afterRename);
    const mergedBA = mergeManualItems(afterRename, before);

    expect(mergedAB.soda.deleted).toBe(true);
    expect(mergedAB['sparkling water'].deleted).toBe(false);
    expect(stableStringify(mergedAB)).toBe(stableStringify(mergedBA));
  });

  it('merge(merge(A,B), B) === merge(A,B) [manual items]', () => {
    const a = manualMap({
      milk: manualItem({ displayName: 'Milk', checked: true, checkedAtISO: t1 }),
      soap: manualItem({ displayName: 'dish soap', department: 'Household' }),
    });
    const b = manualMap({
      milk: manualItem({ displayName: 'Milk' }),
      eggs: manualItem({ displayName: 'eggs', checked: true, checkedAtISO: t2 }),
    });

    const merged = mergeManualItems(a, b);
    const mergedAgain = mergeManualItems(merged, b);
    expect(stableStringify(mergedAgain)).toBe(stableStringify(merged));
  });
});
