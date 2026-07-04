import { GenerateContext, WEIGHTS } from './types';
import { LocalRecommendationEngine, rankReplacements } from './LocalRecommendationEngine';
import { scoreRecipe } from './scoring';
import { makeIntake, makePreferences, makeProfile, makeRecipe } from '../testFixtures';

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

  it('varies which recipe it picks across runs when several are near-equally good, instead of always the same one', () => {
    // Identical fixtures (bar id) score exactly the same for any context —
    // without near-tie randomization, "the highest scorer" would
    // deterministically be whichever one happens first, every single time.
    const engine = new LocalRecommendationEngine();
    const pool = Array.from({ length: 10 }, (_, i) => makeRecipe({ id: `tied-${i}` }));
    const ctx = ctxFor({ intake: makeIntake(makeProfile(), { dinners: 1 }) });

    const firstPicks = new Set<string>();
    for (let i = 0; i < 30; i++) {
      firstPicks.add(engine.generate(ctx, pool)[0].recipeId);
    }

    expect(firstPicks.size).toBeGreaterThan(1);
  });

  it('still reliably picks the clear best fit even with near-tie randomization in play', () => {
    // One recipe that scores far ahead of the rest (matches every
    // preference factor tightly) should win every time — near-tie
    // randomization must only kick in among genuinely close contenders,
    // never let a clearly worse recipe substitute for an obviously better one.
    const engine = new LocalRecommendationEngine();
    const profile = makeProfile({ favoriteCuisines: ['Thai'], preferredProteins: ['Tofu'] });
    const intake = makeIntake(profile, { dinners: 1, cuisines: ['Thai'], proteins: ['Tofu'] });
    const ctx = ctxFor({ profile, intake });

    const clearBest = makeRecipe({ id: 'clear-best', cuisine: 'Thai', primaryProtein: 'Tofu' });
    const rest = Array.from({ length: 10 }, (_, i) =>
      makeRecipe({ id: `mediocre-${i}`, cuisine: 'French', primaryProtein: 'Pork' }),
    );

    for (let i = 0; i < 20; i++) {
      const meals = engine.generate(ctx, [clearBest, ...rest]);
      expect(meals[0].recipeId).toBe('clear-best');
    }
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

describe('scoreRecipe kid-approved bonus (M3.2)', () => {
  it('scores an otherwise-identical kid-approved recipe higher than a non-approved one', () => {
    const approved = makeRecipe({ id: 'approved-recipe' });
    const notApproved = makeRecipe({ id: 'not-approved-recipe' });
    const ctx = ctxFor({ kidApprovedRecipeIds: ['approved-recipe'] });

    expect(scoreRecipe(approved, ctx, [])).toBeGreaterThan(scoreRecipe(notApproved, ctx, []));
  });

  it('caps kidApproved weight structurally below preference and affinity, same guarantee as learnedDials (M3.0)', () => {
    expect(WEIGHTS.kidApproved).toBeLessThan(WEIGHTS.preference);
    expect(WEIGHTS.kidApproved).toBeLessThan(WEIGHTS.affinity);
  });

  it('never lets the kid-approved bonus override a profile hard filter (allergy)', () => {
    const engine = new LocalRecommendationEngine();
    const unsafe = makeRecipe({ id: 'unsafe-but-kid-approved', allergens: ['Peanuts'] });
    const safe = Array.from({ length: 6 }, (_, i) => makeRecipe({ id: `safe-${i}` }));
    const profile = makeProfile({ allergies: ['Peanuts'] });
    const ctx = ctxFor({
      profile,
      intake: makeIntake(profile, { dinners: 5 }),
      kidApprovedRecipeIds: ['unsafe-but-kid-approved'],
    });

    const meals = engine.generate(ctx, [unsafe, ...safe]);

    expect(meals.some((m) => m.recipeId === 'unsafe-but-kid-approved')).toBe(false);
  });
});

describe('scoreRecipe learned dials (M2.6)', () => {
  it('scores a mild recipe higher once the learner has picked up spice aversion', () => {
    const ctx = ctxFor({ preferences: makePreferences({ spiceTolerance: -1 }) });
    const mild = makeRecipe({ id: 'mild', spiceLevel: 'None' });
    const hot = makeRecipe({ id: 'hot', spiceLevel: 'Hot' });

    expect(scoreRecipe(mild, ctx, [])).toBeGreaterThan(scoreRecipe(hot, ctx, []));
  });

  it('scores a spicy recipe higher once the learner has picked up a taste for heat', () => {
    const ctx = ctxFor({ preferences: makePreferences({ spiceTolerance: 1 }) });
    const mild = makeRecipe({ id: 'mild', spiceLevel: 'None' });
    const hot = makeRecipe({ id: 'hot', spiceLevel: 'Hot' });

    expect(scoreRecipe(hot, ctx, [])).toBeGreaterThan(scoreRecipe(mild, ctx, []));
  });

  it('favors easier recipes once the learner has picked up a preference for less effort', () => {
    const ctx = ctxFor({ preferences: makePreferences({ complexityPreference: -1 }) });
    const easy = makeRecipe({ id: 'easy', difficulty: 'Easy' });
    const hard = makeRecipe({ id: 'hard', difficulty: 'Hard' });

    expect(scoreRecipe(easy, ctx, [])).toBeGreaterThan(scoreRecipe(hard, ctx, []));
  });

  it('favors cheaper recipes once the learner has picked up budget sensitivity', () => {
    // Neither protein is in the default profile's preferredProteins (Chicken, Beef),
    // so the only thing distinguishing these two is cost.
    const ctx = ctxFor({ preferences: makePreferences({ budgetSensitivity: 1 }) });
    const cheap = makeRecipe({ id: 'cheap', primaryProtein: 'Lentils', ingredients: [] });
    const pricey = makeRecipe({ id: 'pricey', primaryProtein: 'Lamb', ingredients: [] });

    expect(scoreRecipe(cheap, ctx, [])).toBeGreaterThan(scoreRecipe(pricey, ctx, []));
  });

  it('favors recipes that make leftovers once the learner has picked up leftover tolerance', () => {
    const ctx = ctxFor({ preferences: makePreferences({ leftoverTolerance: 1 }) });
    const withLeftovers = makeRecipe({ id: 'has-leftovers', makesLeftovers: true });
    const without = makeRecipe({ id: 'no-leftovers', makesLeftovers: false });

    expect(scoreRecipe(withLeftovers, ctx, [])).toBeGreaterThan(scoreRecipe(without, ctx, []));
  });

  it('favors recipes with a liked vegetable once the learner has picked up vegetableAffinity', () => {
    const ctx = ctxFor({ preferences: makePreferences({ vegetableAffinity: { broccoli: 1, kale: -1 } }) });
    const liked = makeRecipe({ id: 'liked-veg', vegetables: ['broccoli'] });
    const disliked = makeRecipe({ id: 'disliked-veg', vegetables: ['kale'] });

    expect(scoreRecipe(liked, ctx, [])).toBeGreaterThan(scoreRecipe(disliked, ctx, []));
  });

  it('caps learnedDials weight structurally below preference and affinity (M3.0)', () => {
    // The whole point of M2.6 is that learning nudges picks but never
    // dominates the explicit profile/questionnaire factors. That guarantee
    // rests on this weight ordering staying true — assert it directly so a
    // future retune can't silently break it.
    expect(WEIGHTS.learnedDials).toBeLessThan(WEIGHTS.preference);
    expect(WEIGHTS.learnedDials).toBeLessThan(WEIGHTS.affinity);
  });

  it('bounds the learned-dials score contribution to WEIGHTS.learnedDials even at maximally extreme dials', () => {
    // Every learned dial (spice/complexity/budget/leftover/vegetable) is
    // clamped to -1..1 in learning.ts, and learnedDialsFit averages them
    // into a single -1..1 nudge — so no matter how extreme the learner's
    // history, its contribution to any one recipe's score can't exceed
    // WEIGHTS.learnedDials. Cuisine/protein/technique affinities are left at
    // their neutral default so affinityBonus/ratingsPenalty (which also read
    // ctx.preferences) contribute nothing — isolating the learned-dials term.
    const recipe = makeRecipe({
      spiceLevel: 'Hot',
      difficulty: 'Hard',
      makesLeftovers: true,
      vegetables: ['broccoli'],
    });
    const extremePrefs = makePreferences({
      spiceTolerance: 1,
      complexityPreference: 1,
      budgetSensitivity: 1,
      leftoverTolerance: 1,
      vegetableAffinity: { broccoli: 1 },
    });
    const ctxNoPrefs = ctxFor();
    const ctxExtremePrefs = ctxFor({ preferences: extremePrefs });

    const diff = scoreRecipe(recipe, ctxExtremePrefs, []) - scoreRecipe(recipe, ctxNoPrefs, []);

    expect(diff).toBeLessThanOrEqual(WEIGHTS.learnedDials);
    expect(diff).toBeGreaterThan(0); // sanity check the dials actually moved the score
  });

  it('never lets learned dials override a profile hard filter (allergy)', () => {
    const engine = new LocalRecommendationEngine();
    // The learner loves everything about this recipe, but the profile has a peanut allergy.
    const unsafe = makeRecipe({
      id: 'unsafe-but-loved',
      allergens: ['Peanuts'],
      spiceLevel: 'Hot',
      makesLeftovers: true,
      vegetables: ['broccoli'],
    });
    const safe = Array.from({ length: 6 }, (_, i) => makeRecipe({ id: `safe-${i}` }));
    const profile = makeProfile({ allergies: ['Peanuts'] });
    const preferences = makePreferences({
      spiceTolerance: 1,
      leftoverTolerance: 1,
      vegetableAffinity: { broccoli: 1 },
    });
    const ctx = ctxFor({ profile, intake: makeIntake(profile, { dinners: 5 }), preferences });

    const meals = engine.generate(ctx, [unsafe, ...safe]);

    expect(meals.some((m) => m.recipeId === 'unsafe-but-loved')).toBe(false);
  });
});

describe('rankReplacements', () => {
  it('never returns a recipe outside the given candidate list', () => {
    const ctx = ctxFor();
    const candidates = Array.from({ length: 5 }, (_, i) => makeRecipe({ id: `cand-${i}` }));

    const picks = rankReplacements(candidates, ctx, [], 3);

    expect(picks.length).toBe(3);
    for (const p of picks) expect(candidates.map((c) => c.id)).toContain(p.id);
  });

  it('returns an empty array when given an empty candidate list', () => {
    const ctx = ctxFor();
    expect(rankReplacements([], ctx, [], 3)).toEqual([]);
  });

  it('returns fewer than `count` if there are fewer candidates than requested', () => {
    const ctx = ctxFor();
    const candidates = [makeRecipe({ id: 'only-one' })];
    expect(rankReplacements(candidates, ctx, [], 3)).toHaveLength(1);
  });

  it('prefers one pick per cuisine over the raw top-N, so 3 alternatives are meaningfully different', () => {
    const ctx = ctxFor();
    // Three near-identical American recipes would all out-score the sole
    // Thai one on every factor except variety (irrelevant here — none are
    // yet `selected`), so a blind top-3 would return all three American
    // recipes. rankReplacements should surface the Thai one instead of a
    // third American pick, since it hasn't used that cuisine slot yet.
    const american1 = makeRecipe({ id: 'am-1', cuisine: 'American', name: 'A' });
    const american2 = makeRecipe({ id: 'am-2', cuisine: 'American', name: 'B' });
    const american3 = makeRecipe({ id: 'am-3', cuisine: 'American', name: 'C' });
    const thai = makeRecipe({ id: 'thai-1', cuisine: 'Thai', name: 'D' });

    const picks = rankReplacements([american1, american2, american3, thai], ctx, [], 3);

    expect(picks).toHaveLength(3);
    const cuisines = picks.map((p) => p.cuisine);
    expect(new Set(cuisines).size).toBe(2); // American + Thai, not 3x American
    expect(picks.some((p) => p.id === 'thai-1')).toBe(true);
  });

  it('backfills with the next-best remaining candidates when fewer distinct cuisines exist than requested', () => {
    const ctx = ctxFor();
    // Only one cuisine available at all — must still return 3 distinct recipes.
    const candidates = Array.from({ length: 4 }, (_, i) => makeRecipe({ id: `am-${i}`, cuisine: 'American' }));

    const picks = rankReplacements(candidates, ctx, [], 3);

    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.id)).size).toBe(3); // no duplicates
  });
});
