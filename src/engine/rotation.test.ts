import {
  CONFIDENCE_FULL_AT_RATINGS,
  FAVORITE_REST_WEEKS,
  FAVORITES_PER_WEEK,
  favoriteCrowdingFactor,
  favoriteRestFactor,
  learningConfidence,
  recencyByRecipe,
  REPEAT_FADE_WEEKS,
  repeatPenaltyFactor,
} from './rotation';
import { makeMeal, makePlan } from './testFixtures';

describe('recencyByRecipe', () => {
  const reference = '2026-07-26'; // a Sunday, the week being planned

  it('reports 0 for a plan starting in the current week', () => {
    const plan = makePlan({ weekStartISO: '2026-07-22', meals: [makeMeal({ recipeId: 'a', dayIndex: 0 })] });
    expect(recencyByRecipe([plan], reference)).toEqual({ a: 0 });
  });

  it('reports whole weeks for older plans', () => {
    const lastWeek = makePlan({
      id: 'p1',
      weekStartISO: '2026-07-19',
      meals: [makeMeal({ recipeId: 'a', dayIndex: 0 })],
    });
    const threeWeeksAgo = makePlan({
      id: 'p2',
      weekStartISO: '2026-07-05',
      meals: [makeMeal({ recipeId: 'b', dayIndex: 0 })],
    });

    expect(recencyByRecipe([lastWeek, threeWeeksAgo], reference)).toEqual({ a: 1, b: 3 });
  });

  it('keeps the most recent appearance when a recipe is in several plans', () => {
    const old = makePlan({ id: 'p1', weekStartISO: '2026-06-28', meals: [makeMeal({ recipeId: 'a', dayIndex: 0 })] });
    const recent = makePlan({ id: 'p2', weekStartISO: '2026-07-19', meals: [makeMeal({ recipeId: 'a', dayIndex: 0 })] });

    expect(recencyByRecipe([old, recent], reference).a).toBe(1);
    // Order must not matter — the archive sorts newest-first while the caller
    // prepends the active plan.
    expect(recencyByRecipe([recent, old], reference).a).toBe(1);
  });

  it('treats a week planned ahead as the current week, never as negative rest', () => {
    const ahead = makePlan({ weekStartISO: '2026-08-09', meals: [makeMeal({ recipeId: 'a', dayIndex: 0 })] });
    expect(recencyByRecipe([ahead], reference).a).toBe(0);
  });

  it('ignores sides — only mains carry cross-week rotation', () => {
    const plan = makePlan({
      weekStartISO: '2026-07-19',
      meals: [makeMeal({ recipeId: 'main-1', dayIndex: 0, sideRecipeIds: ['side-1', 'side-2'] })],
    });
    const map = recencyByRecipe([plan], reference);

    expect(map['main-1']).toBe(1);
    expect(map['side-1']).toBeUndefined();
    expect(map['side-2']).toBeUndefined();
  });

  it('returns an empty map for no plans (cold start)', () => {
    expect(recencyByRecipe([], reference)).toEqual({});
  });
});

describe('favoriteRestFactor', () => {
  it('gives a favorite planned this week essentially no bonus', () => {
    expect(favoriteRestFactor(0)).toBe(0);
  });

  it('ramps up with weeks of rest and tops out at full strength', () => {
    expect(favoriteRestFactor(1)).toBeCloseTo(1 / 3);
    expect(favoriteRestFactor(2)).toBeCloseTo(2 / 3);
    expect(favoriteRestFactor(FAVORITE_REST_WEEKS)).toBe(1);
    expect(favoriteRestFactor(FAVORITE_REST_WEEKS + 5)).toBe(1);
  });

  it('treats a recipe with no history as fully rested', () => {
    expect(favoriteRestFactor(undefined)).toBe(1);
  });

  it('is monotonic in weeks of rest', () => {
    for (let w = 0; w < 8; w++) {
      expect(favoriteRestFactor(w + 1)).toBeGreaterThanOrEqual(favoriteRestFactor(w));
    }
  });
});

describe('repeatPenaltyFactor', () => {
  it('is strongest for something on the current plan and fades to nothing', () => {
    expect(repeatPenaltyFactor(0)).toBe(1);
    expect(repeatPenaltyFactor(1)).toBeCloseTo(0.75);
    expect(repeatPenaltyFactor(REPEAT_FADE_WEEKS)).toBe(0);
    expect(repeatPenaltyFactor(REPEAT_FADE_WEEKS + 3)).toBe(0);
  });

  it('does not penalize a recipe with no recent history', () => {
    expect(repeatPenaltyFactor(undefined)).toBe(0);
  });

  it('never leaves 0…1, so WEIGHTS.repeat bounds its contribution', () => {
    for (const w of [0, 1, 2, 3, 4, 12, undefined]) {
      const factor = repeatPenaltyFactor(w);
      expect(factor).toBeGreaterThanOrEqual(0);
      expect(factor).toBeLessThanOrEqual(1);
    }
  });
});

describe('favoriteCrowdingFactor', () => {
  it('gives the first favorite of a week its full bonus', () => {
    expect(favoriteCrowdingFactor(0)).toBe(1);
  });

  it('tapers to zero once the per-week allowance is used up', () => {
    expect(favoriteCrowdingFactor(1)).toBe(0.5);
    expect(favoriteCrowdingFactor(FAVORITES_PER_WEEK)).toBe(0);
    expect(favoriteCrowdingFactor(FAVORITES_PER_WEEK + 4)).toBe(0);
  });
});

describe('learningConfidence', () => {
  it('is zero with nothing rated', () => {
    expect(learningConfidence(0)).toBe(0);
    expect(learningConfidence(undefined)).toBe(0);
  });

  it('ramps in proportionally — one week of ratings speaks quietly', () => {
    expect(learningConfidence(4)).toBeCloseTo(4 / CONFIDENCE_FULL_AT_RATINGS);
    expect(learningConfidence(4)).toBeLessThan(0.5);
  });

  it('reaches full strength at the threshold and stays there', () => {
    expect(learningConfidence(CONFIDENCE_FULL_AT_RATINGS)).toBe(1);
    expect(learningConfidence(CONFIDENCE_FULL_AT_RATINGS * 10)).toBe(1);
  });
});
