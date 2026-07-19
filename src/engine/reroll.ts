import { isMain, Recipe, ShoppingList, WeeklyPlan } from '@/domain/models';

import { composeSides } from './mealComposition';
import { passesHardFilters, scoreRecipe } from './recommendation';
import { GenerateContext } from './recommendation/types';
import { todayOffset } from './schedule';

const lower = (s: string) => s.trim().toLowerCase();

/**
 * M3.0: exact normalized match first; substring only as a fallback, and only
 * in the safe direction (an available name that's as long or longer than the
 * required name, containing it in full) — a shorter available name can never
 * satisfy a longer required one. Without this guard, having "cream" on hand
 * would wrongly satisfy a recipe that needs "coconut cream".
 */
function loosely(name: string, available: Set<string>): boolean {
  const n = lower(name);
  if (available.has(n)) return true;
  for (const a of available) {
    if (a.length >= n.length && a.includes(n)) return true;
  }
  return false;
}

/**
 * Normalized set of ingredient names considered "available" for a strict
 * mid-week re-roll (M2.2): pantry items + everything already on this week's
 * shopping list (assume purchased) + the outgoing PLATE's own ingredients —
 * the main and its sides (M4.2 part 2) — so a plate can always re-qualify as
 * its own replacement. Recipe-flagged pantry staples (salt/oil/etc.) aren't
 * included here — they're treated as always on hand, checked separately in
 * `missingIngredients`, same as `buildShoppingList` already excludes them
 * from the list entirely.
 */
export function availableIngredients(
  pantry: string[],
  shoppingList: ShoppingList | null,
  outgoingRecipe: Recipe | undefined,
  outgoingSides: Recipe[] = [],
): Set<string> {
  const set = new Set<string>();
  for (const p of pantry) set.add(lower(p));
  if (shoppingList) for (const item of shoppingList.items) set.add(lower(item.ingredientName));
  if (outgoingRecipe) for (const ing of outgoingRecipe.ingredients) set.add(lower(ing.name));
  for (const side of outgoingSides) for (const ing of side.ingredients) set.add(lower(ing.name));
  return set;
}

/** Which of a recipe's own non-staple ingredients aren't in `available`. */
export function missingIngredients(recipe: Recipe, available: Set<string>): string[] {
  return recipe.ingredients
    .filter((ing) => !ing.pantryStaple && !loosely(ing.name, available))
    .map((ing) => ing.name);
}

/** Union of missing ingredients across a whole plate — main + its composed
 * sides (M4.2 part 2) — deduped. Strict re-roll evaluates the plate as a
 * whole, not just the main: a candidate whose composed sides need something
 * not on hand is no more offerable than a main that does. */
export function missingIngredientsForPlate(main: Recipe, sides: Recipe[], available: Set<string>): string[] {
  const names = new Set<string>();
  for (const name of missingIngredients(main, available)) names.add(name);
  for (const side of sides) for (const name of missingIngredients(side, available)) names.add(name);
  return Array.from(names);
}

/** A candidate main plus the sides `composeSides` picked for it — carried
 * together so a commit (`rerollMeal`) attaches EXACTLY the plate that was
 * evaluated as coverable, never recomputes sides after the fact (which
 * could silently pick something not actually on hand). */
export interface RerollCandidate {
  recipe: Recipe;
  sideRecipeIds: string[];
}

export interface RerollNearMiss extends RerollCandidate {
  missing: string[]; // 1-2 ingredient names, across the whole plate
}

export interface RerollOutcome {
  /** Fully coverable candidates, ranked best-first (top 5). Empty if none qualify. */
  candidates: RerollCandidate[];
  /** Up to 3 near-misses (each missing 1-2 ingredients across the whole plate), only populated when `candidates` is empty. */
  nearMisses: RerollNearMiss[];
}

/**
 * Pure candidate selection for a mid-week re-roll. STRICT mode (✅ decided):
 * only PLATES — main + composed sides (M4.2 part 2) — fully coverable by
 * `available` qualify, evaluated as a whole; a re-roll must never imply a
 * new store trip, for the main or for whatever sides get composed onto it.
 * Excludes mains already used elsewhere in the week and anything failing the
 * existing hard filters (allergies, diet, time limits, dislikes) or blocked
 * by learning. Ranked with the same scoring function used elsewhere,
 * against the rest of the week's picks, so variety/preference still apply;
 * ties break by stable-sort array order (deterministic — not
 * shuffled/randomized). `recipes` is the FULL pool (mains + sides +
 * imported), split once here via `isMain()`.
 */
export function rerollCandidates(
  plan: WeeklyPlan,
  dayIndex: number,
  recipes: Recipe[],
  getRecipe: (id: string) => Recipe | undefined,
  available: Set<string>,
  ctx: GenerateContext,
): RerollOutcome {
  const outgoingMeal = plan.meals.find((m) => m.dayIndex === dayIndex);
  if (!outgoingMeal || outgoingMeal.cooked) return { candidates: [], nearMisses: [] };

  // Exclude every recipe already in this week's plan, including the
  // outgoing one itself — offering to "swap" a meal for itself isn't a
  // re-roll. Its ingredients still feed `available` (passed in by the
  // caller), which is the point: overlap with it makes real alternatives
  // easier to find.
  const usedIds = new Set(plan.meals.map((m) => m.recipeId));
  const selectedRecipes = plan.meals
    .filter((m) => m.dayIndex !== dayIndex)
    .map((m) => getRecipe(m.recipeId))
    .filter((r): r is Recipe => !!r);

  const mains = recipes.filter(isMain);
  const sidesPool = recipes.filter((r) => !isMain(r));
  const sidesById = new Map(sidesPool.map((s) => [s.id, s]));

  const blocked = new Set(ctx.preferences?.blockedRecipeIds ?? []);
  const pool = mains.filter(
    (r) => !usedIds.has(r.id) && !blocked.has(r.id) && passesHardFilters(r, ctx.intake, ctx.profile),
  );

  const coverable: RerollCandidate[] = [];
  const shortfalls: RerollNearMiss[] = [];
  for (const r of pool) {
    // M4.3: score this candidate's sides for waste-fit against the rest of
    // the week's already-fixed mains (`selectedRecipes` — everything except
    // the outgoing day being re-rolled).
    const sideRecipeIds = composeSides(r, sidesPool, { ...ctx, weekRecipes: selectedRecipes });
    const sides = sideRecipeIds.map((id) => sidesById.get(id)).filter((s): s is Recipe => !!s);
    const missing = missingIngredientsForPlate(r, sides, available);
    if (missing.length === 0) coverable.push({ recipe: r, sideRecipeIds });
    else if (missing.length <= 2) shortfalls.push({ recipe: r, sideRecipeIds, missing });
  }

  if (coverable.length > 0) {
    const ranked = [...coverable].sort(
      (a, b) => scoreRecipe(b.recipe, ctx, selectedRecipes) - scoreRecipe(a.recipe, ctx, selectedRecipes),
    );
    return { candidates: ranked.slice(0, 5), nearMisses: [] };
  }

  const nearMisses = shortfalls
    .sort(
      (a, b) =>
        a.missing.length - b.missing.length ||
        scoreRecipe(b.recipe, ctx, selectedRecipes) - scoreRecipe(a.recipe, ctx, selectedRecipes),
    )
    .slice(0, 3);

  return { candidates: [], nearMisses };
}

/**
 * M3.1: which day indices in `plan` are valid pin-to-week targets for
 * `recipeId` — today-or-future, not-yet-cooked days (the same rule reroll's
 * "↻ Re-roll" link already uses on This Week), and only if the recipe isn't
 * already sitting on some OTHER day of the same week (mirrors reroll's
 * duplicate exclusion — a recipe can't occupy two days at once). An empty
 * result means "can't be pinned right now" (already in the plan, or every
 * remaining day is cooked) and the caller should show why rather than a
 * silently-empty day picker.
 */
export function pinnableDays(plan: WeeklyPlan, recipeId: string, today: Date = new Date()): number[] {
  if (plan.meals.some((m) => m.recipeId === recipeId)) return [];
  const todayIndex = todayOffset(plan.weekStartISO, today);
  return plan.meals.filter((m) => m.dayIndex >= todayIndex && !m.cooked).map((m) => m.dayIndex);
}
