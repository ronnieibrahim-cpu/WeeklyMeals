import { GenerateContext } from './recommendation/types';
import { availableIngredients, missingIngredients, pinnableDays, rerollCandidates } from './reroll';
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

  it('matches loosely (substring) when the available name is longer and contains the required name', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
    });
    expect(missingIngredients(recipe, new Set(['chicken breasts']))).toEqual([]);
  });

  it('never lets a shorter available name satisfy a longer required name (M3.0)', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'coconut cream', quantity: 1, unit: 'can', department: 'DryGoods' }],
    });
    expect(missingIngredients(recipe, new Set(['cream']))).toEqual(['coconut cream']);
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

    const candidateIds = outcome.candidates.map((c) => c.recipe.id);
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

    const candidateIds = outcome.candidates.map((c) => c.recipe.id);
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

    const candidateIds = outcome.candidates.map((c) => c.recipe.id);
    expect(candidateIds).not.toContain('allergic');
    expect(candidateIds).not.toContain('blocked');
    expect(candidateIds).toContain('fine');
  });
});

describe('rerollCandidates — whole-plate evaluation (M4.2 part 2)', () => {
  it('carries the composed sides on the candidate itself, not recomputed later', () => {
    const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
    const main = makeRecipe({
      id: 'main-candidate',
      primaryProtein: 'Chicken',
      provides: ['protein'],
      ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
    });
    const side = makeRecipe({
      id: 'side-candidate',
      role: 'side',
      provides: ['vegetable'],
      primaryProtein: 'None',
      ingredients: [{ name: 'broccoli', quantity: 1, unit: 'lb', department: 'Produce' }],
    });
    const plan = makePlan({ meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0 })] });
    const recipes = [outgoing, main, side];
    const ctx = ctxFor();
    const available = new Set(['chicken', 'broccoli']);

    const outcome = rerollCandidates(plan, 0, recipes, (id) => recipes.find((r) => r.id === id), available, ctx);

    const candidate = outcome.candidates.find((c) => c.recipe.id === 'main-candidate');
    expect(candidate?.sideRecipeIds).toEqual(['side-candidate']);
  });

  it('excludes a candidate whose composed side needs an ingredient not on hand — the plate is evaluated as a whole', () => {
    const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
    const main = makeRecipe({
      id: 'main-candidate',
      primaryProtein: 'Chicken',
      provides: ['protein'],
      ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
    });
    // Only one side candidate exists, and it needs an ingredient that isn't
    // available — composeSides will still pick it (best-effort), so the
    // WHOLE PLATE isn't coverable even though the main alone would be.
    const unavailableSide = makeRecipe({
      id: 'side-candidate',
      role: 'side',
      provides: ['vegetable'],
      primaryProtein: 'None',
      ingredients: [{ name: 'asparagus', quantity: 1, unit: 'lb', department: 'Produce' }],
    });
    const plan = makePlan({ meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0 })] });
    const recipes = [outgoing, main, unavailableSide];
    const ctx = ctxFor();
    const available = new Set(['chicken']); // no asparagus on hand

    const outcome = rerollCandidates(plan, 0, recipes, (id) => recipes.find((r) => r.id === id), available, ctx);

    expect(outcome.candidates.map((c) => c.recipe.id)).not.toContain('main-candidate');
    // Missing only one ingredient (asparagus) across the whole plate, so it
    // should show up as a near-miss instead, carrying the same composed side.
    const nearMiss = outcome.nearMisses.find((n) => n.recipe.id === 'main-candidate');
    expect(nearMiss?.sideRecipeIds).toEqual(['side-candidate']);
    expect(nearMiss?.missing).toEqual(['asparagus']);
  });
});

describe('pinnableDays (M3.1)', () => {
  // weekStartISO is 2026-07-05 (day 0); "today" fixed to day 2 for determinism.
  const today = new Date('2026-07-07T09:00:00.000Z');

  it('excludes days before today and cooked days, keeps today-or-future uncooked days', () => {
    const plan = makePlan({
      meals: [
        makeMeal({ recipeId: 'r0', dayIndex: 0 }), // past
        makeMeal({ recipeId: 'r1', dayIndex: 1 }), // past
        makeMeal({ recipeId: 'r2', dayIndex: 2, cooked: true }), // today, but cooked
        makeMeal({ recipeId: 'r3', dayIndex: 3 }), // future, uncooked
        makeMeal({ recipeId: 'r4', dayIndex: 4 }), // future, uncooked
      ],
    });

    expect(pinnableDays(plan, 'new-recipe', today)).toEqual([3, 4]);
  });

  it('returns every eligible day for a brand-new recipe not yet in the plan', () => {
    const plan = makePlan({
      meals: [makeMeal({ recipeId: 'r2', dayIndex: 2 }), makeMeal({ recipeId: 'r3', dayIndex: 3 })],
    });
    expect(pinnableDays(plan, 'new-recipe', today)).toEqual([2, 3]);
  });

  it('returns empty when the recipe is already in the plan on another day, even if that day is eligible', () => {
    const plan = makePlan({
      meals: [makeMeal({ recipeId: 'already-planned', dayIndex: 3 }), makeMeal({ recipeId: 'r4', dayIndex: 4 })],
    });
    expect(pinnableDays(plan, 'already-planned', today)).toEqual([]);
  });
});
