import { Recipe, ShoppingList, WeeklyPlan } from '@/domain/models';

import { passesHardFilters, scoreRecipe } from './recommendation';
import { GenerateContext } from './recommendation/types';

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
 * shopping list (assume purchased) + the outgoing meal's own ingredients (so
 * a recipe can always re-qualify as its own replacement). Recipe-flagged
 * pantry staples (salt/oil/etc.) aren't included here — they're treated as
 * always on hand, checked separately in `missingIngredients`, same as
 * `buildShoppingList` already excludes them from the list entirely.
 */
export function availableIngredients(
  pantry: string[],
  shoppingList: ShoppingList | null,
  outgoingRecipe: Recipe | undefined,
): Set<string> {
  const set = new Set<string>();
  for (const p of pantry) set.add(lower(p));
  if (shoppingList) for (const item of shoppingList.items) set.add(lower(item.ingredientName));
  if (outgoingRecipe) for (const ing of outgoingRecipe.ingredients) set.add(lower(ing.name));
  return set;
}

/** Which of a recipe's own non-staple ingredients aren't in `available`. */
export function missingIngredients(recipe: Recipe, available: Set<string>): string[] {
  return recipe.ingredients
    .filter((ing) => !ing.pantryStaple && !loosely(ing.name, available))
    .map((ing) => ing.name);
}

export interface RerollNearMiss {
  recipe: Recipe;
  missing: string[]; // 1-2 ingredient names
}

export interface RerollOutcome {
  /** Fully coverable candidates, ranked best-first (top 5). Empty if none qualify. */
  candidates: Recipe[];
  /** Up to 3 near-misses (each missing 1-2 ingredients), only populated when `candidates` is empty. */
  nearMisses: RerollNearMiss[];
}

/**
 * Pure candidate selection for a mid-week re-roll. STRICT mode (✅ decided):
 * only recipes fully coverable by `available` qualify — a re-roll must never
 * imply a new store trip. Excludes recipes already used elsewhere in the
 * week and anything failing the existing hard filters (allergies, diet,
 * time limits, dislikes) or blocked by learning. Ranked with the same
 * scoring function used elsewhere, against the rest of the week's picks, so
 * variety/preference still apply; ties break by stable-sort array order
 * (deterministic — not shuffled/randomized).
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

  const blocked = new Set(ctx.preferences?.blockedRecipeIds ?? []);
  const pool = recipes.filter(
    (r) => !usedIds.has(r.id) && !blocked.has(r.id) && passesHardFilters(r, ctx.intake, ctx.profile),
  );

  const coverable: Recipe[] = [];
  const shortfalls: RerollNearMiss[] = [];
  for (const r of pool) {
    const missing = missingIngredients(r, available);
    if (missing.length === 0) coverable.push(r);
    else if (missing.length <= 2) shortfalls.push({ recipe: r, missing });
  }

  if (coverable.length > 0) {
    const ranked = [...coverable].sort(
      (a, b) => scoreRecipe(b, ctx, selectedRecipes) - scoreRecipe(a, ctx, selectedRecipes),
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
