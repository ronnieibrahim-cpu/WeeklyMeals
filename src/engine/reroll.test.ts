import { Recipe } from '@/domain/models';

import { GenerateContext } from './recommendation/types';
import { availableIngredients, missingIngredients, pinBlockReason, pinnableDays, rerollCandidates } from './reroll';
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

  it('M4.7: a plural on the list satisfies a recipe needing the singular, end to end via availableIngredients', () => {
    const available = availableIngredients(['Carrots'], null, undefined);
    const recipe = makeRecipe({ ingredients: [{ name: 'carrot', quantity: 2, unit: 'piece', department: 'Produce' }] });
    expect(missingIngredients(recipe, available)).toEqual([]);
  });

  it('M4.7: the fold is symmetric — a singular on the list also satisfies a recipe needing the plural', () => {
    const available = availableIngredients(['carrot'], null, undefined);
    const recipe = makeRecipe({ ingredients: [{ name: 'Carrots', quantity: 2, unit: 'piece', department: 'Produce' }] });
    expect(missingIngredients(recipe, available)).toEqual([]);
  });

  it('M4.7: the plural fold does not weaken the coconut-cream-vs-cream guard', () => {
    const available = availableIngredients(['creams'], null, undefined); // plural, still just "cream"
    const recipe = makeRecipe({ ingredients: [{ name: 'coconut cream', quantity: 1, unit: 'can', department: 'DryGoods' }] });
    expect(missingIngredients(recipe, available)).toEqual(['coconut cream']);
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

  /**
   * Sides are composed from on-hand sides only. Before this, `composeSides`
   * picked the best-scoring side with no notion of what was in the kitchen,
   * so a perfectly cookable main was demoted to a near-miss (or dropped)
   * whenever its winning side happened to need something you didn't have —
   * the single biggest reason the offered pool kept coming back as three.
   * Strictness is untouched: what's offered must still be cookable in full.
   */
  describe('side composition respects what is on hand', () => {
    const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
    const main = makeRecipe({
      id: 'main-candidate',
      primaryProtein: 'Chicken',
      provides: ['protein'],
      ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
    });
    const unavailableSide = makeRecipe({
      id: 'unavailable-side',
      role: 'side',
      provides: ['vegetable'],
      primaryProtein: 'None',
      // Scores ahead of the on-hand side below (kid-approved), so the old
      // code would have picked it and lost the whole plate.
      ingredients: [{ name: 'asparagus', quantity: 1, unit: 'lb', department: 'Produce' }],
    });
    const onHandSide = makeRecipe({
      id: 'on-hand-side',
      role: 'side',
      provides: ['vegetable'],
      primaryProtein: 'None',
      ingredients: [{ name: 'broccoli', quantity: 1, unit: 'lb', department: 'Produce' }],
    });
    const plan = makePlan({ meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0 })] });

    it('offers the main with a side it can actually cook instead of dropping it', () => {
      const recipes = [outgoing, main, unavailableSide, onHandSide];
      const available = new Set(['chicken', 'broccoli']); // no asparagus
      const ctx = ctxFor({ kidApprovedRecipeIds: ['unavailable-side'] });

      const outcome = rerollCandidates(plan, 0, recipes, (id) => recipes.find((r) => r.id === id), available, ctx);

      const candidate = outcome.candidates.find((c) => c.recipe.id === 'main-candidate');
      expect(candidate?.sideRecipeIds).toEqual(['on-hand-side']);
    });

    it('still offers the main with a short plate when no side at all is on hand', () => {
      // Best-effort plates are already the documented composeSides behavior;
      // a cookable dinner beats a dinner that needs a store trip.
      const recipes = [outgoing, main, unavailableSide];
      const available = new Set(['chicken']);
      const ctx = ctxFor();

      const outcome = rerollCandidates(plan, 0, recipes, (id) => recipes.find((r) => r.id === id), available, ctx);

      const candidate = outcome.candidates.find((c) => c.recipe.id === 'main-candidate');
      expect(candidate).toBeDefined();
      expect(candidate?.sideRecipeIds).toEqual([]);
    });

    it('never puts a side it cannot cook on an offered plate (Law #2)', () => {
      const recipes = [outgoing, main, unavailableSide, onHandSide];
      const available = new Set(['chicken', 'broccoli']);
      const ctx = ctxFor();

      const outcome = rerollCandidates(plan, 0, recipes, (id) => recipes.find((r) => r.id === id), available, ctx);

      for (const candidate of outcome.candidates) {
        for (const sideId of candidate.sideRecipeIds) {
          const side = recipes.find((r) => r.id === sideId)!;
          expect(missingIngredients(side, available)).toEqual([]);
        }
      }
    });
  });
});

/**
 * Pool size and shape. Reported: "the re-roll pool is too small, often only
 * three, and those include favorites." Three things changed — the cap (5 ->
 * 8), cuisine diversification so "try another" walks through genuinely
 * different dishes, and near-misses offered alongside a thin strict list
 * rather than only when it's empty.
 */
describe('rerollCandidates — pool size and shape', () => {
  const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
  const plan = makePlan({ meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0 })] });

  /** `count` coverable mains, cycling through `cuisines`. */
  function mainsFor(count: number, cuisines: Recipe['cuisine'][]): Recipe[] {
    return Array.from({ length: count }, (_, i) =>
      makeRecipe({
        id: `main-${i}`,
        cuisine: cuisines[i % cuisines.length],
        ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
      }),
    );
  }

  it('offers up to 8 coverable plates, not 5', () => {
    const mains = mainsFor(12, ['Italian', 'Thai', 'Mexican', 'Greek', 'Indian', 'French']);
    const recipes = [outgoing, ...mains];

    const outcome = rerollCandidates(
      plan, 0, recipes, (id) => recipes.find((r) => r.id === id), new Set(['chicken']), ctxFor(),
    );

    expect(outcome.candidates).toHaveLength(8);
  });

  it('leads with one plate per cuisine rather than a run of near-identical dishes', () => {
    // 10 Italian mains and 3 others: without diversification the first
    // several offers would all be Italian.
    const italian = Array.from({ length: 10 }, (_, i) =>
      makeRecipe({
        id: `italian-${i}`,
        cuisine: 'Italian',
        ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
      }),
    );
    const others = mainsFor(3, ['Thai', 'Mexican', 'Greek']);
    const recipes = [outgoing, ...italian, ...others];

    const outcome = rerollCandidates(
      plan, 0, recipes, (id) => recipes.find((r) => r.id === id), new Set(['chicken']), ctxFor(),
    );

    const firstFourCuisines = outcome.candidates.slice(0, 4).map((c) => c.recipe.cuisine);
    expect(new Set(firstFourCuisines).size).toBe(4);
    // Backfill still uses the remaining best candidates, so the list is full.
    expect(outcome.candidates).toHaveLength(8);
  });

  it('offers near-misses alongside a thin strict list, not only when it is empty', () => {
    const coverableMains = mainsFor(2, ['Italian', 'Thai']);
    const nearMissMain = makeRecipe({
      id: 'near-miss',
      cuisine: 'Greek',
      ingredients: [
        { name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' },
        { name: 'feta', quantity: 1, unit: 'oz', department: 'Dairy' },
      ],
    });
    const recipes = [outgoing, ...coverableMains, nearMissMain];

    const outcome = rerollCandidates(
      plan, 0, recipes, (id) => recipes.find((r) => r.id === id), new Set(['chicken']), ctxFor(),
    );

    expect(outcome.candidates).toHaveLength(2);
    expect(outcome.nearMisses.map((n) => n.recipe.id)).toEqual(['near-miss']);
    expect(outcome.nearMisses[0].missing).toEqual(['feta']);
  });

  it('hides near-misses once the strict list is a real choice on its own', () => {
    const coverableMains = mainsFor(6, ['Italian', 'Thai', 'Mexican', 'Greek', 'Indian', 'French']);
    const nearMissMain = makeRecipe({
      id: 'near-miss',
      cuisine: 'Japanese',
      ingredients: [
        { name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' },
        { name: 'miso', quantity: 1, unit: 'oz', department: 'DryGoods' },
      ],
    });
    const recipes = [outgoing, ...coverableMains, nearMissMain];

    const outcome = rerollCandidates(
      plan, 0, recipes, (id) => recipes.find((r) => r.id === id), new Set(['chicken']), ctxFor(),
    );

    expect(outcome.candidates.length).toBeGreaterThanOrEqual(5);
    expect(outcome.nearMisses).toEqual([]);
  });

  it('every offered candidate is fully coverable, however long the list gets (Law #2)', () => {
    const mains = mainsFor(12, ['Italian', 'Thai', 'Mexican']);
    const needsShopping = makeRecipe({
      id: 'needs-shopping',
      ingredients: [{ name: 'saffron', quantity: 1, unit: 'oz', department: 'Spices' }],
    });
    const recipes = [outgoing, ...mains, needsShopping];
    const available = new Set(['chicken']);

    const outcome = rerollCandidates(
      plan, 0, recipes, (id) => recipes.find((r) => r.id === id), available, ctxFor(),
    );

    for (const candidate of outcome.candidates) {
      expect(missingIngredients(candidate.recipe, available)).toEqual([]);
    }
    expect(outcome.candidates.map((c) => c.recipe.id)).not.toContain('needs-shopping');
  });
});

describe('rerollCandidates — M4.5 keep/re-roll a plate component', () => {
  describe('backward compatibility (no keep)', () => {
    it('an explicit {keepMain:false, keptSideIds:[]} matches the default (undefined) outcome exactly', () => {
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
      const getRecipe = (id: string) => recipes.find((r) => r.id === id);

      const withoutKeep = rerollCandidates(plan, 0, recipes, getRecipe, available, ctx);
      const withEmptyKeep = rerollCandidates(plan, 0, recipes, getRecipe, available, ctx, {
        keepMain: false,
        keptSideIds: [],
      });

      expect(withEmptyKeep).toEqual(withoutKeep);
      expect(withoutKeep.candidates.length).toBeGreaterThan(0); // sanity: the scenario actually exercises something
    });
  });

  describe('keep sides, re-roll the main', () => {
    it('carries the kept side id verbatim and first on the candidate when the kept sauce pairs with the new main', () => {
      const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
      const sauce = makeRecipe({
        id: 'chimichurri',
        role: 'sauce',
        provides: [],
        cuisine: 'Mexican',
        // M5.6: a kept sauce is no longer assumed to pair with any main —
        // it has to say so, and the candidate below is Mexican.
        pairsWith: ['Mexican'],
        primaryProtein: 'None',
        ingredients: [{ name: 'parsley', quantity: 1, unit: 'bunch', department: 'Produce' }],
      });
      const steak = makeRecipe({
        id: 'steak',
        primaryProtein: 'Beef',
        provides: ['protein'],
        cuisine: 'Mexican',
        ingredients: [{ name: 'steak', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const plan = makePlan({
        meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0, sideRecipeIds: ['chimichurri'] })],
      });
      const recipes = [outgoing, sauce, steak];
      const ctx = ctxFor();
      const available = new Set(['parsley', 'steak']);

      const outcome = rerollCandidates(
        plan,
        0,
        recipes,
        (id) => recipes.find((r) => r.id === id),
        available,
        ctx,
        { keepMain: false, keptSideIds: ['chimichurri'] },
      );

      const candidate = outcome.candidates.find((c) => c.recipe.id === 'steak');
      expect(candidate).toBeDefined();
      expect(candidate?.sideRecipeIds).toEqual(['chimichurri']);
    });

    it('excludes a main whose own provides already cover everything the kept side contributes (clash gate)', () => {
      const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
      const keptVeg = makeRecipe({
        id: 'kept-veg',
        role: 'side',
        provides: ['vegetable'],
        cuisine: 'Italian',
        primaryProtein: 'None',
        ingredients: [{ name: 'broccoli', quantity: 1, unit: 'lb', department: 'Produce' }],
      });
      const clashMain = makeRecipe({
        id: 'clash-main',
        primaryProtein: 'Chicken',
        provides: ['protein', 'vegetable'],
        cuisine: 'Italian',
        ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const okMain = makeRecipe({
        id: 'ok-main',
        primaryProtein: 'Beef',
        provides: ['protein'],
        cuisine: 'Italian',
        ingredients: [{ name: 'beef', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const plan = makePlan({
        meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0, sideRecipeIds: ['kept-veg'] })],
      });
      const recipes = [outgoing, keptVeg, clashMain, okMain];
      const ctx = ctxFor();
      const available = new Set(['broccoli', 'chicken', 'beef']);

      const outcome = rerollCandidates(
        plan,
        0,
        recipes,
        (id) => recipes.find((r) => r.id === id),
        available,
        ctx,
        { keepMain: false, keptSideIds: ['kept-veg'] },
      );

      const candidateIds = outcome.candidates.map((c) => c.recipe.id);
      expect(candidateIds).not.toContain('clash-main');
      expect(candidateIds).toContain('ok-main');
    });

    it('excludes a main that breaks the combined time budget with a kept side', () => {
      const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
      // M5.6: cook time now runs in PARALLEL (max), prep still sums — so the
      // budget a candidate main can break with a kept side is the prep one.
      const keptSide = makeRecipe({
        id: 'kept-side',
        role: 'side',
        provides: ['starch'],
        cuisine: 'Italian',
        primaryProtein: 'None',
        prepMinutes: 12,
        cookMinutes: 35,
        ingredients: [{ name: 'rice', quantity: 1, unit: 'cup', department: 'DryGoods' }],
      });
      const slowMain = makeRecipe({
        id: 'slow-main',
        primaryProtein: 'Chicken',
        provides: ['protein'],
        cuisine: 'Italian',
        prepMinutes: 10, // 10 + 12 = 22 > maxPrepMinutes (20)
        cookMinutes: 20,
        ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const fastMain = makeRecipe({
        id: 'fast-main',
        primaryProtein: 'Beef',
        provides: ['protein'],
        cuisine: 'Italian',
        prepMinutes: 5, // 5 + 12 = 17 <= 20
        cookMinutes: 5,
        ingredients: [{ name: 'beef', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const plan = makePlan({
        meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0, sideRecipeIds: ['kept-side'] })],
      });
      const recipes = [outgoing, keptSide, slowMain, fastMain];
      const ctx = ctxFor();
      const available = new Set(['rice', 'chicken', 'beef']);

      const outcome = rerollCandidates(
        plan,
        0,
        recipes,
        (id) => recipes.find((r) => r.id === id),
        available,
        ctx,
        { keepMain: false, keptSideIds: ['kept-side'] },
      );

      const candidateIds = outcome.candidates.map((c) => c.recipe.id);
      expect(candidateIds).not.toContain('slow-main');
      expect(candidateIds).toContain('fast-main');
    });

    it('demotes an otherwise-eligible main to a labeled near-miss when the whole plate is not fully coverable', () => {
      const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
      const keptSide = makeRecipe({
        id: 'kept-side',
        role: 'side',
        provides: ['vegetable'],
        cuisine: 'Italian',
        primaryProtein: 'None',
        ingredients: [{ name: 'broccoli', quantity: 1, unit: 'lb', department: 'Produce' }],
      });
      const main = makeRecipe({
        id: 'main-candidate',
        primaryProtein: 'Chicken',
        provides: ['protein'],
        cuisine: 'Italian',
        ingredients: [{ name: 'saffron', quantity: 1, unit: 'pinch', department: 'Spices' }],
      });
      const plan = makePlan({
        meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0, sideRecipeIds: ['kept-side'] })],
      });
      const recipes = [outgoing, keptSide, main];
      const ctx = ctxFor();
      const available = new Set(['broccoli']); // no saffron

      const outcome = rerollCandidates(
        plan,
        0,
        recipes,
        (id) => recipes.find((r) => r.id === id),
        available,
        ctx,
        { keepMain: false, keptSideIds: ['kept-side'] },
      );

      expect(outcome.candidates).toEqual([]);
      const nearMiss = outcome.nearMisses.find((n) => n.recipe.id === 'main-candidate');
      expect(nearMiss).toBeDefined();
      expect(nearMiss?.sideRecipeIds).toEqual(['kept-side']);
      expect(nearMiss?.missing).toEqual(['saffron']);
    });

    it('the kept-side cuisine-fit nudge orders a cuisine-matching main above an otherwise-identical non-matching one', () => {
      const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
      const keptSide = makeRecipe({
        id: 'kept-side',
        role: 'sauce',
        provides: [],
        cuisine: 'Mexican',
        pairsWith: ['Mexican', 'Italian'], // must clear the M5.6 gate for BOTH candidate mains
        primaryProtein: 'None',
        ingredients: [{ name: 'parsley', quantity: 1, unit: 'bunch', department: 'Produce' }],
      });
      const matchingMain = makeRecipe({
        id: 'matching-main',
        primaryProtein: 'Beef',
        provides: ['protein'],
        cuisine: 'Mexican',
        ingredients: [{ name: 'beef', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const otherMain = makeRecipe({
        id: 'other-main',
        primaryProtein: 'Beef',
        provides: ['protein'],
        cuisine: 'Italian',
        ingredients: [{ name: 'beef', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const plan = makePlan({
        meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0, sideRecipeIds: ['kept-side'] })],
      });
      const recipes = [outgoing, keptSide, matchingMain, otherMain];
      const ctx = ctxFor();
      const available = new Set(['parsley', 'beef']);

      const outcome = rerollCandidates(
        plan,
        0,
        recipes,
        (id) => recipes.find((r) => r.id === id),
        available,
        ctx,
        { keepMain: false, keptSideIds: ['kept-side'] },
      );

      const ids = outcome.candidates.map((c) => c.recipe.id);
      expect(ids).toContain('matching-main');
      expect(ids).toContain('other-main');
      // Same score on every other factor (see fixture comment above) — only
      // the kept-side cuisine-fit nudge should separate them.
      expect(ids.indexOf('matching-main')).toBeLessThan(ids.indexOf('other-main'));
    });
  });

  describe('keep the main, re-roll the sides', () => {
    function setup() {
      const main = makeRecipe({
        id: 'main1',
        primaryProtein: 'Chicken',
        provides: ['protein'],
        cuisine: 'Italian',
        ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const sideA = makeRecipe({
        id: 'side-a',
        role: 'side',
        provides: ['starch'],
        primaryProtein: 'None',
        ingredients: [{ name: 'rice', quantity: 1, unit: 'cup', department: 'DryGoods' }],
      });
      const sideB = makeRecipe({
        id: 'side-b',
        role: 'side',
        provides: ['vegetable'],
        primaryProtein: 'None',
        ingredients: [{ name: 'broccoli', quantity: 1, unit: 'lb', department: 'Produce' }],
      });
      const sideC = makeRecipe({
        id: 'side-c',
        role: 'side',
        provides: ['vegetable'],
        primaryProtein: 'None',
        ingredients: [{ name: 'spinach', quantity: 1, unit: 'lb', department: 'Produce' }],
      });
      const sideD = makeRecipe({
        id: 'side-d',
        role: 'side',
        provides: ['vegetable'],
        primaryProtein: 'None',
        ingredients: [{ name: 'spinach', quantity: 1, unit: 'lb', department: 'Produce' }],
      });
      const sideE = makeRecipe({
        id: 'side-e',
        role: 'side',
        provides: ['vegetable'],
        primaryProtein: 'None',
        ingredients: [{ name: 'spinach', quantity: 1, unit: 'lb', department: 'Produce' }],
      });
      const plan = makePlan({
        meals: [makeMeal({ recipeId: 'main1', dayIndex: 0, sideRecipeIds: ['side-a', 'side-b'] })],
      });
      const recipes = [main, sideA, sideB, sideC, sideD, sideE];
      const ctx = ctxFor();
      const available = new Set(['chicken', 'rice', 'spinach']);
      const getRecipe = (id: string) => recipes.find((r) => r.id === id);
      return { plan, recipes, ctx, available, getRecipe };
    }

    it('every candidate carries the outgoing main, preserves the kept side verbatim and first, never re-offers the current non-kept side, and yields up to 3 mutually distinct, coverable alternatives', () => {
      const { plan, recipes, ctx, available, getRecipe } = setup();

      const outcome = rerollCandidates(plan, 0, recipes, getRecipe, available, ctx, {
        keepMain: true,
        keptSideIds: ['side-a'],
      });

      expect(outcome.nearMisses).toEqual([]);
      expect(outcome.candidates.length).toBeGreaterThan(0);
      expect(outcome.candidates.length).toBeLessThanOrEqual(3);
      for (const c of outcome.candidates) {
        expect(c.recipe.id).toBe('main1');
        expect(c.sideRecipeIds[0]).toBe('side-a');
        expect(c.sideRecipeIds).not.toContain('side-b');
      }
      const signatures = outcome.candidates.map((c) => c.sideRecipeIds.join(','));
      expect(new Set(signatures).size).toBe(signatures.length); // mutually distinct
    });

    it('cooked day yields an empty outcome for keep-main mode too', () => {
      const { recipes, ctx, available, getRecipe } = setup();
      const plan = makePlan({
        meals: [makeMeal({ recipeId: 'main1', dayIndex: 0, cooked: true, sideRecipeIds: ['side-a', 'side-b'] })],
      });

      const outcome = rerollCandidates(plan, 0, recipes, getRecipe, available, ctx, {
        keepMain: true,
        keptSideIds: ['side-a'],
      });

      expect(outcome.candidates).toEqual([]);
      expect(outcome.nearMisses).toEqual([]);
    });
  });

  describe('allergy guard holds in every keep mode (LAW #4/#5)', () => {
    it('never offers a mealdb- recipe (main or side) once a profile allergy is set, in keep-sides mode', () => {
      const outgoing = makeRecipe({ id: 'outgoing', ingredients: [] });
      const sauce = makeRecipe({
        id: 'kept-sauce',
        role: 'sauce',
        provides: [],
        pairsWith: ['Italian'], // makeRecipe's default cuisine — clears the M5.6 gate
        primaryProtein: 'None',
        ingredients: [{ name: 'parsley', quantity: 1, unit: 'bunch', department: 'Produce' }],
      });
      const allergicMain = makeRecipe({
        id: 'mealdb-allergic',
        primaryProtein: 'Chicken',
        provides: ['protein'],
        allergens: ['Peanuts'],
        estimated: true,
        ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const importedSafeMain = makeRecipe({
        id: 'mealdb-safe',
        primaryProtein: 'Beef',
        provides: ['protein'],
        estimated: true,
        ingredients: [{ name: 'beef', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const curatedMain = makeRecipe({
        id: 'curated-main',
        primaryProtein: 'Pork',
        provides: ['protein'],
        ingredients: [{ name: 'pork', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const importedSide = makeRecipe({
        id: 'mealdb-side',
        role: 'side',
        provides: ['vegetable'],
        primaryProtein: 'None',
        estimated: true,
        ingredients: [{ name: 'carrot', quantity: 1, unit: 'piece', department: 'Produce' }],
      });
      const plan = makePlan({
        meals: [makeMeal({ recipeId: 'outgoing', dayIndex: 0, sideRecipeIds: ['kept-sauce'] })],
      });
      const recipes = [outgoing, sauce, allergicMain, importedSafeMain, curatedMain, importedSide];
      const profile = makeProfile({ allergies: ['Peanuts'] });
      const ctx = ctxFor({ profile, intake: makeIntake(profile) });
      const available = new Set(['parsley', 'chicken', 'beef', 'pork', 'carrot']);

      const outcome = rerollCandidates(
        plan,
        0,
        recipes,
        (id) => recipes.find((r) => r.id === id),
        available,
        ctx,
        { keepMain: false, keptSideIds: ['kept-sauce'] },
      );

      const allPlateRecipeIds = [
        ...outcome.candidates.flatMap((c) => [c.recipe.id, ...c.sideRecipeIds]),
        ...outcome.nearMisses.flatMap((n) => [n.recipe.id, ...n.sideRecipeIds]),
      ];
      expect(allPlateRecipeIds.some((id) => id.startsWith('mealdb-'))).toBe(false);
      expect(outcome.candidates.map((c) => c.recipe.id)).toContain('curated-main');
    });

    it('never offers a mealdb- side once a profile allergy is set, in keep-main mode', () => {
      const main = makeRecipe({
        id: 'curated-main2',
        primaryProtein: 'Chicken',
        provides: ['protein'],
        ingredients: [{ name: 'chicken', quantity: 1, unit: 'lb', department: 'Meat' }],
      });
      const keptSide = makeRecipe({
        id: 'kept-starch',
        role: 'side',
        provides: ['starch'],
        primaryProtein: 'None',
        ingredients: [{ name: 'rice', quantity: 1, unit: 'cup', department: 'DryGoods' }],
      });
      const currentNonKept = makeRecipe({
        id: 'current-veg',
        role: 'side',
        provides: ['vegetable'],
        primaryProtein: 'None',
        ingredients: [{ name: 'broccoli', quantity: 1, unit: 'lb', department: 'Produce' }],
      });
      const importedSide = makeRecipe({
        id: 'mealdb-veg',
        role: 'side',
        provides: ['vegetable'],
        primaryProtein: 'None',
        estimated: true,
        ingredients: [{ name: 'carrot', quantity: 1, unit: 'piece', department: 'Produce' }],
      });
      const curatedAltSide = makeRecipe({
        id: 'curated-veg-alt',
        role: 'side',
        provides: ['vegetable'],
        primaryProtein: 'None',
        ingredients: [{ name: 'spinach', quantity: 1, unit: 'lb', department: 'Produce' }],
      });
      const plan = makePlan({
        meals: [makeMeal({ recipeId: 'curated-main2', dayIndex: 0, sideRecipeIds: ['kept-starch', 'current-veg'] })],
      });
      const recipes = [main, keptSide, currentNonKept, importedSide, curatedAltSide];
      const profile = makeProfile({ allergies: ['Peanuts'] });
      const ctx = ctxFor({ profile, intake: makeIntake(profile) });
      const available = new Set(['chicken', 'rice', 'spinach']);
      const getRecipe = (id: string) => recipes.find((r) => r.id === id);

      const outcome = rerollCandidates(plan, 0, recipes, getRecipe, available, ctx, {
        keepMain: true,
        keptSideIds: ['kept-starch'],
      });

      const allSideIds = [
        ...outcome.candidates.flatMap((c) => c.sideRecipeIds),
        ...outcome.nearMisses.flatMap((n) => n.sideRecipeIds),
      ];
      expect(allSideIds.some((id) => id.startsWith('mealdb-'))).toBe(false);
    });
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

/** The bug: the pin screen printed "already in this week's plan" for every
 * empty `pinnableDays` result, so a week whose days had elapsed (the active
 * plan, while reviewing next week's draft) claimed the recipe was already
 * pinned. Each cause now reports itself. */
describe('pinBlockReason', () => {
  const today = new Date('2026-07-07T09:00:00.000Z'); // day 2 of a 2026-07-05 week

  it('returns null when at least one day is pinnable', () => {
    const plan = makePlan({
      meals: [makeMeal({ recipeId: 'r2', dayIndex: 2 }), makeMeal({ recipeId: 'r3', dayIndex: 3 })],
    });
    expect(pinBlockReason(plan, 'new-recipe', today)).toBeNull();
  });

  it('reports already-in-plan when the recipe is on some day of the week', () => {
    const plan = makePlan({
      meals: [makeMeal({ recipeId: 'already-planned', dayIndex: 3 }), makeMeal({ recipeId: 'r4', dayIndex: 4 })],
    });
    expect(pinBlockReason(plan, 'already-planned', today)).toBe('already-in-plan');
  });

  it('reports week-elapsed when no day of the plan is today-or-later', () => {
    // The reported bug: last week's still-active plan, every day in the past.
    const plan = makePlan({
      meals: [makeMeal({ recipeId: 'r0', dayIndex: 0 }), makeMeal({ recipeId: 'r1', dayIndex: 1 })],
    });
    expect(pinBlockReason(plan, 'new-recipe', today)).toBe('week-elapsed');
  });

  it('reports remaining-days-cooked when every upcoming day is already cooked', () => {
    const plan = makePlan({
      meals: [
        makeMeal({ recipeId: 'r1', dayIndex: 1 }), // past, uncooked — not a pin target either way
        makeMeal({ recipeId: 'r2', dayIndex: 2, cooked: true }),
        makeMeal({ recipeId: 'r3', dayIndex: 3, cooked: true }),
      ],
    });
    expect(pinBlockReason(plan, 'new-recipe', today)).toBe('remaining-days-cooked');
  });

  it('agrees with pinnableDays: a reason is present exactly when there are no pinnable days', () => {
    const cases = [
      makePlan({ meals: [makeMeal({ recipeId: 'r3', dayIndex: 3 })] }),
      makePlan({ meals: [makeMeal({ recipeId: 'r0', dayIndex: 0 })] }),
      makePlan({ meals: [makeMeal({ recipeId: 'r3', dayIndex: 3, cooked: true })] }),
      makePlan({ meals: [makeMeal({ recipeId: 'target', dayIndex: 3 })] }),
    ];
    for (const plan of cases) {
      const blocked = pinBlockReason(plan, 'target', today) !== null;
      expect(pinnableDays(plan, 'target', today).length === 0).toBe(blocked);
    }
  });
});
