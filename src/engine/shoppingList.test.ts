import { GroceryProvider } from '@/data/grocery/GroceryProvider';
import { Recipe } from '@/domain/models';

import { addIngredientsToShoppingList, applyShoppingListDelta, buildShoppingList, computeServingsDelta } from './shoppingList';
import { makeMeal, makeRecipe } from './testFixtures';

/** $1 per unit of quantity — makes totals trivial to assert on. */
const fakeGrocery: GroceryProvider = {
  name: 'Fake',
  departmentOrder: ['Produce', 'Meat', 'Seafood', 'Bakery', 'Frozen', 'Dairy', 'DryGoods', 'International', 'Spices', 'Household'],
  priceFor: (ingredientName, quantity) => ({ productName: ingredientName, price: quantity }),
};

describe('buildShoppingList', () => {
  it('excludes pantryStaple ingredients from the list entirely', () => {
    const recipe = makeRecipe({
      id: 'r1',
      baseServings: 4,
      ingredients: [
        { name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' },
        { name: 'salt', quantity: 1, unit: 'tsp', department: 'Spices', pantryStaple: true },
      ],
    });
    const recipesById: Record<string, Recipe> = { r1: recipe };
    const meals = [makeMeal({ recipeId: 'r1', dayIndex: 0, servings: 4 })];

    const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

    expect(list.items.map((i) => i.ingredientName)).toEqual(['chicken']);
  });

  it('excludes ingredients the user already has in their pantry (fuzzy match)', () => {
    const recipe = makeRecipe({
      id: 'r1',
      ingredients: [
        { name: 'olive oil', quantity: 2, unit: 'tbsp', department: 'DryGoods' },
        { name: 'garlic', quantity: 3, unit: 'clove', department: 'Produce' },
      ],
    });
    const recipesById: Record<string, Recipe> = { r1: recipe };
    const meals = [makeMeal({ recipeId: 'r1', dayIndex: 0, servings: 4 })];

    const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], ['Olive Oil'], fakeGrocery);

    expect(list.items.map((i) => i.ingredientName)).toEqual(['garlic']);
  });

  it('scales ingredient quantities by servings relative to baseServings', () => {
    const recipe = makeRecipe({
      id: 'r1',
      baseServings: 4,
      ingredients: [{ name: 'rice', quantity: 2, unit: 'cup', department: 'DryGoods' }],
    });
    const recipesById: Record<string, Recipe> = { r1: recipe };
    // 8 people on a recipe that serves 4 => double the rice.
    const meals = [makeMeal({ recipeId: 'r1', dayIndex: 0, servings: 8 })];

    const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

    expect(list.items[0].quantity).toBe(4);
  });

  it('consolidates the same ingredient+unit across multiple meals into one line', () => {
    const a = makeRecipe({
      id: 'a',
      baseServings: 4,
      ingredients: [{ name: 'onion', quantity: 1, unit: 'piece', department: 'Produce' }],
    });
    const b = makeRecipe({
      id: 'b',
      baseServings: 4,
      ingredients: [{ name: 'Onion', quantity: 2, unit: 'piece', department: 'Produce' }],
    });
    const recipesById: Record<string, Recipe> = { a, b };
    const meals = [
      makeMeal({ recipeId: 'a', dayIndex: 0, servings: 4 }),
      makeMeal({ recipeId: 'b', dayIndex: 1, servings: 4 }),
    ];

    const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

    expect(list.items).toHaveLength(1);
    expect(list.items[0].quantity).toBe(3);
    expect(list.items[0].fromRecipeIds.sort()).toEqual(['a', 'b']);
  });

  it('keeps different units of the same ingredient as separate lines', () => {
    const a = makeRecipe({
      id: 'a',
      ingredients: [{ name: 'parmesan', quantity: 1, unit: 'cup', department: 'Dairy' }],
    });
    const b = makeRecipe({
      id: 'b',
      ingredients: [{ name: 'parmesan', quantity: 4, unit: 'oz', department: 'Dairy' }],
    });
    const recipesById: Record<string, Recipe> = { a, b };
    const meals = [
      makeMeal({ recipeId: 'a', dayIndex: 0, servings: 4 }),
      makeMeal({ recipeId: 'b', dayIndex: 1, servings: 4 }),
    ];

    const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

    expect(list.items).toHaveLength(2);
  });

  it('computes estimatedTotal and costPerServing from the priced items', () => {
    const recipe = makeRecipe({
      id: 'r1',
      baseServings: 4,
      ingredients: [{ name: 'shrimp', quantity: 10, unit: 'oz', department: 'Seafood' }],
    });
    const recipesById: Record<string, Recipe> = { r1: recipe };
    const meals = [makeMeal({ recipeId: 'r1', dayIndex: 0, servings: 4 })];

    const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

    // fakeGrocery prices at $1/unit-quantity, so a 10oz line costs $10.
    expect(list.estimatedTotal).toBe(10);
    expect(list.costPerServing).toBe(2.5); // $10 / 4 servings
  });

  it('skips a meal whose recipe cannot be resolved instead of throwing', () => {
    const meals = [makeMeal({ recipeId: 'missing', dayIndex: 0, servings: 4 })];

    const list = buildShoppingList('plan-1', meals, () => undefined, [], fakeGrocery);

    expect(list.items).toEqual([]);
    expect(list.estimatedTotal).toBe(0);
  });

  it('M4.2: folds a meal\'s composed sides\' ingredients into the same list as the main', () => {
    const main = makeRecipe({
      id: 'main',
      baseServings: 4,
      ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
    });
    const side = makeRecipe({
      id: 'side',
      baseServings: 4,
      ingredients: [{ name: 'broccoli', quantity: 1, unit: 'lb', department: 'Produce' }],
    });
    const recipesById: Record<string, Recipe> = { main, side };
    const meals = [makeMeal({ recipeId: 'main', dayIndex: 0, servings: 4, sideRecipeIds: ['side'] })];

    const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

    expect(list.items.map((i) => i.ingredientName).sort()).toEqual(['broccoli', 'chicken']);
    const broccoli = list.items.find((i) => i.ingredientName === 'broccoli');
    expect(broccoli?.fromRecipeIds).toEqual(['side']);
  });

  it('M4.2: scales a side by the same meal.servings as the main, not the side\'s own baseServings alone', () => {
    const main = makeRecipe({ id: 'main', baseServings: 4, ingredients: [] });
    const side = makeRecipe({
      id: 'side',
      baseServings: 4,
      ingredients: [{ name: 'rice', quantity: 1, unit: 'cup', department: 'DryGoods' }],
    });
    const recipesById: Record<string, Recipe> = { main, side };
    // 8 people on a side that serves 4 => double the rice, same as a main would scale.
    const meals = [makeMeal({ recipeId: 'main', dayIndex: 0, servings: 8, sideRecipeIds: ['side'] })];

    const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

    expect(list.items.find((i) => i.ingredientName === 'rice')?.quantity).toBe(2);
  });

  it('M4.2: a meal with no sides (undefined sideRecipeIds) behaves exactly as before', () => {
    const main = makeRecipe({ id: 'main', ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }] });
    const recipesById: Record<string, Recipe> = { main };
    const meals = [makeMeal({ recipeId: 'main', dayIndex: 0, servings: 4 })];

    const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

    expect(list.items.map((i) => i.ingredientName)).toEqual(['chicken']);
  });
});

describe('addIngredientsToShoppingList (M3.1 — explicit "Add these to shopping list" button on pin-to-week)', () => {
  const baseList = () =>
    buildShoppingList(
      'plan-1',
      [makeMeal({ recipeId: 'r1', dayIndex: 0, servings: 4 })],
      () => makeRecipe({ id: 'r1', ingredients: [{ name: 'onion', quantity: 1, unit: 'piece', department: 'Produce' }] }),
      [],
      fakeGrocery,
    );

  it('adds a brand-new ingredient as its own line, priced and attributed to the pinned recipe', () => {
    const list = addIngredientsToShoppingList(
      baseList(),
      [{ name: 'garlic', quantity: 3, unit: 'clove', department: 'Produce' }],
      'pinned-recipe',
      fakeGrocery,
    );

    expect(list.items).toHaveLength(2);
    const garlic = list.items.find((i) => i.ingredientName === 'garlic');
    expect(garlic?.quantity).toBe(3);
    expect(garlic?.fromRecipeIds).toEqual(['pinned-recipe']);
    expect(list.estimatedTotal).toBe(4); // 1 (onion) + 3 (garlic) at $1/unit
  });

  it('bumps quantity and adds the source recipe when the ingredient is already on the list', () => {
    const list = addIngredientsToShoppingList(
      baseList(),
      [{ name: 'onion', quantity: 2, unit: 'piece', department: 'Produce' }],
      'pinned-recipe',
      fakeGrocery,
    );

    expect(list.items).toHaveLength(1);
    expect(list.items[0].quantity).toBe(3); // 1 existing + 2 added
    expect(list.items[0].fromRecipeIds.sort()).toEqual(['pinned-recipe', 'r1']);
  });

  it('skips pantry-staple ingredients', () => {
    const list = addIngredientsToShoppingList(
      baseList(),
      [{ name: 'salt', quantity: 1, unit: 'tsp', department: 'Spices', pantryStaple: true }],
      'pinned-recipe',
      fakeGrocery,
    );
    expect(list.items).toHaveLength(1); // only the original onion line
  });

  it('never mutates the original list object or its items (immutability)', () => {
    const original = baseList();
    const originalItemsSnapshot = original.items.map((i) => ({ ...i }));

    addIngredientsToShoppingList(
      original,
      [{ name: 'garlic', quantity: 1, unit: 'clove', department: 'Produce' }],
      'pinned-recipe',
      fakeGrocery,
    );

    expect(original.items).toEqual(originalItemsSnapshot);
  });
});

describe('computeServingsDelta (M4.1 — servings change on an approved plan)', () => {
  const recipe = makeRecipe({
    id: 'r1',
    baseServings: 4,
    ingredients: [
      { name: 'chicken thighs', quantity: 2, unit: 'lb', department: 'Meat' },
      { name: 'salt', quantity: 1, unit: 'tsp', department: 'Spices', pantryStaple: true },
      { name: 'garlic', quantity: 3, unit: 'clove', department: 'Produce' },
    ],
  });

  it('tags an increase and computes the positive per-ingredient difference', () => {
    const delta = computeServingsDelta(recipe, 4, 6, []);
    expect(delta.direction).toBe('increase');
    const chicken = delta.lines.find((l) => l.ingredientName === 'chicken thighs');
    // 4 servings -> 2 lb, 6 servings -> 3 lb, delta = 1 lb.
    expect(chicken?.deltaQuantity).toBe(1);
  });

  it('tags a decrease and computes the same positive magnitude', () => {
    const delta = computeServingsDelta(recipe, 4, 2, []);
    expect(delta.direction).toBe('decrease');
    const chicken = delta.lines.find((l) => l.ingredientName === 'chicken thighs');
    // 4 servings -> 2 lb, 2 servings -> 1 lb, delta = 1 lb (positive magnitude either way).
    expect(chicken?.deltaQuantity).toBe(1);
  });

  it('never includes pantry-staple ingredients', () => {
    const delta = computeServingsDelta(recipe, 4, 8, []);
    expect(delta.lines.some((l) => l.ingredientName === 'salt')).toBe(false);
  });

  it('never includes ingredients already on hand (fuzzy pantry match)', () => {
    const delta = computeServingsDelta(recipe, 4, 8, ['Garlic']);
    expect(delta.lines.some((l) => l.ingredientName === 'garlic')).toBe(false);
    expect(delta.lines.some((l) => l.ingredientName === 'chicken thighs')).toBe(true);
  });

  it('produces no lines when servings does not change', () => {
    const delta = computeServingsDelta(recipe, 4, 4, []);
    expect(delta.lines).toEqual([]);
  });

  it('produces an empty delta for a recipe with baseServings: 0', () => {
    const zeroBase = makeRecipe({ baseServings: 0, ingredients: [{ name: 'rice', quantity: 1, unit: 'cup', department: 'DryGoods' }] });
    const delta = computeServingsDelta(zeroBase, 4, 8, []);
    expect(delta.lines).toEqual([]);
  });
});

describe('applyShoppingListDelta (M4.1)', () => {
  const recipeA = makeRecipe({
    id: 'a',
    baseServings: 4,
    ingredients: [{ name: 'onion', quantity: 2, unit: 'piece', department: 'Produce' }],
  });
  const recipeB = makeRecipe({
    id: 'b',
    baseServings: 4,
    ingredients: [{ name: 'onion', quantity: 1, unit: 'piece', department: 'Produce' }],
  });

  function twoMealList() {
    return buildShoppingList(
      'plan-1',
      [makeMeal({ recipeId: 'a', dayIndex: 0, servings: 4 }), makeMeal({ recipeId: 'b', dayIndex: 1, servings: 4 })],
      (id) => ({ a: recipeA, b: recipeB })[id],
      [],
      fakeGrocery,
    );
  }

  it('increases an existing item quantity and re-prices it', () => {
    const list = twoMealList(); // onion: 2 (a) + 1 (b) = 3
    const delta = computeServingsDelta(recipeA, 4, 8, []); // a's onion: 2 -> 4, delta 2, increase
    const next = applyShoppingListDelta(list, delta, 'a', fakeGrocery);
    const onion = next.items.find((i) => i.ingredientName === 'onion');
    expect(onion?.quantity).toBe(5); // 3 + 2
    expect(onion?.estimatedPrice).toBe(5); // fakeGrocery: $1/unit
  });

  it('an ingredient shared by two meals only loses THIS meal\'s share on decrease, never the other meal\'s', () => {
    const list = twoMealList(); // onion: 2 (a) + 1 (b) = 3
    const delta = computeServingsDelta(recipeA, 4, 2, []); // a's onion: 2 -> 1, delta 1, decrease
    const next = applyShoppingListDelta(list, delta, 'a', fakeGrocery);
    const onion = next.items.find((i) => i.ingredientName === 'onion');
    // Only a's own 1-unit reduction is removed; b's contribution (1) survives untouched.
    expect(onion?.quantity).toBe(2); // 3 - 1
  });

  it('removes a line entirely when a decrease would zero out a sole contributor', () => {
    const list = buildShoppingList(
      'plan-1',
      [makeMeal({ recipeId: 'a', dayIndex: 0, servings: 4 })],
      (id) => ({ a: recipeA })[id],
      [],
      fakeGrocery,
    );
    const delta = computeServingsDelta(recipeA, 4, 0, []); // a's onion: 2 -> 0, delta 2, decrease
    const next = applyShoppingListDelta(list, delta, 'a', fakeGrocery);
    expect(next.items.find((i) => i.ingredientName === 'onion')).toBeUndefined();
  });

  it('preserves checked/checkedAtISO on the touched item', () => {
    const list = twoMealList();
    const checkedList = {
      ...list,
      items: list.items.map((i) => (i.ingredientName === 'onion' ? { ...i, checked: true, checkedAtISO: '2026-07-01T00:00:00.000Z' } : i)),
    };
    const delta = computeServingsDelta(recipeA, 4, 8, []);
    const next = applyShoppingListDelta(checkedList, delta, 'a', fakeGrocery);
    const onion = next.items.find((i) => i.ingredientName === 'onion');
    expect(onion?.checked).toBe(true);
    expect(onion?.checkedAtISO).toBe('2026-07-01T00:00:00.000Z');
  });

  it('leaves unrelated items completely untouched', () => {
    const recipeC = makeRecipe({ id: 'c', baseServings: 4, ingredients: [{ name: 'rice', quantity: 1, unit: 'cup', department: 'DryGoods' }] });
    const list = buildShoppingList(
      'plan-1',
      [makeMeal({ recipeId: 'a', dayIndex: 0, servings: 4 }), makeMeal({ recipeId: 'c', dayIndex: 1, servings: 4 })],
      (id) => ({ a: recipeA, c: recipeC })[id],
      [],
      fakeGrocery,
    );
    const rice = list.items.find((i) => i.ingredientName === 'rice');
    const delta = computeServingsDelta(recipeA, 4, 8, []);
    const next = applyShoppingListDelta(list, delta, 'a', fakeGrocery);
    expect(next.items.find((i) => i.ingredientName === 'rice')).toEqual(rice);
  });

  it('recomputes estimatedTotal from the adjusted items', () => {
    const list = twoMealList(); // total $3 (3 onions at $1/unit)
    const delta = computeServingsDelta(recipeA, 4, 8, []); // +2 onions
    const next = applyShoppingListDelta(list, delta, 'a', fakeGrocery);
    expect(next.estimatedTotal).toBe(5);
  });
});

describe('applyShoppingListDelta — removesSource (M4.2 part 2: removing a side)', () => {
  // Real seed data marks olive oil pantryStaple; this fixture deliberately
  // does NOT, specifically to exercise the shared-non-staple-ingredient path.
  const main = makeRecipe({
    id: 'main',
    baseServings: 4,
    ingredients: [
      { name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' },
      { name: 'olive oil', quantity: 2, unit: 'tbsp', department: 'DryGoods' },
    ],
  });
  const side = makeRecipe({
    id: 'side',
    baseServings: 4,
    ingredients: [{ name: 'olive oil', quantity: 1, unit: 'tbsp', department: 'DryGoods' }],
  });

  function plateList() {
    return buildShoppingList(
      'plan-1',
      [makeMeal({ recipeId: 'main', dayIndex: 0, servings: 4, sideRecipeIds: ['side'] })],
      (id) => ({ main, side })[id],
      [],
      fakeGrocery,
    );
  }

  it('removing a side subtracts only its own contribution, leaving the main\'s share of a shared ingredient intact', () => {
    const list = plateList();
    const oliveOilBefore = list.items.find((i) => i.ingredientName === 'olive oil');
    expect(oliveOilBefore?.quantity).toBe(3); // 2 (main) + 1 (side)

    // "Remove this side" = a full-removal delta: side's servings go to 0.
    const delta = computeServingsDelta(side, 4, 0, []);
    const next = applyShoppingListDelta(list, delta, 'side', fakeGrocery, /* removesSource */ true);

    const oliveOil = next.items.find((i) => i.ingredientName === 'olive oil');
    expect(oliveOil?.quantity).toBe(2); // only the main's 2 tbsp remain
    expect(oliveOil?.fromRecipeIds).toEqual(['main']); // side's attribution is gone too
  });

  it('leaves fromRecipeIds untouched when removesSource is false (M4.1 servings-scale-down behavior, unchanged)', () => {
    const list = plateList();
    const delta = computeServingsDelta(main, 4, 2, []); // main's own scale-down, not a removal
    const next = applyShoppingListDelta(list, delta, 'main', fakeGrocery); // removesSource defaults false
    const oliveOil = next.items.find((i) => i.ingredientName === 'olive oil');
    expect(oliveOil?.fromRecipeIds.sort()).toEqual(['main', 'side']); // main stays a listed source
  });

  it('removing the side entirely deletes a line it was the sole contributor to', () => {
    // Side-only ingredient: nothing else on the plate contributes garlic.
    const plainMain = makeRecipe({ id: 'main', ingredients: [] });
    const sideWithGarlic = makeRecipe({
      id: 'side',
      baseServings: 4,
      ingredients: [{ name: 'garlic', quantity: 2, unit: 'clove', department: 'Produce' }],
    });
    const list = buildShoppingList(
      'plan-1',
      [makeMeal({ recipeId: 'main', dayIndex: 0, servings: 4, sideRecipeIds: ['side'] })],
      (id) => ({ main: plainMain, side: sideWithGarlic })[id],
      [],
      fakeGrocery,
    );
    const delta = computeServingsDelta(sideWithGarlic, 4, 0, []);
    const next = applyShoppingListDelta(list, delta, 'side', fakeGrocery, true);
    expect(next.items.find((i) => i.ingredientName === 'garlic')).toBeUndefined();
  });
});
