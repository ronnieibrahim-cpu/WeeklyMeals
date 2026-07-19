import { GroceryProvider } from '@/data/grocery/GroceryProvider';
import { Recipe, ShoppingItem } from '@/domain/models';

import {
  addIngredientsToShoppingList,
  applyShoppingListDelta,
  buildShoppingList,
  computeServingsDelta,
  reconcileDeltaWithList,
} from './shoppingList';
import { makeMeal, makeRecipe } from './testFixtures';

function makeItem(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    ingredientName: 'onion',
    quantity: 1,
    unit: 'piece',
    department: 'Produce',
    estimatedPrice: 1,
    checked: false,
    fromRecipeIds: ['r1'],
    ...overrides,
  };
}

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

  describe('M4.7: cross-source ingredient dedup (plural-fold + unit-family merge)', () => {
    it('merges a plural spelling from one recipe with a singular spelling from another, same unit', () => {
      const a = makeRecipe({ id: 'a', baseServings: 4, ingredients: [{ name: 'carrots', quantity: 2, unit: 'lb', department: 'Produce' }] });
      const b = makeRecipe({ id: 'b', baseServings: 4, ingredients: [{ name: 'Carrot', quantity: 1, unit: 'lb', department: 'Produce' }] });
      const recipesById: Record<string, Recipe> = { a, b };
      const meals = [makeMeal({ recipeId: 'a', dayIndex: 0, servings: 4 }), makeMeal({ recipeId: 'b', dayIndex: 1, servings: 4 })];

      const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

      expect(list.items).toHaveLength(1);
      expect(list.items[0].quantity).toBe(3);
      expect(list.items[0].ingredientName).toBe('carrots'); // first-seen spelling/casing kept for display
    });

    it('merges a mass-family cross-unit pair (g + lb) into one line, in lb', () => {
      const a = makeRecipe({ id: 'a', baseServings: 4, ingredients: [{ name: 'ground beef', quantity: 700, unit: 'g', department: 'Meat' }] });
      const b = makeRecipe({ id: 'b', baseServings: 4, ingredients: [{ name: 'ground beef', quantity: 1, unit: 'lb', department: 'Meat' }] });
      const recipesById: Record<string, Recipe> = { a, b };
      const meals = [makeMeal({ recipeId: 'a', dayIndex: 0, servings: 4 }), makeMeal({ recipeId: 'b', dayIndex: 1, servings: 4 })];

      const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

      expect(list.items).toHaveLength(1);
      expect(list.items[0].unit).toBe('lb');
      expect(list.items[0].quantity).toBeCloseTo(2.54, 2);
    });

    it('merges a volume-family cross-unit pair (tbsp + cup) into one line, in cup', () => {
      const a = makeRecipe({ id: 'a', baseServings: 4, ingredients: [{ name: 'olive oil', quantity: 2, unit: 'tbsp', department: 'DryGoods' }] });
      const b = makeRecipe({ id: 'b', baseServings: 4, ingredients: [{ name: 'olive oil', quantity: 0.5, unit: 'cup', department: 'DryGoods' }] });
      const recipesById: Record<string, Recipe> = { a, b };
      const meals = [makeMeal({ recipeId: 'a', dayIndex: 0, servings: 4 }), makeMeal({ recipeId: 'b', dayIndex: 1, servings: 4 })];

      const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

      expect(list.items).toHaveLength(1);
      expect(list.items[0].unit).toBe('cup');
      expect(list.items[0].quantity).toBeCloseTo(0.63, 2);
    });

    it('a non-convertible unit (piece) never merges against lb, even for the same ingredient name', () => {
      const a = makeRecipe({ id: 'a', baseServings: 4, ingredients: [{ name: 'salmon', quantity: 2, unit: 'piece', department: 'Seafood' }] });
      const b = makeRecipe({ id: 'b', baseServings: 4, ingredients: [{ name: 'salmon', quantity: 1, unit: 'lb', department: 'Seafood' }] });
      const recipesById: Record<string, Recipe> = { a, b };
      const meals = [makeMeal({ recipeId: 'a', dayIndex: 0, servings: 4 }), makeMeal({ recipeId: 'b', dayIndex: 1, servings: 4 })];

      const list = buildShoppingList('plan-1', meals, (id) => recipesById[id], [], fakeGrocery);

      expect(list.items).toHaveLength(2);
    });
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

  it('M4.7: merges a plural spelling onto an existing singular line instead of duplicating it', () => {
    const list = addIngredientsToShoppingList(baseList(), [{ name: 'onions', quantity: 2, unit: 'piece', department: 'Produce' }], 'pinned-recipe', fakeGrocery);
    expect(list.items).toHaveLength(1);
    expect(list.items[0].quantity).toBe(3);
    expect(list.items[0].ingredientName).toBe('onion'); // display keeps the original list line's spelling
  });

  it('M4.7: merges a cross-unit (mass-family) addition onto an existing line, updating the display unit', () => {
    const list = addIngredientsToShoppingList(
      buildShoppingList(
        'plan-1',
        [makeMeal({ recipeId: 'r1', dayIndex: 0, servings: 4 })],
        () => makeRecipe({ id: 'r1', ingredients: [{ name: 'ground beef', quantity: 1, unit: 'lb', department: 'Meat' }] }),
        [],
        fakeGrocery,
      ),
      [{ name: 'ground beef', quantity: 700, unit: 'g', department: 'Meat' }],
      'pinned-recipe',
      fakeGrocery,
    );
    expect(list.items).toHaveLength(1);
    expect(list.items[0].unit).toBe('lb');
    expect(list.items[0].quantity).toBeCloseTo(2.54, 2);
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

  describe('M4.7: applying a delta onto a cross-unit merged line', () => {
    const beefG = makeRecipe({ id: 'g', baseServings: 4, ingredients: [{ name: 'ground beef', quantity: 200, unit: 'g', department: 'Meat' }] });
    const beefLb = makeRecipe({ id: 'lb', baseServings: 4, ingredients: [{ name: 'ground beef', quantity: 1, unit: 'lb', department: 'Meat' }] });

    function mergedList() {
      return buildShoppingList(
        'plan-1',
        [makeMeal({ recipeId: 'g', dayIndex: 0, servings: 4 }), makeMeal({ recipeId: 'lb', dayIndex: 1, servings: 4 })],
        (id) => ({ g: beefG, lb: beefLb })[id],
        [],
        fakeGrocery,
      );
    }

    it('an increase delta (in the recipe\'s own unit, g) converts into the merged line\'s display unit (lb)', () => {
      const list = mergedList();
      const merged = list.items.find((i) => i.ingredientName === 'ground beef')!;
      expect(merged.unit).toBe('lb'); // sanity: the merge elected lb, not g

      const delta = computeServingsDelta(beefG, 4, 8, []); // g's own contribution doubles: +200g
      const next = applyShoppingListDelta(list, delta, 'g', fakeGrocery);
      const nextBeef = next.items.find((i) => i.ingredientName === 'ground beef')!;

      expect(nextBeef.unit).toBe('lb'); // a delta never re-elects the display unit
      expect(nextBeef.quantity).toBeCloseTo(merged.quantity + 200 / 453.59, 1);
    });

    it('a decrease delta only removes this recipe\'s own (converted) share, leaving the other contributor\'s share intact', () => {
      const list = mergedList();
      const delta = computeServingsDelta(beefG, 4, 0, []); // g's own 200g contribution goes to zero
      const next = applyShoppingListDelta(list, delta, 'g', fakeGrocery);
      const nextBeef = next.items.find((i) => i.ingredientName === 'ground beef');

      // lb's own 1lb contribution survives untouched.
      expect(nextBeef).toBeDefined();
      expect(nextBeef!.unit).toBe('lb');
      expect(nextBeef!.quantity).toBeCloseTo(1, 1);
    });

    it('sequential decreases against a merged line still zero it out once the last contributor\'s share is removed', () => {
      let list = mergedList();
      list = applyShoppingListDelta(list, computeServingsDelta(beefLb, 4, 0, []), 'lb', fakeGrocery);
      // Only g's ~200g (~0.44lb) share should remain now.
      const afterFirst = list.items.find((i) => i.ingredientName === 'ground beef');
      expect(afterFirst?.quantity).toBeCloseTo(200 / 453.59, 1);

      list = applyShoppingListDelta(list, computeServingsDelta(beefG, 4, 0, []), 'g', fakeGrocery);
      expect(list.items.find((i) => i.ingredientName === 'ground beef')).toBeUndefined();
    });
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

  it('M4.7: removing a side subtracts its (converted) share even when the main and side contributed in different mass units', () => {
    const mainG = makeRecipe({
      id: 'main',
      baseServings: 4,
      ingredients: [{ name: 'ground beef', quantity: 1, unit: 'lb', department: 'Meat' }],
    });
    const sideG = makeRecipe({
      id: 'side',
      baseServings: 4,
      ingredients: [{ name: 'ground beef', quantity: 200, unit: 'g', department: 'Meat' }],
    });
    const list = buildShoppingList(
      'plan-1',
      [makeMeal({ recipeId: 'main', dayIndex: 0, servings: 4, sideRecipeIds: ['side'] })],
      (id) => ({ main: mainG, side: sideG })[id],
      [],
      fakeGrocery,
    );
    const merged = list.items.find((i) => i.ingredientName === 'ground beef')!;
    expect(merged.unit).toBe('lb'); // lb has the larger base factor of the two present units

    const delta = computeServingsDelta(sideG, 4, 0, []); // side's own 200g contribution removed entirely
    const next = applyShoppingListDelta(list, delta, 'side', fakeGrocery, /* removesSource */ true);
    const beef = next.items.find((i) => i.ingredientName === 'ground beef');

    expect(beef).toBeDefined();
    expect(beef!.unit).toBe('lb');
    expect(beef!.quantity).toBeCloseTo(1, 1); // only the main's 1lb remains
    expect(beef!.fromRecipeIds).toEqual(['main']); // side's attribution is gone too
  });
});

describe('reconcileDeltaWithList (F1 — preview matches/merges against the live list, M4.7-aware)', () => {
  it('matches a spelling divergence (recipe "lemon" vs list "lemons") via the canonical-name fold', () => {
    const items = [makeItem({ ingredientName: 'lemons', quantity: 3, unit: 'piece' })];
    const lines = [{ ingredientName: 'lemon', unit: 'piece' as const, department: 'Produce' as const, deltaQuantity: 1, removesItem: false }];

    const result = reconcileDeltaWithList(lines, items, 'increase');

    expect(result).toHaveLength(1);
    expect(result[0].ingredientName).toBe('lemons'); // list's own first-seen spelling, not the recipe's
    expect(result[0].deltaQuantity).toBe(1);
    expect(result[0].removesItem).toBe(false);
  });

  it('converts a same-family unit divergence (recipe oz vs list lb) into the list\'s own display unit', () => {
    // List line is 0.5 lb of spinach, i.e. exactly 8 oz — the recipe's own delta is in oz.
    const items = [makeItem({ ingredientName: 'spinach', quantity: 0.5, unit: 'lb', department: 'Produce' })];
    const lines = [{ ingredientName: 'spinach', unit: 'oz' as const, department: 'Produce' as const, deltaQuantity: 8, removesItem: false }];

    const result = reconcileDeltaWithList(lines, items, 'decrease');

    expect(result).toHaveLength(1);
    expect(result[0].unit).toBe('lb'); // shown in the list's own unit, not the recipe's oz
    expect(result[0].deltaQuantity).toBeCloseTo(0.5, 2);
    // Exactly zeroes out the list's real 0.5 lb — removesItem must flip true at this boundary.
    expect(result[0].removesItem).toBe(true);
  });

  it('a decrease that does NOT reach zero leaves removesItem false', () => {
    const items = [makeItem({ ingredientName: 'spinach', quantity: 2, unit: 'lb', department: 'Produce' })];
    const lines = [{ ingredientName: 'spinach', unit: 'oz' as const, department: 'Produce' as const, deltaQuantity: 8, removesItem: false }];

    const result = reconcileDeltaWithList(lines, items, 'decrease');

    expect(result[0].removesItem).toBe(false);
  });

  it('a cross-family non-match (piece vs lb) stays unmatched, shown as-is with removesItem false', () => {
    const items = [makeItem({ ingredientName: 'salmon', quantity: 1, unit: 'lb', department: 'Seafood' })];
    const lines = [{ ingredientName: 'salmon', unit: 'piece' as const, department: 'Seafood' as const, deltaQuantity: 1, removesItem: false }];

    const result = reconcileDeltaWithList(lines, items, 'decrease');

    expect(result).toHaveLength(1);
    expect(result[0].ingredientName).toBe('salmon'); // unmatched: recipe's own name/unit pass through
    expect(result[0].unit).toBe('piece');
    expect(result[0].deltaQuantity).toBe(1);
    expect(result[0].removesItem).toBe(false); // no live item to judge "removed" against
  });

  it('a line with no live-list match at all (brand-new increase) stays unmatched', () => {
    const items = [makeItem({ ingredientName: 'onion', quantity: 1, unit: 'piece' })];
    const lines = [{ ingredientName: 'basil', unit: 'bunch' as const, department: 'Produce' as const, deltaQuantity: 1, removesItem: false }];

    const result = reconcileDeltaWithList(lines, items, 'increase');

    expect(result).toEqual([{ ingredientName: 'basil', unit: 'bunch', department: 'Produce', deltaQuantity: 1, removesItem: false }]);
  });

  it('merges two lines (from two different recipes on a plate) that map onto the same live list item', () => {
    const items = [makeItem({ ingredientName: 'carrots', quantity: 3, unit: 'lb', department: 'Produce' })];
    const lines = [
      // main contributes under the singular spelling, in oz
      { ingredientName: 'carrot', unit: 'oz' as const, department: 'Produce' as const, deltaQuantity: 8, removesItem: false },
      // a side contributes under the plural spelling, in lb
      { ingredientName: 'carrots', unit: 'lb' as const, department: 'Produce' as const, deltaQuantity: 0.5, removesItem: false },
    ];

    const result = reconcileDeltaWithList(lines, items, 'increase');

    expect(result).toHaveLength(1); // merged into the list's one real line, not two
    expect(result[0].ingredientName).toBe('carrots');
    expect(result[0].unit).toBe('lb');
    expect(result[0].deltaQuantity).toBeCloseTo(1, 2); // 8oz (~0.5lb) converted + 0.5lb = ~1lb
  });

  it('returns an empty array for an empty input (no confirmation UI to show)', () => {
    expect(reconcileDeltaWithList([], [makeItem()], 'increase')).toEqual([]);
  });
});
