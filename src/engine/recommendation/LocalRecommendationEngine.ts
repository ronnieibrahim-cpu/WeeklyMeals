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
 * On-device, deterministic-ish greedy engine: filter to a valid pool, then
 * repeatedly pick the highest-scoring recipe given what's already chosen, so
 * variety/rotation update as the week fills in. Locked recipes are kept up front.
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

    while (selected.length < target) {
      let best: Recipe | null = null;
      let bestScore = -Infinity;
      for (const r of candidates) {
        if (selected.includes(r)) continue;
        const score = scoreRecipe(r, ctx, selected);
        if (score > bestScore) {
          bestScore = score;
          best = r;
        }
      }
      if (!best) break;
      selected.push(best);
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
