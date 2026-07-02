import { Recipe } from '@/domain/models';

import { passesHardFilters } from './filters';
import { scoreRecipe } from './scoring';
import { GenerateContext } from './types';

const lower = (s: string) => s.trim().toLowerCase();

function matches(ingredientName: string, target: string): boolean {
  const n = lower(ingredientName);
  const t = lower(target);
  return n.includes(t) || t.includes(n);
}

/** Which of `targets` this recipe would actually use (loose name match). */
export function ingredientsUsed(recipe: Recipe, targets: string[]): string[] {
  return targets.filter((t) => recipe.ingredients.some((i) => matches(i.name, t)));
}

/** Fraction (0–1) of `targets` this recipe uses. */
export function ingredientUseScore(recipe: Recipe, targets: string[]): number {
  if (targets.length === 0) return 0;
  return ingredientsUsed(recipe, targets).length / targets.length;
}

export interface RerollOptions {
  /** Recipes that can't be offered (already in the plan, already declined). */
  excludeIds: string[];
  /** Ingredients the user wants to use up — weighted heavily. */
  useUpIngredients: string[];
  /** Ingredients already on the week's shopping list — bonus for reusing them. */
  weekIngredients: string[];
}

/** Extra weights on top of the base week score, tunable alongside WEIGHTS. */
export const REROLL_WEIGHTS = {
  useUp: 4.0, // explicit "use these up" request dominates
  weekOverlap: 1.2, // prefer dinners that need little or no extra shopping
} as const;

/**
 * Rank replacements for one meal in a finalized week, best first. The base week
 * scoring still applies (variety vs. the meals that stay, learned preferences,
 * budget, time…), with strong extra weight on "use these up" ingredients and a
 * smaller bonus for reusing what's already on the shopping list.
 */
export function rankRerollCandidates(
  recipes: Recipe[],
  ctx: GenerateContext,
  keptMeals: Recipe[],
  opts: RerollOptions,
): Recipe[] {
  const blocked = new Set(ctx.preferences?.blockedRecipeIds ?? []);
  const excluded = new Set(opts.excludeIds);
  const pool = recipes.filter(
    (r) => !excluded.has(r.id) && !blocked.has(r.id) && passesHardFilters(r, ctx.intake, ctx.profile),
  );
  return pool
    .map((recipe) => ({
      recipe,
      score:
        scoreRecipe(recipe, ctx, keptMeals) +
        REROLL_WEIGHTS.useUp * ingredientUseScore(recipe, opts.useUpIngredients) +
        REROLL_WEIGHTS.weekOverlap * ingredientUseScore(recipe, opts.weekIngredients),
    }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.recipe);
}
