import { PlannedMeal, WeeklyPlan } from '@/domain/models';

/**
 * M4.6 part 1: rearrange an APPROVED week by swapping two not-yet-cooked
 * days' meals. Pure engine function — no React, no I/O, no store imports.
 *
 * A "move" and a "swap" are the same operation here: the product spec calls
 * it "Move to…", but since every occupied day already holds a meal, moving a
 * dish onto an occupied day always displaces what was there — there is no
 * "move to an empty day" case for an approved week (every dayIndex 0-6 is
 * populated at generation). So this function always swaps the two ENTIRE
 * meal bodies between `fromDay` and `toDay`'s slots: `recipeId`,
 * `sideRecipeIds`, `servings`, `rating`/`ratedAtISO`, `cooked`/`cookedAtISO`,
 * `locked`, `isLeftoverDay`/`leftoverFromRecipeId` — every field except
 * `dayIndex` itself, which is the slot key and never travels. Ratings must
 * never detach from their dish, so a rating stays attached to the recipeId
 * it was given for, riding along to the new day.
 *
 * Guard (returns `null`, meaning "no change", rather than throwing): a
 * no-op swap (`fromDay === toDay`), a day with no meal on the plan, or
 * either side already `cooked`. "A cooked day is history" — cook-mode
 * progress, the rating, and the record of what was actually eaten that
 * night must never be rewritten by a later rearrange. The caller (the
 * store action) is expected to have already filtered the day picker to
 * not-yet-cooked days; this is defense in depth, not the only check.
 *
 * Sync stamping — the dangerous part, per the M4.6 spec: `mergePlanMeals`
 * (see `syncMerge.ts`) is keyed by `dayIndex`, and gates whole-meal-body
 * divergence on `recipeChangedAtISO` (`resolveDivergedRecipe`) — whichever
 * side has the newer stamp wins the ENTIRE meal body on that day, not a
 * field-by-field merge. A swap changes the `recipeId` on TWO days in one
 * user action; if only one of them were stamped, a remote device could
 * adopt the stamped day's new body while the other day's edit either loses
 * to `resolveDivergedRecipe`'s epoch-0 default or — worse — merges
 * field-by-field against a DIFFERENT recipeId than what shipped with it,
 * mixing half of this swap with whatever the remote device did to that day
 * independently. Stamping BOTH resulting meals with the same `nowISO` makes
 * a remote device that has diverged on either day adopt BOTH whole bodies
 * together as one atomic unit via `resolveDivergedRecipe`, which is what
 * keeps a swap indivisible across the two days it touches, and is exactly
 * what race test (b)/(c) in `syncMerge.test.ts` exercise.
 *
 * Meals array ordering: the returned `meals` array preserves the ORIGINAL
 * ARRAY POSITIONS of `plan.meals` — only the two matching-`dayIndex`
 * elements' contents change (via `.map()`), nothing is resorted or
 * reinserted. This matches every other planStore mutation (`toggleCooked`,
 * `rerollMeal`, `setApprovedMealServings`, …), which all do the same
 * `plan.meals.map((m) => …)` over the existing array without touching
 * order — there is no place in the codebase that depends on `meals` being
 * sorted by `dayIndex` at rest (readers look up by `dayIndex` via `.find`/
 * a `Map`, e.g. `mergePlanMeals`'s own `aByDay`/`bByDay`), so preserving
 * position is simply the path of least surprise and the smallest diff.
 */
export function moveMeal(
  plan: WeeklyPlan,
  fromDay: number,
  toDay: number,
  nowISO: string,
): WeeklyPlan | null {
  if (fromDay === toDay) return null;

  const fromMeal = plan.meals.find((m) => m.dayIndex === fromDay);
  const toMeal = plan.meals.find((m) => m.dayIndex === toDay);
  if (!fromMeal || !toMeal) return null;
  if (fromMeal.cooked || toMeal.cooked) return null;

  const swappedFrom: PlannedMeal = { ...toMeal, dayIndex: fromDay, recipeChangedAtISO: nowISO };
  const swappedTo: PlannedMeal = { ...fromMeal, dayIndex: toDay, recipeChangedAtISO: nowISO };

  const meals = plan.meals.map((m) => {
    if (m.dayIndex === fromDay) return swappedFrom;
    if (m.dayIndex === toDay) return swappedTo;
    return m;
  });

  return { ...plan, meals };
}
