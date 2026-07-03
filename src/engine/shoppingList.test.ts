import { GroceryProvider } from '@/data/grocery/GroceryProvider';
import { Recipe } from '@/domain/models';

import { addIngredientsToShoppingList, buildShoppingList } from './shoppingList';
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
