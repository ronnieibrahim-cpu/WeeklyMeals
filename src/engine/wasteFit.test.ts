import { RecipeIngredient } from '@/domain/models';

import { WEIGHTS } from './recommendation/types';
import { scoreRecipe } from './recommendation/scoring';
import { GenerateContext } from './recommendation/types';
import { makeIntake, makeMeal, makeProfile, makeRecipe } from './testFixtures';
import { isWholeUnitPerishable, isWholeUnitShoppingItem, mealsUsingItem, wasteFitBonus } from './wasteFit';

function ing(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return { name: 'cabbage', quantity: 1, unit: 'piece', department: 'Produce', ...overrides };
}

function ctxFor(overrides: Partial<GenerateContext> = {}): GenerateContext {
  const profile = overrides.profile ?? makeProfile();
  const intake = overrides.intake ?? makeIntake(profile);
  return { profile, intake, pantry: [], season: 'summer', ...overrides };
}

describe('isWholeUnitPerishable', () => {
  it('a whole piece of produce is whole-unit perishable', () => {
    expect(isWholeUnitPerishable(ing({ unit: 'piece', department: 'Produce', quantity: 1 }))).toBe(true);
  });

  it('a bunch is whole-unit perishable', () => {
    expect(
      isWholeUnitPerishable(ing({ name: 'cilantro', unit: 'bunch', department: 'Produce', quantity: 1 })),
    ).toBe(true);
  });

  it('a can is whole-unit perishable even in an unusual department (Dairy)', () => {
    expect(
      isWholeUnitPerishable(ing({ name: 'coconut cream', unit: 'can', department: 'Dairy', quantity: 1 })),
    ).toBe(true);
  });

  it('under a pound of meat is whole-unit perishable (sub-unit by-weight case)', () => {
    expect(
      isWholeUnitPerishable(ing({ name: 'ground beef', unit: 'lb', department: 'Meat', quantity: 0.5 })),
    ).toBe(true);
  });

  it('a pantry staple is never whole-unit perishable', () => {
    expect(isWholeUnitPerishable(ing({ pantryStaple: true }))).toBe(false);
  });

  it('a non-perishable department (DryGoods) is never whole-unit perishable', () => {
    expect(isWholeUnitPerishable(ing({ department: 'DryGoods' }))).toBe(false);
  });

  it('a non-perishable department (Spices) is never whole-unit perishable', () => {
    expect(isWholeUnitPerishable(ing({ name: 'cumin', unit: 'tsp', department: 'Spices', quantity: 1 }))).toBe(
      false,
    );
  });

  it('2 lb of meat is not whole-unit perishable (a full-plus purchase, no partial-unit risk)', () => {
    expect(isWholeUnitPerishable(ing({ name: 'ground beef', unit: 'lb', department: 'Meat', quantity: 2 }))).toBe(
      false,
    );
  });

  it('a small-measure unit (tsp/tbsp) is never whole-unit perishable', () => {
    expect(
      isWholeUnitPerishable(ing({ name: 'butter', unit: 'tbsp', department: 'Dairy', quantity: 2 })),
    ).toBe(false);
  });
});

describe('wasteFitBonus', () => {
  const cabbageHalf = ing({ name: 'cabbage', unit: 'piece', department: 'Produce', quantity: 0.5 });
  const cabbageWhole = ing({ name: 'cabbage', unit: 'piece', department: 'Produce', quantity: 1 });

  it('fires when a week recipe uses half a unit and the candidate reuses it', () => {
    const weekRecipe = makeRecipe({ id: 'main-1', ingredients: [cabbageHalf] });
    const candidate = makeRecipe({ id: 'side-cabbage', ingredients: [cabbageWhole] });
    expect(wasteFitBonus(candidate, [weekRecipe])).toBe(0.5);
  });

  it('does not fire when the week usage sums to a whole number of units', () => {
    const weekRecipeA = makeRecipe({ id: 'main-a', ingredients: [cabbageHalf] });
    const weekRecipeB = makeRecipe({ id: 'main-b', ingredients: [cabbageHalf] });
    const candidate = makeRecipe({ id: 'side-cabbage', ingredients: [cabbageWhole] });
    expect(wasteFitBonus(candidate, [weekRecipeA, weekRecipeB])).toBe(0);
  });

  it('does not fire on a non-perishable ingredient overlap', () => {
    const salt: RecipeIngredient = { name: 'salt', quantity: 1, unit: 'tsp', department: 'Spices', pantryStaple: true };
    const weekRecipe = makeRecipe({ id: 'main-1', ingredients: [salt] });
    const candidate = makeRecipe({ id: 'side-1', ingredients: [salt] });
    expect(wasteFitBonus(candidate, [weekRecipe])).toBe(0);
  });

  it('is graded: two distinct leftover matches cap the bonus at 1', () => {
    const carrotHalf = ing({ name: 'carrot', unit: 'bunch', department: 'Produce', quantity: 0.5 });
    const carrotWhole = ing({ name: 'carrot', unit: 'bunch', department: 'Produce', quantity: 1 });
    const weekRecipe = makeRecipe({ id: 'main-1', ingredients: [cabbageHalf, carrotHalf] });
    const candidate = makeRecipe({ id: 'side-1', ingredients: [cabbageWhole, carrotWhole] });
    expect(wasteFitBonus(candidate, [weekRecipe])).toBe(1);
  });

  it('is 0 with no week recipes to compare against', () => {
    const candidate = makeRecipe({ id: 'side-1', ingredients: [cabbageWhole] });
    expect(wasteFitBonus(candidate, [])).toBe(0);
  });

  it('is 0 when the candidate has no whole-unit-perishable ingredients of its own', () => {
    const weekRecipe = makeRecipe({ id: 'main-1', ingredients: [cabbageHalf] });
    const candidate = makeRecipe({
      id: 'side-1',
      ingredients: [{ name: 'rice', quantity: 1, unit: 'cup', department: 'DryGoods' }],
    });
    expect(wasteFitBonus(candidate, [weekRecipe])).toBe(0);
  });
});

describe('isWholeUnitShoppingItem', () => {
  it('mirrors isWholeUnitPerishable for a shopping-list line', () => {
    expect(isWholeUnitShoppingItem({ department: 'Produce', unit: 'piece', quantity: 1 })).toBe(true);
    expect(isWholeUnitShoppingItem({ department: 'Meat', unit: 'lb', quantity: 0.5 })).toBe(true);
    expect(isWholeUnitShoppingItem({ department: 'Meat', unit: 'lb', quantity: 2 })).toBe(false);
    expect(isWholeUnitShoppingItem({ department: 'DryGoods', unit: 'piece', quantity: 1 })).toBe(false);
  });
});

describe('mealsUsingItem', () => {
  it('counts distinct days across mains and sideRecipeIds', () => {
    const meals = [
      makeMeal({ recipeId: 'main-a', dayIndex: 0, sideRecipeIds: ['side-x'] }),
      makeMeal({ recipeId: 'main-b', dayIndex: 1 }),
      makeMeal({ recipeId: 'main-c', dayIndex: 2, sideRecipeIds: ['side-cabbage'] }),
    ];
    expect(mealsUsingItem(['side-cabbage'], meals)).toBe(1);
    expect(mealsUsingItem(['main-a', 'side-cabbage'], meals)).toBe(2);
  });

  it('does not double-count a day that uses the item as both the main and a side', () => {
    const meals = [makeMeal({ recipeId: 'shared-id', dayIndex: 0, sideRecipeIds: ['shared-id'] })];
    expect(mealsUsingItem(['shared-id'], meals)).toBe(1);
  });

  it('returns 0 when nothing matches', () => {
    const meals = [makeMeal({ recipeId: 'main-a', dayIndex: 0 })];
    expect(mealsUsingItem(['nope'], meals)).toBe(0);
  });
});

describe('scoring integration: wasteFitBonus in scoreRecipe', () => {
  const cabbageHalf = ing({ name: 'cabbage', unit: 'piece', department: 'Produce', quantity: 0.5 });
  const cabbageWhole = ing({ name: 'cabbage', unit: 'piece', department: 'Produce', quantity: 1 });

  it('an otherwise-identical candidate that reuses a leftover perishable scores higher', () => {
    const weekMain = makeRecipe({ id: 'week-main', cuisine: 'Mexican', primaryProtein: 'Beef', ingredients: [cabbageHalf] });
    const shared = { cuisine: 'Italian' as const, primaryProtein: 'Chicken' as const };
    const withLeftover = makeRecipe({ id: 'cand-a', ...shared, ingredients: [cabbageWhole] });
    const without = makeRecipe({
      id: 'cand-b',
      ...shared,
      ingredients: [{ name: 'zucchini', quantity: 1, unit: 'piece', department: 'Produce' }],
    });
    const ctx = ctxFor({ weekRecipes: [weekMain] });
    const scoreWith = scoreRecipe(withLeftover, ctx, [weekMain]);
    const scoreWithout = scoreRecipe(without, ctx, [weekMain]);
    expect(scoreWith).toBeGreaterThan(scoreWithout);
    expect(scoreWith - scoreWithout).toBeCloseTo(WEIGHTS.wasteFit * 0.5, 5);
  });

  it('weightOverrides { wasteFit: 0 } neutralizes the bonus — the two candidates score equal', () => {
    const weekMain = makeRecipe({ id: 'week-main', cuisine: 'Mexican', primaryProtein: 'Beef', ingredients: [cabbageHalf] });
    const shared = { cuisine: 'Italian' as const, primaryProtein: 'Chicken' as const };
    const withLeftover = makeRecipe({ id: 'cand-a', ...shared, ingredients: [cabbageWhole] });
    const without = makeRecipe({
      id: 'cand-b',
      ...shared,
      ingredients: [{ name: 'zucchini', quantity: 1, unit: 'piece', department: 'Produce' }],
    });
    const ctx = ctxFor({ weekRecipes: [weekMain], weightOverrides: { wasteFit: 0 } });
    const scoreWith = scoreRecipe(withLeftover, ctx, [weekMain]);
    const scoreWithout = scoreRecipe(without, ctx, [weekMain]);
    expect(scoreWith).toBeCloseTo(scoreWithout, 10);
  });
});

describe('weight discipline: wasteFit never beats variety', () => {
  it('a same-cuisine/protein candidate with a waste-fit match still loses to a fresh-cuisine candidate without one', () => {
    const selected = [
      makeRecipe({ id: 'sel-1', cuisine: 'Italian', primaryProtein: 'Chicken' }),
      makeRecipe({
        id: 'sel-2',
        cuisine: 'Italian',
        primaryProtein: 'Chicken',
        ingredients: [{ name: 'cabbage', quantity: 0.5, unit: 'piece', department: 'Produce' }],
      }),
    ];
    // Repeats the week's cuisine+protein (heavy variety penalty) but reuses
    // the half-cabbage from sel-2 (gets the waste-fit bonus).
    const repeatsWithBonus = makeRecipe({
      id: 'cand-repeat',
      cuisine: 'Italian',
      primaryProtein: 'Chicken',
      ingredients: [{ name: 'cabbage', quantity: 1, unit: 'piece', department: 'Produce' }],
    });
    // A fresh cuisine/protein this week hasn't seen (full variety bonus) but
    // no waste-fit match at all.
    const freshNoBonus = makeRecipe({
      id: 'cand-fresh',
      cuisine: 'Thai',
      primaryProtein: 'Tofu',
      ingredients: [{ name: 'basil', quantity: 1, unit: 'bunch', department: 'Produce' }],
    });
    const ctx = ctxFor({ weekRecipes: selected });
    const repeatScore = scoreRecipe(repeatsWithBonus, ctx, selected);
    const freshScore = scoreRecipe(freshNoBonus, ctx, selected);
    expect(freshScore).toBeGreaterThan(repeatScore);
  });

  it('WEIGHTS.wasteFit stays well under half of WEIGHTS.variety, by design', () => {
    expect(WEIGHTS.wasteFit).toBeLessThan(WEIGHTS.variety / 2);
  });
});
