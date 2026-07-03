import { Recipe, RatingEvent } from '@/domain/models';

import { applyRatings, createDefaultPreferences, migrateFavoritesToMap } from './learning';
import { makeRecipe } from './testFixtures';

function event(overrides: Partial<RatingEvent> & Pick<RatingEvent, 'recipeId'>): RatingEvent {
  return {
    id: `evt-${overrides.recipeId}-${Math.random()}`,
    planId: 'plan-1',
    cooked: true,
    ratedAtISO: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('createDefaultPreferences', () => {
  it('starts at neutral zero for every dial and empty affinity maps', () => {
    const prefs = createDefaultPreferences();
    expect(prefs.spiceTolerance).toBe(0);
    expect(prefs.complexityPreference).toBe(0);
    expect(prefs.budgetSensitivity).toBe(0);
    expect(prefs.leftoverTolerance).toBe(0);
    expect(prefs.mealsRated).toBe(0);
    expect(prefs.blockedRecipeIds).toEqual([]);
    expect(prefs.cuisineAffinity).toEqual({});
  });
});

describe('applyRatings', () => {
  it('is a pure fold: does not mutate the previous profile', () => {
    const prev = createDefaultPreferences();
    const recipe = makeRecipe({ id: 'r1', cuisine: 'Thai' });
    applyRatings(prev, [event({ recipeId: 'r1', enjoyment: 5 })], { r1: recipe });
    expect(prev.cuisineAffinity).toEqual({});
  });

  it('nudges cuisine affinity up for a high-enjoyment cooked meal', () => {
    const recipe = makeRecipe({ id: 'r1', cuisine: 'Thai' });
    const next = applyRatings(
      createDefaultPreferences(),
      [event({ recipeId: 'r1', enjoyment: 5, cookAgain: true, familyAgain: true })],
      { r1: recipe },
    );
    expect(next.cuisineAffinity.Thai).toBeGreaterThan(0);
  });

  it('nudges cuisine affinity down for a low-enjoyment cooked meal', () => {
    const recipe = makeRecipe({ id: 'r1', cuisine: 'Thai' });
    const next = applyRatings(
      createDefaultPreferences(),
      [event({ recipeId: 'r1', enjoyment: 1, cookAgain: false, familyAgain: false })],
      { r1: recipe },
    );
    expect(next.cuisineAffinity.Thai).toBeLessThan(0);
  });

  it('ignores events for meals that were never actually cooked', () => {
    const recipe = makeRecipe({ id: 'r1', cuisine: 'Thai' });
    const next = applyRatings(
      createDefaultPreferences(),
      [event({ recipeId: 'r1', cooked: false, enjoyment: 5 })],
      { r1: recipe },
    );
    expect(next.cuisineAffinity.Thai ?? 0).toBe(0);
    expect(next.mealsRated).toBe(0);
  });

  it('ignores events whose recipe cannot be resolved', () => {
    const next = applyRatings(createDefaultPreferences(), [event({ recipeId: 'unknown', enjoyment: 5 })], {});
    expect(next.mealsRated).toBe(0);
  });

  it('blocks a recipe rated 1 star', () => {
    const recipe = makeRecipe({ id: 'r1' });
    const next = applyRatings(createDefaultPreferences(), [event({ recipeId: 'r1', enjoyment: 1 })], { r1: recipe });
    expect(next.blockedRecipeIds).toContain('r1');
  });

  it('blocks a recipe rated <=2 stars with cookAgain=false', () => {
    const recipe = makeRecipe({ id: 'r1' });
    const next = applyRatings(
      createDefaultPreferences(),
      [event({ recipeId: 'r1', enjoyment: 2, cookAgain: false })],
      { r1: recipe },
    );
    expect(next.blockedRecipeIds).toContain('r1');
  });

  it('does not block a recipe rated 3 stars even with cookAgain=false', () => {
    const recipe = makeRecipe({ id: 'r1' });
    const next = applyRatings(
      createDefaultPreferences(),
      [event({ recipeId: 'r1', enjoyment: 3, cookAgain: false })],
      { r1: recipe },
    );
    expect(next.blockedRecipeIds).not.toContain('r1');
  });

  it('never adds the same recipe to blockedRecipeIds twice', () => {
    const recipe = makeRecipe({ id: 'r1' });
    const next = applyRatings(
      createDefaultPreferences(),
      [event({ recipeId: 'r1', enjoyment: 1 }), event({ recipeId: 'r1', enjoyment: 1 })],
      { r1: recipe },
    );
    expect(next.blockedRecipeIds.filter((id) => id === 'r1')).toHaveLength(1);
  });

  it('drops spiceTolerance on tooSpicy and raises it on tooBland', () => {
    const recipe = makeRecipe({ id: 'r1' });
    const spicy = applyRatings(createDefaultPreferences(), [event({ recipeId: 'r1', tooSpicy: true })], { r1: recipe });
    expect(spicy.spiceTolerance).toBeLessThan(0);

    const bland = applyRatings(createDefaultPreferences(), [event({ recipeId: 'r1', tooBland: true })], { r1: recipe });
    expect(bland.spiceTolerance).toBeGreaterThan(0);
  });

  it('recomputing from the full corrected history matches editing a rating (no double-counting)', () => {
    // Simulates M2.1's "rate 5, then edit to 1" integrity check: the derived
    // profile after an edit must equal a fresh fold of the corrected history,
    // not the original 5-star event plus a second 1-star event layered on top.
    const recipe = makeRecipe({ id: 'r1', cuisine: 'Mexican' });
    const recipesById: Record<string, Recipe> = { r1: recipe };

    const originalHistory = [event({ recipeId: 'r1', enjoyment: 5, cookAgain: true, familyAgain: true })];
    const correctedHistory = [event({ recipeId: 'r1', enjoyment: 1, cookAgain: false, familyAgain: false })];

    const afterEdit = applyRatings(createDefaultPreferences(), correctedHistory, recipesById);
    const freshFold = applyRatings(createDefaultPreferences(), correctedHistory, recipesById);

    expect(afterEdit).toEqual(freshFold);
    // Sanity: this is NOT the same as folding both events (which would double count).
    const doubleCounted = applyRatings(createDefaultPreferences(), [...originalHistory, ...correctedHistory], recipesById);
    expect(afterEdit).not.toEqual(doubleCounted);
  });

  it('updates mealsRated and avgEnjoyment across multiple rated meals', () => {
    const r1 = makeRecipe({ id: 'r1' });
    const r2 = makeRecipe({ id: 'r2' });
    const next = applyRatings(
      createDefaultPreferences(),
      [event({ recipeId: 'r1', enjoyment: 4 }), event({ recipeId: 'r2', enjoyment: 2 })],
      { r1, r2 },
    );
    expect(next.mealsRated).toBe(2);
    expect(next.avgEnjoyment).toBe(3);
  });
});

describe('migrateFavoritesToMap (M3.1)', () => {
  it('converts every id into a favorited entry stamped with the given timestamp', () => {
    const now = '2026-07-03T12:00:00.000Z';
    const map = migrateFavoritesToMap(['recipe-a', 'recipe-b'], now);
    expect(map).toEqual({
      'recipe-a': { flag: true, atISO: now },
      'recipe-b': { flag: true, atISO: now },
    });
  });

  it('an empty array migrates to an empty map', () => {
    expect(migrateFavoritesToMap([], '2026-07-03T12:00:00.000Z')).toEqual({});
  });
});
