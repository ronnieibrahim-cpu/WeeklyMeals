import { GenerateContext } from './types';
import { LocalRecommendationEngine, selectReplacement } from './LocalRecommendationEngine';
import { scoreRecipe } from './scoring';
import { makeIntake, makeProfile, makeRecipe } from '../testFixtures';

function ctxFor(overrides: Partial<GenerateContext> = {}): GenerateContext {
  const profile = makeProfile();
  const intake = makeIntake(profile, { dinners: 5 });
  return { intake, profile, pantry: [], season: 'summer', ...overrides };
}

describe('LocalRecommendationEngine.generate', () => {
  it('keeps every locked recipe in the result', () => {
    const engine = new LocalRecommendationEngine();
    const locked = makeRecipe({ id: 'locked-1', cuisine: 'Thai' });
    const pool = [locked, ...Array.from({ length: 10 }, (_, i) => makeRecipe({ id: `pool-${i}` }))];
    const ctx = ctxFor({ lockedRecipeIds: ['locked-1'] });

    const meals = engine.generate(ctx, pool);

    expect(meals.some((m) => m.recipeId === 'locked-1' && m.locked)).toBe(true);
  });

  it('never picks the same recipe twice in one week', () => {
    const engine = new LocalRecommendationEngine();
    const pool = Array.from({ length: 8 }, (_, i) => makeRecipe({ id: `r-${i}` }));
    const ctx = ctxFor({ intake: makeIntake(makeProfile(), { dinners: 7 }) });

    const meals = engine.generate(ctx, pool);
    const ids = meals.map((m) => m.recipeId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never returns more meals than intake.dinners', () => {
    const engine = new LocalRecommendationEngine();
    const pool = Array.from({ length: 20 }, (_, i) => makeRecipe({ id: `r-${i}` }));
    const ctx = ctxFor({ intake: makeIntake(makeProfile(), { dinners: 3 }) });

    const meals = engine.generate(ctx, pool);

    expect(meals.length).toBeLessThanOrEqual(3);
  });

  it('drops recipes that fail hard filters (allergy) from the pool entirely', () => {
    const engine = new LocalRecommendationEngine();
    const unsafe = makeRecipe({ id: 'unsafe', allergens: ['Peanuts'] });
    const safe = Array.from({ length: 6 }, (_, i) => makeRecipe({ id: `safe-${i}` }));
    const profile = makeProfile({ allergies: ['Peanuts'] });
    const ctx = ctxFor({ profile, intake: makeIntake(profile, { dinners: 5 }) });

    const meals = engine.generate(ctx, [unsafe, ...safe]);

    expect(meals.some((m) => m.recipeId === 'unsafe')).toBe(false);
  });

  it('excludes recipes the learning system has blocked', () => {
    const engine = new LocalRecommendationEngine();
    const blocked = makeRecipe({ id: 'blocked-1' });
    const others = Array.from({ length: 6 }, (_, i) => makeRecipe({ id: `ok-${i}` }));
    const ctx = ctxFor({
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
        blockedRecipeIds: ['blocked-1'],
      },
    });

    const meals = engine.generate(ctx, [blocked, ...others]);

    expect(meals.some((m) => m.recipeId === 'blocked-1')).toBe(false);
  });
});

describe('scoreRecipe curated bonus (M2.4)', () => {
  it('scores an otherwise-identical curated recipe higher than an imported one', () => {
    const ctx = ctxFor();
    const curated = makeRecipe({ id: 'curated-recipe' });
    const imported = makeRecipe({ id: 'mealdb-imported-recipe' });

    const curatedScore = scoreRecipe(curated, ctx, []);
    const importedScore = scoreRecipe(imported, ctx, []);

    expect(curatedScore).toBeGreaterThan(importedScore);
  });
});

describe('selectReplacement', () => {
  it('never returns a recipe outside the given candidate list', () => {
    const ctx = ctxFor();
    const candidates = Array.from({ length: 5 }, (_, i) => makeRecipe({ id: `cand-${i}` }));

    const picked = selectReplacement(candidates, ctx, []);

    expect(picked).not.toBeNull();
    expect(candidates.map((c) => c.id)).toContain(picked!.id);
  });

  it('returns null when given an empty candidate list', () => {
    const ctx = ctxFor();
    expect(selectReplacement([], ctx, [])).toBeNull();
  });
});
