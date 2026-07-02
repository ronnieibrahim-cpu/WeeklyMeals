import { PlannedMeal, Recipe } from '@/domain/models';

import { passesHardFilters } from './filters';
import { scoreRecipe } from './scoring';
import { GenerateContext, RecommendationProvider } from './types';

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Weighted pick among the K strongest candidates (higher score → more likely).
 * A strict argmax would crown the same handful of recipes forever — small
 * systematic edges (a summer tag, a slightly cheaper cost hint) lock everything
 * else out of the week. Sampling near the top keeps quality while letting the
 * whole library rotate through over time.
 */
export function sampleTopScored(
  scored: { recipe: Recipe; score: number }[],
  k: number,
): Recipe | null {
  if (scored.length === 0) return null;
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, Math.max(1, k));
  const min = top[top.length - 1].score;
  const weights = top.map((t) => t.score - min + 0.1);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i].recipe;
  }
  return top[top.length - 1].recipe;
}

/**
 * On-device engine: filter to a valid pool, then repeatedly pick a strong
 * recipe given what's already chosen, so variety/rotation update as the week
 * fills in. Picks sample among the top K (K grows with the week's
 * adventurousness answer) rather than always taking #1. Locked recipes are
 * kept up front.
 */
export class LocalRecommendationEngine implements RecommendationProvider {
  generate(ctx: GenerateContext, recipes: Recipe[]): PlannedMeal[] {
    const blocked = new Set(ctx.preferences?.blockedRecipeIds ?? []);
    const lockedIds = new Set(ctx.lockedRecipeIds ?? []);

    const pool = recipes.filter(
      (r) => !blocked.has(r.id) && passesHardFilters(r, ctx.intake, ctx.profile),
    );

    const selected: Recipe[] = [];

    // Keep locked recipes first.
    for (const r of recipes) {
      if (lockedIds.has(r.id) && !selected.includes(r)) selected.push(r);
    }

    const target = Math.min(ctx.intake.dinners, Math.max(pool.length, selected.length));
    // Shuffle so score ties break differently each run (enables "regenerate").
    const candidates = shuffle(pool);
    // Safe picks at 0 (top 4), a wide net at 1 (top 12).
    const k = 4 + Math.round((ctx.intake.adventurousness ?? 0.5) * 8);

    while (selected.length < target) {
      const remaining = candidates
        .filter((r) => !selected.includes(r))
        .map((recipe) => ({ recipe, score: scoreRecipe(recipe, ctx, selected) }));
      const pick = sampleTopScored(remaining, k);
      if (!pick) break;
      selected.push(pick);
    }

    return selected.slice(0, ctx.intake.dinners).map((r, index) => ({
      recipeId: r.id,
      servings: ctx.intake.people,
      dayIndex: index,
      locked: lockedIds.has(r.id),
    }));
  }
}

export const localRecommendationEngine = new LocalRecommendationEngine();
