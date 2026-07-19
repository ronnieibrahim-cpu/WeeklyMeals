import { Department, PlannedMeal, Recipe, RecipeIngredient, ShoppingItem, Unit } from '@/domain/models';

/**
 * M4.3: waste-aware planning. Pure, deterministic — no React, no I/O, no
 * store imports (CLAUDE.md layering rule). This module never mutates the
 * shopping list or the plan on its own; it only feeds a small scoring bonus
 * (`wasteFitBonus`, wired into `scoreRecipe`/`scoreSide`) and two small
 * lookups the follow-up harness/UI tasks will use
 * (`isWholeUnitShoppingItem`, `mealsUsingItem`).
 */

/** Departments where a "whole unit" purchase (a head of cabbage, a pound of
 * ground beef, a bunch of cilantro) is the normal way groceries are sold —
 * as opposed to DryGoods/Spices/International/Frozen/Household, which are
 * either shelf-stable (no waste clock) or already sold in small, easily-used
 * quantities. */
const WHOLE_UNIT_DEPARTMENTS: Department[] = ['Produce', 'Meat', 'Seafood', 'Dairy', 'Bakery'];

/** Units that are already an indivisible purchase unit in this data model —
 * you buy exactly one "piece"/"bunch"/"can" and either use all of it or
 * don't. A quantity of 1 of any of these is a whole unit consumed cleanly; a
 * quantity below 1 (0.5 piece of cabbage) is the classic "half a cabbage
 * left over" case. */
const INDIVISIBLE_PURCHASE_UNITS: Unit[] = ['piece', 'bunch', 'can'];

/** Units sold by weight/volume where a quantity below 1 (0.4 lb ground beef,
 * 0.5 l buttermilk) usually still means buying a whole package sized around
 * 1 unit — most groceries aren't sold in exact fractional weights — so the
 * leftover risk is real even though the unit itself isn't "indivisible" the
 * way piece/bunch/can are. */
const SUB_UNIT_BY_WEIGHT_UNITS: Unit[] = ['lb', 'kg', 'l'];

function isByWeightUnit(unit: Unit): boolean {
  return SUB_UNIT_BY_WEIGHT_UNITS.includes(unit);
}

/**
 * Heuristic: is this ingredient a "perishable, whole-unit" purchase — the
 * kind of thing where buying enough for one recipe risks leaving a partial
 * unit to go bad in the fridge, rather than a shelf-stable staple or a
 * quantity that's already sold in the exact amount needed?
 *
 * True when ALL of:
 * - not a `pantryStaple` (salt/oil/etc. — never bought fresh per recipe),
 * - department is Produce/Meat/Seafood/Dairy/Bakery, AND EITHER
 *   - the unit is an indivisible purchase unit (`piece`/`bunch`/`can`), OR
 *   - the unit is a by-weight/volume unit (`lb`/`kg`/`l`) with quantity < 1
 *     (you can't buy 0.4 lb of most packaged goods — a whole unit gets
 *     bought and the rest risks waste).
 */
export function isWholeUnitPerishable(ing: RecipeIngredient): boolean {
  if (ing.pantryStaple) return false;
  if (!WHOLE_UNIT_DEPARTMENTS.includes(ing.department)) return false;
  if (INDIVISIBLE_PURCHASE_UNITS.includes(ing.unit)) return true;
  if (isByWeightUnit(ing.unit) && ing.quantity < 1) return true;
  return false;
}

function keyFor(name: string, unit: Unit): string {
  return `${name.trim().toLowerCase()}|${unit}`;
}

/**
 * Scoring bonus (0..1): does `candidate` reuse a whole-unit perishable that
 * `weekRecipes` has already forced the household to buy, in a way that
 * leaves a partial unit unconsumed? Keyed by lowercased ingredient name +
 * unit so "cabbage|piece" in one recipe matches "cabbage|piece" in another
 * (a different unit, e.g. "cabbage|lb", is a different purchase and doesn't
 * match).
 *
 * For each of the candidate's whole-unit-perishable ingredients: sum every
 * whole-unit-perishable use of that same key across `weekRecipes`. That's a
 * match when:
 * - indivisible units (`piece`/`bunch`/`can`): the summed quantity has a
 *   fractional part (e.g. two recipes using 0.5 + 0.5 piece sum to a whole
 *   cabbage — no leftover, no match; one recipe alone using 0.5 leaves half
 *   a cabbage — a match), or
 * - by-weight/volume sub-unit case (`lb`/`kg`/`l` under 1): always a match —
 *   a whole purchase unit gets bought regardless of how the fractional
 *   amounts happen to sum.
 *
 * Graded so one match already gives a solid partial credit, two or more
 * caps it out — deliberately small next to `variety`/`curated`/`kidApproved`
 * (see WEIGHTS.wasteFit in recommendation/types.ts): a tie/near-tie breaker,
 * never strong enough to bury a better dish.
 */
export function wasteFitBonus(candidate: Recipe, weekRecipes: Recipe[]): number {
  const candidateItems = candidate.ingredients.filter(isWholeUnitPerishable);
  if (candidateItems.length === 0 || weekRecipes.length === 0) return 0;

  const weekSums = new Map<string, number>();
  for (const recipe of weekRecipes) {
    for (const ing of recipe.ingredients) {
      if (!isWholeUnitPerishable(ing)) continue;
      const key = keyFor(ing.name, ing.unit);
      weekSums.set(key, (weekSums.get(key) ?? 0) + ing.quantity);
    }
  }
  if (weekSums.size === 0) return 0;

  let matches = 0;
  for (const ing of candidateItems) {
    const sum = weekSums.get(keyFor(ing.name, ing.unit));
    if (sum === undefined) continue;
    const leavesPartialUnit = isByWeightUnit(ing.unit) ? true : !Number.isInteger(sum);
    if (leavesPartialUnit) matches += 1;
  }

  return Math.min(1, matches / 2);
}

/**
 * Shopping-list-line version of the same department/unit heuristic
 * (`ShoppingItem` has no `pantryStaple` field — pantry staples never make it
 * onto the built list in the first place, see `buildShoppingList`). For the
 * follow-up UI task (M4.3's "used in 2 meals" line) — exported and tested
 * now so that task is a thin wiring change, not new logic.
 */
export function isWholeUnitShoppingItem(item: Pick<ShoppingItem, 'department' | 'unit' | 'quantity'>): boolean {
  if (!WHOLE_UNIT_DEPARTMENTS.includes(item.department)) return false;
  if (INDIVISIBLE_PURCHASE_UNITS.includes(item.unit)) return true;
  if (isByWeightUnit(item.unit) && item.quantity < 1) return true;
  return false;
}

/**
 * How many distinct plan days reference any of `fromRecipeIds` — via a
 * meal's main (`recipeId`) or its composed sides (`sideRecipeIds`). Used by
 * the follow-up shopping-list UI to show "used in 2 meals" against a
 * shared, whole-unit item's `fromRecipeIds` provenance. Counts DAYS, not
 * recipe references, so a plate that uses the same ingredient in both its
 * main and a side still counts once for that day.
 */
export function mealsUsingItem(fromRecipeIds: string[], meals: PlannedMeal[]): number {
  const ids = new Set(fromRecipeIds);
  const days = new Set<number>();
  for (const meal of meals) {
    const usesIt = ids.has(meal.recipeId) || (meal.sideRecipeIds ?? []).some((id) => ids.has(id));
    if (usesIt) days.add(meal.dayIndex);
  }
  return days.size;
}
