import { PlannedMeal } from '@/domain/models';

import { allMealsRated, isMealRated, unratedMeals } from './rating';
import { makeMeal } from './testFixtures';

function meals(specs: Array<Partial<PlannedMeal> & Pick<PlannedMeal, 'dayIndex'>>): PlannedMeal[] {
  return specs.map((s) => makeMeal({ recipeId: `r${s.dayIndex}`, ...s }));
}

describe('isMealRated', () => {
  it('is true only when rating is a number', () => {
    expect(isMealRated(makeMeal({ recipeId: 'r0', dayIndex: 0, rating: 4 }))).toBe(true);
    expect(isMealRated(makeMeal({ recipeId: 'r0', dayIndex: 0 }))).toBe(false);
  });
});

describe('unratedMeals', () => {
  it('returns only meals without a rating', () => {
    const all = meals([{ dayIndex: 0, rating: 5 }, { dayIndex: 1 }, { dayIndex: 2, rating: 1 }]);
    expect(unratedMeals(all).map((m) => m.dayIndex)).toEqual([1]);
  });
});

describe('allMealsRated', () => {
  it('is false for an empty week (nothing to rate yet is not "done")', () => {
    expect(allMealsRated([])).toBe(false);
  });

  it('is false when at least one meal is unrated', () => {
    const all = meals([{ dayIndex: 0, rating: 5 }, { dayIndex: 1 }]);
    expect(allMealsRated(all)).toBe(false);
  });

  it('is true when every meal has a rating', () => {
    const all = meals([{ dayIndex: 0, rating: 5 }, { dayIndex: 1, rating: 3 }]);
    expect(allMealsRated(all)).toBe(true);
  });
});
