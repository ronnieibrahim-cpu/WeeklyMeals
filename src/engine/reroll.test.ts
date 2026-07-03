import { GenerateContext } from './recommendation/types';
import { availableIngredients, missingIngredients, rerollCandidates } from './reroll';
import { makeIntake, makeMeal, makePlan, makeProfile, makeRecipe } from './testFixtures';

function ctxFor(overrides: Partial<GenerateContext> = {}): GenerateContext {
  const profile = makeProfile();
  const intake = makeIntake(profile);
  return { intake, profile, pantry: [], season: 'summer', ...overrides };
}

describe('availableIngredients', () => {
  it('unions pantry, shopping-list items, and the outgoing recipe\'s own ingredients', () => {
    const outgoing = makeRecipe({
      ingredients: [{ name: 'Basil', quantity: 1, unit: 'bunch', department: 'Produce' }],
    });
    const shoppingList = {
      planId: 'p1',
      items: [
        {
          ingredientName: 'Garlic',
          quantity: 1,
          unit: 'clove' as const,
          department: 'Produce' as const,
          estimatedPrice: 0,
          checked: false,
          fromRecipeIds: [],
        },
      ],
      estimatedTotal: 0,
      costPerServing: 0,
      generatedAtISO: '2026-07-01T00:00:00.000Z',
    };

    const available = availableIngredients(['Salt'], shoppingList, outgoing);

    expect(available.has('salt')).toBe(true);
    expect(available.has('garlic')).toBe(true);
    expect(available.has('basil')).toBe(true);
  });

  it('handles a null shopping list and undefined outgoing recipe gracefully', () => {
    const available = availableIngredients(['Salt'], null, undefined);
    expect(available.has('salt')).toBe(true);
    expect(available.size).toBe(1);
  });
});

describe('missingIngredients', () => {
  it('ignores pantryStaple ingredients — they are always assumed on hand', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'Black Pepper', quantity: 1, unit: 'tsp', department: 'Spices', pantryStaple: true }],
    });
    expect(missingIngredients(recipe, new Set())).toEqual([]);
  });

  it('reports non-staple ingredients not present in the available set', () => {
    const recipe = makeRecipe({
      ingredients: [
        { name: 'Shrimp', quantity: 1, unit: 'lb', department: 'Seafood' },
        { name: 'Lime', quantity: 1, unit: 'piece', department: 'Produce' },
      ],
    });
    expect(missingIngredients(recipe, new Set(['shrimp']))).toEqual(['Lime']);
  });

  it('matches loosely (substring) so minor naming differences still count as available', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'chicken breasts', quantity: 1, unit: 'lb', department: 'Meat' }],
    });
    expect(missingIngredients(recipe, new Set(['chicken']))).toEqual([]);
  });
});

describe('rerollCandidates', () => {
  it('returns nothing for a day that has already been cooked', () => {
    const outgoing = makeRecipe({ id: 'outgoing' });
    const plan = makePlan({ meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0, cooked: true })] });
    const ctx = ctxFor();
    const recipes = [outgoing, makeRecipe({ id: 'alt' })];

    const outcome = rerollCandidates(
      plan,
      0,
      recipes,
      (id) => recipes.find((r) => r.id === id),
      new Set(),
      ctx,
    );

    expect(outcome.candidates).toEqual([]);
    expect(outcome.nearMisses).toEqual([]);
  });

  it('never offers a recipe already used elsewhere in the week, including the outgoing dish itself', () => {
    const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
    const usedElsewhere = makeRecipe({ id: 'used-elsewhere', ingredients: [] });
    const freshCandidate = makeRecipe({ id: 'fresh', ingredients: [] });
    const plan = makePlan({
      meals: [
        makeMeal({ recipeId: 'outgoing', dayIndex: 0 }),
        makeMeal({ recipeId: 'used-elsewhere', dayIndex: 1 }),
      ],
    });
    const recipes = [outgoing, usedElsewhere, freshCandidate];
    const ctx = ctxFor();

    const outcome = rerollCandidates(plan, 0, recipes, (id) => recipes.find((r) => r.id === id), new Set(), ctx);

    const candidateIds = outcome.candidates.map((r) => r.id);
    expect(candidateIds).not.toContain('outgoing');
    expect(candidateIds).not.toContain('used-elsewhere');
    expect(candidateIds).toContain('fresh');
  });

  it('only offers recipes fully coverable by the available set (strict mode)', () => {
    const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
    const coverable = makeRecipe({
      id: 'coverable',
      ingredients: [{ name: 'rice', quantity: 1, unit: 'cup', department: 'DryGoods' }],
    });
    const notCoverable = makeRecipe({
      id: 'not-coverable',
      ingredients: [{ name: 'saffron', quantity: 1, unit: 'pinch', department: 'Spices' }],
    });
    const plan = makePlan({ meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0 })] });
    const recipes = [outgoing, coverable, notCoverable];
    const ctx = ctxFor();

    const outcome = rerollCandidates(
      plan,
      0,
      recipes,
      (id) => recipes.find((r) => r.id === id),
      new Set(['rice']),
      ctx,
    );

    const candidateIds = outcome.candidates.map((r) => r.id);
    expect(candidateIds).toContain('coverable');
    expect(candidateIds).not.toContain('not-coverable');
  });

  it('falls back to near-misses (missing 1-2 ingredients) when nothing fully qualifies', () => {
    const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
    const nearMiss = makeRecipe({
      id: 'near-miss',
      ingredients: [
        { name: 'saffron', quantity: 1, unit: 'pinch', department: 'Spices' },
        { name: 'bomba rice', quantity: 1, unit: 'cup', department: 'DryGoods' },
      ],
    });
    const tooFar = makeRecipe({
      id: 'too-far',
      ingredients: [
        { name: 'saffron', quantity: 1, unit: 'pinch', department: 'Spices' },
        { name: 'bomba rice', quantity: 1, unit: 'cup', department: 'DryGoods' },
        { name: 'chorizo', quantity: 1, unit: 'lb', department: 'Meat' },
      ],
    });
    const plan = makePlan({ meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0 })] });
    const recipes = [outgoing, nearMiss, tooFar];
    const ctx = ctxFor();

    const outcome = rerollCandidates(plan, 0, recipes, (id) => recipes.find((r) => r.id === id), new Set(), ctx);

    expect(outcome.candidates).toEqual([]);
    const nearMissIds = outcome.nearMisses.map((n) => n.recipe.id);
    expect(nearMissIds).toContain('near-miss');
    // 3 missing ingredients is beyond the 2-ingredient near-miss threshold.
    expect(nearMissIds).not.toContain('too-far');
  });

  it('excludes recipes failing hard filters or blocked by learning from candidates', () => {
    const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
    const allergic = makeRecipe({ id: 'allergic', ingredients: [], allergens: ['Peanuts'] });
    const blocked = makeRecipe({ id: 'blocked', ingredients: [] });
    const fine = makeRecipe({ id: 'fine', ingredients: [] });
    const plan = makePlan({ meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0 })] });
    const recipes = [outgoing, allergic, blocked, fine];
    const profile = makeProfile({ allergies: ['Peanuts'] });
    const ctx = ctxFor({
      profile,
      intake: makeIntake(profile),
      preferences: {
        cuisineAffinity: {},
        proteinAffinity: {},
        vegetableAffinity: {},
        techniqueAffinity: {},
        spiceTolerance: 0,
        complexityPreference: 0,
        budgetSensitivity: 0,
        leftoverTolerance: 0,
        mealsRated: 0,
        avgEnjoyment: 0,
        blockedRecipeIds: ['blocked'],
      },
    });

    const outcome = rerollCandidates(plan, 0, recipes, (id) => recipes.find((r) => r.id === id), new Set(), ctx);

    const candidateIds = outcome.candidates.map((r) => r.id);
    expect(candidateIds).not.toContain('allergic');
    expect(candidateIds).not.toContain('blocked');
    expect(candidateIds).toContain('fine');
  });
});
