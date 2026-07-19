import { IntakeAnswers, PlannedMeal, WeeklyPlan } from '@/domain/models';
import { eligibleMoveTargets, moveMeal } from './rearrange';
import { mergePlanMeals } from './syncMerge';

const INTAKE = {} as IntakeAnswers;

function meal(dayIndex: number, over: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    recipeId: `r${dayIndex}`,
    servings: 4,
    dayIndex,
    locked: false,
    cooked: false,
    cookedAtISO: null,
    rating: undefined,
    ratedAtISO: null,
    servingsChangedAtISO: null,
    sideRecipeIds: undefined,
    sidesChangedAtISO: null,
    ...over,
  };
}

function plan(meals: PlannedMeal[], over: Partial<WeeklyPlan> = {}): WeeklyPlan {
  return {
    id: 'plan-1',
    weekStartISO: '2026-07-13',
    intake: INTAKE,
    meals,
    status: 'approved',
    createdAtISO: '2026-07-13T00:00:00.000Z',
    ...over,
  };
}

const t0 = '2026-07-01T00:00:00.000Z';

describe('moveMeal', () => {
  it('swaps the entire meal bodies between two uncooked days, both directions', () => {
    const p = plan([
      meal(2, {
        recipeId: 'tuesday-dish',
        servings: 2,
        rating: 4,
        ratedAtISO: t0,
        sideRecipeIds: ['tue-side'],
        sidesChangedAtISO: t0,
        locked: true,
      }),
      meal(4, {
        recipeId: 'thursday-dish',
        servings: 5,
        rating: 2,
        ratedAtISO: t0,
        sideRecipeIds: ['thu-side'],
        sidesChangedAtISO: t0,
        locked: false,
      }),
    ]);

    const nowISO = '2026-07-14T09:00:00.000Z';
    const result = moveMeal(p, 2, 4, nowISO);
    expect(result).not.toBeNull();
    const merged = result!;

    const day2 = merged.meals.find((m) => m.dayIndex === 2)!;
    const day4 = merged.meals.find((m) => m.dayIndex === 4)!;

    // Thursday's dish, whole body, now lives on Tuesday's slot.
    expect(day2.dayIndex).toBe(2);
    expect(day2.recipeId).toBe('thursday-dish');
    expect(day2.servings).toBe(5);
    expect(day2.rating).toBe(2);
    expect(day2.ratedAtISO).toBe(t0);
    expect(day2.sideRecipeIds).toEqual(['thu-side']);
    expect(day2.locked).toBe(false);

    // Tuesday's dish, whole body, now lives on Thursday's slot.
    expect(day4.dayIndex).toBe(4);
    expect(day4.recipeId).toBe('tuesday-dish');
    expect(day4.servings).toBe(2);
    expect(day4.rating).toBe(4);
    expect(day4.ratedAtISO).toBe(t0);
    expect(day4.sideRecipeIds).toEqual(['tue-side']);
    expect(day4.locked).toBe(true);

    // Both days stamped with the swap's nowISO (the dangerous part).
    expect(day2.recipeChangedAtISO).toBe(nowISO);
    expect(day4.recipeChangedAtISO).toBe(nowISO);
  });

  it('preserves the original array position of every meal, including the two swapped ones', () => {
    const p = plan([meal(0), meal(2, { recipeId: 'tue' }), meal(4, { recipeId: 'thu' }), meal(6)]);
    const result = moveMeal(p, 2, 4, '2026-07-14T09:00:00.000Z')!;
    expect(result.meals.map((m) => m.dayIndex)).toEqual([0, 2, 4, 6]);
    // Position 1 (dayIndex 2) now holds Thursday's dish; position 2 (dayIndex 4) holds Tuesday's.
    expect(result.meals[1].recipeId).toBe('thu');
    expect(result.meals[2].recipeId).toBe('tue');
  });

  it('carries isLeftoverDay/leftoverFromRecipeId along with the rest of the body', () => {
    const p = plan([
      meal(2, { isLeftoverDay: true, leftoverFromRecipeId: 'r-earlier' }),
      meal(4),
    ]);
    const result = moveMeal(p, 2, 4, '2026-07-14T09:00:00.000Z')!;
    const day4 = result.meals.find((m) => m.dayIndex === 4)!;
    expect(day4.isLeftoverDay).toBe(true);
    expect(day4.leftoverFromRecipeId).toBe('r-earlier');
  });

  it('returns null for a no-op swap of a day onto itself', () => {
    const p = plan([meal(2), meal(4)]);
    expect(moveMeal(p, 2, 2, t0)).toBeNull();
  });

  it('returns null when fromDay has no meal on the plan', () => {
    const p = plan([meal(4)]);
    expect(moveMeal(p, 2, 4, t0)).toBeNull();
  });

  it('returns null when toDay has no meal on the plan', () => {
    const p = plan([meal(2)]);
    expect(moveMeal(p, 2, 4, t0)).toBeNull();
  });

  it('returns null when fromDay is already cooked ("a cooked day is history")', () => {
    const p = plan([meal(2, { cooked: true }), meal(4)]);
    expect(moveMeal(p, 2, 4, t0)).toBeNull();
  });

  it('returns null when toDay is already cooked', () => {
    const p = plan([meal(2), meal(4, { cooked: true })]);
    expect(moveMeal(p, 2, 4, t0)).toBeNull();
  });

  it('returns null when both days are cooked', () => {
    const p = plan([meal(2, { cooked: true }), meal(4, { cooked: true })]);
    expect(moveMeal(p, 2, 4, t0)).toBeNull();
  });

  it('idempotence via merge: applying the same swap object twice via mergePlanMeals changes nothing further', () => {
    const p = plan([meal(2, { recipeId: 'tue' }), meal(4, { recipeId: 'thu' })]);
    const swapped = moveMeal(p, 2, 4, '2026-07-14T09:00:00.000Z')!;

    const merged = mergePlanMeals(swapped, swapped);
    expect(merged).toEqual(swapped);

    const mergedAgain = mergePlanMeals(merged, swapped);
    expect(mergedAgain).toEqual(merged);
  });
});

describe('eligibleMoveTargets', () => {
  it('lists every other not-yet-cooked day, excluding fromDay itself', () => {
    const p = plan([meal(0), meal(2), meal(4), meal(6)]);
    expect(eligibleMoveTargets(p, 2).map((m) => m.dayIndex)).toEqual([0, 4, 6]);
  });

  it('excludes already-cooked days from the target list', () => {
    const p = plan([meal(0, { cooked: true }), meal(2), meal(4, { cooked: true }), meal(6)]);
    expect(eligibleMoveTargets(p, 2).map((m) => m.dayIndex)).toEqual([6]);
  });

  it('returns [] when fromDay itself is already cooked ("a cooked day is history")', () => {
    const p = plan([meal(2, { cooked: true }), meal(4)]);
    expect(eligibleMoveTargets(p, 2)).toEqual([]);
  });

  it('returns [] when fromDay has no meal on the plan', () => {
    const p = plan([meal(4)]);
    expect(eligibleMoveTargets(p, 2)).toEqual([]);
  });

  it('returns [] when every other day is already cooked (no swipe action should be offered)', () => {
    const p = plan([meal(2), meal(4, { cooked: true }), meal(6, { cooked: true })]);
    expect(eligibleMoveTargets(p, 2)).toEqual([]);
  });

  it('every day it returns is a legal moveMeal target — the UI never offers what the store would reject', () => {
    const p = plan([meal(0, { cooked: true }), meal(2), meal(4), meal(6, { cooked: true })]);
    for (const target of eligibleMoveTargets(p, 2)) {
      expect(moveMeal(p, 2, target.dayIndex, t0)).not.toBeNull();
    }
  });
});
