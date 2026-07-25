import { isMain, PlannedMeal, Recipe } from '@/domain/models';

import { composeSides } from '../mealComposition';
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
 * How close two recipes' scores have to be to count as "basically the same
 * pick" rather than one strictly beating the other. `scoreRecipe` blends
 * ~14 continuous-valued factors into one number, so two different recipes
 * essentially never land on the exact same score — without this band,
 * picking the single highest scorer every time means a fresh profile (or
 * one with only a couple of preferences set, e.g. just budget + prep time)
 * deterministically produces the identical "best" week on every generate,
 * and "regenerate" silently does nothing, since there's nothing for a
 * plain tie-break to ever actually catch. `MIN_NEAR_TIE_BAND` is a floor so
 * the band doesn't collapse to nothing if the top score is ever near zero.
 */
const NEAR_TIE_FRACTION = 0.02;
const MIN_NEAR_TIE_BAND = 0.05;

/** Pick uniformly at random among whichever recipes are within the near-tie
 * band of the best score — a clear best pick still reliably wins (nothing
 * else is close enough to be "in the running"), but when several recipes
 * are basically equally good fits, which one you get is genuinely random
 * from one generate/regenerate to the next. */
function pickNearBest(scored: { r: Recipe; score: number }[]): Recipe {
  const maxScore = Math.max(...scored.map((s) => s.score));
  const band = Math.max(Math.abs(maxScore) * NEAR_TIE_FRACTION, MIN_NEAR_TIE_BAND);
  const contenders = scored.filter((s) => s.score >= maxScore - band);
  return contenders[Math.floor(Math.random() * contenders.length)].r;
}

/**
 * On-device, deterministic-ish greedy engine: filter to a valid pool, then
 * repeatedly pick among the highest-scoring recipes given what's already
 * chosen (see `pickNearBest`), so variety/rotation update as the week fills
 * in. Locked recipes are kept up front.
 *
 * `recipes` is the FULL pool (mains, sides, imported — `RECIPES` now
 * contains all of it, M4.2 part 2). Mains and sides are split once here via
 * `isMain()`, never assumed by the caller: every candidate this picks as a
 * day's dish is a main, and a side is composed for it (`composeSides`) from
 * the same pool's non-main entries. This is also what protects every other
 * caller of `generate()` (planStore, checkKidApprovedWeighting.ts,
 * checkCuratedWeighting.ts) — none of them need their own main/side filter.
 */
export class LocalRecommendationEngine implements RecommendationProvider {
  generate(ctx: GenerateContext, recipes: Recipe[]): PlannedMeal[] {
    const blocked = new Set(ctx.preferences?.blockedRecipeIds ?? []);
    const lockedIds = new Set(ctx.lockedRecipeIds ?? []);
    const mains = recipes.filter(isMain);
    const sidesPool = recipes.filter((r) => !isMain(r));

    const basePool = mains.filter(
      (r) => !blocked.has(r.id) && passesHardFilters(r, ctx.intake, ctx.profile),
    );

    const selected: Recipe[] = [];

    // Keep locked recipes first.
    for (const r of mains) {
      if (lockedIds.has(r.id) && !selected.includes(r)) selected.push(r);
    }

    // `avoidRecipeIds` (regenerate): drop the outgoing picks so the re-pick
    // is genuinely different, but only while enough candidates remain to
    // still fill the week — a preference, never a filter (see types.ts). The
    // comparison is against the number of slots left to fill, so a locked
    // week needs correspondingly fewer spare candidates.
    const avoid = new Set(ctx.avoidRecipeIds ?? []);
    const slotsToFill = Math.max(0, ctx.intake.dinners - selected.length);
    const trimmedPool = avoid.size > 0 ? basePool.filter((r) => !avoid.has(r.id)) : basePool;
    const pool = trimmedPool.length >= slotsToFill ? trimmedPool : basePool;

    const target = Math.min(ctx.intake.dinners, Math.max(pool.length, selected.length));

    while (selected.length < target) {
      const remaining = pool.filter((r) => !selected.includes(r));
      if (remaining.length === 0) break;
      const scored = remaining.map((r) => ({ r, score: scoreRecipe(r, ctx, selected) }));
      selected.push(pickNearBest(scored));
    }

    return selected.slice(0, ctx.intake.dinners).map((r, index) => ({
      recipeId: r.id,
      servings: ctx.intake.servingsPerMeal,
      dayIndex: index,
      locked: lockedIds.has(r.id),
      // M4.3: the whole week's mains are the waste-fit comparison pool for
      // each plate's sides — a side that mops up a half-unit any other main
      // this week already forces buying scores a small bonus. `selected`
      // already contains `r` itself at this point (it was pushed above, and
      // this `.map` runs over that same array) — exclude it here so
      // `scoreSide`'s own `[main, ...weekRecipes]` prepend (mealComposition
      // -> scoring.ts scoreSide) doesn't count `r`'s ingredients twice
      // (F7: a lone 0.5-unit ingredient would otherwise self-sum to 1.0,
      // reading as "no leftover" and zeroing the exact bonus this is for).
      sideRecipeIds: composeSides(r, sidesPool, {
        ...ctx,
        weekRecipes: selected.filter((s) => s.id !== r.id),
      }),
    }));
  }
}

export const localRecommendationEngine = new LocalRecommendationEngine();

/**
 * Rank candidates for a one-off replacement (e.g. swapping a single meal)
 * and return the top `count` — but prefer at most one pick per cuisine
 * first, backfilling with the next-best remaining candidates only if there
 * aren't enough distinct cuisines to fill every slot. Without this, "3
 * alternatives" can otherwise mean 3 near-identical dishes whenever one
 * cuisine's pool happens to dominate the raw score (e.g. `American`, the
 * single largest cuisine in the library) — showing a choice that isn't
 * actually a choice. Shuffled once so repeated swaps of the same day can
 * land on different tie-breaks, same as `generate()`.
 */
export function rankReplacements(
  candidates: Recipe[],
  ctx: GenerateContext,
  selected: Recipe[],
  count: number,
): Recipe[] {
  const scored = shuffle(candidates)
    .map((r) => ({ r, score: scoreRecipe(r, ctx, selected) }))
    .sort((a, b) => b.score - a.score);

  const picks: Recipe[] = [];
  const usedCuisines = new Set<Recipe['cuisine']>();
  for (const { r } of scored) {
    if (picks.length >= count) break;
    if (usedCuisines.has(r.cuisine)) continue;
    picks.push(r);
    usedCuisines.add(r.cuisine);
  }
  if (picks.length < count) {
    const pickedIds = new Set(picks.map((r) => r.id));
    for (const { r } of scored) {
      if (picks.length >= count) break;
      if (pickedIds.has(r.id)) continue;
      picks.push(r);
      pickedIds.add(r.id);
    }
  }
  return picks;
}
