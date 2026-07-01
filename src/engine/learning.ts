import { PreferenceProfile, RatingEvent, Recipe } from '@/domain/models';

const clamp = (n: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, n));

export function createDefaultPreferences(): PreferenceProfile {
  return {
    cuisineAffinity: {},
    proteinAffinity: {},
    vegetableAffinity: {},
    techniqueAffinity: {},
    spiceTolerance: 0, // + likes heat, - prefers mild
    complexityPreference: 0, // + fine with effort, - prefers easy
    budgetSensitivity: 0, // + wants cheaper
    leftoverTolerance: 0, // + likes leftovers, - dislikes
    mealsRated: 0,
    avgEnjoyment: 0,
    blockedRecipeIds: [],
  };
}

/** -1…+1 sentiment for one cooked-and-rated meal. */
function sentiment(event: RatingEvent): number {
  let s = 0;
  if (typeof event.enjoyment === 'number') s += (event.enjoyment - 3) / 2; // -1…+1
  if (event.cookAgain === true) s += 0.3;
  if (event.cookAgain === false) s -= 0.4;
  if (event.familyAgain === true) s += 0.2;
  if (event.familyAgain === false) s -= 0.3;
  return clamp(s);
}

/**
 * Fold a batch of weekly-review ratings into the preference profile. Pure: returns
 * a new profile. Liked attributes drift up, disliked drift down, and "off" flags
 * nudge spice/complexity/budget/leftover dials. Repeated strong dislikes block a recipe.
 */
export function applyRatings(
  prev: PreferenceProfile,
  events: RatingEvent[],
  recipesById: Record<string, Recipe>,
): PreferenceProfile {
  const next: PreferenceProfile = {
    ...prev,
    cuisineAffinity: { ...prev.cuisineAffinity },
    proteinAffinity: { ...prev.proteinAffinity },
    vegetableAffinity: { ...prev.vegetableAffinity },
    techniqueAffinity: { ...prev.techniqueAffinity },
    blockedRecipeIds: [...prev.blockedRecipeIds],
  };

  let ratedCount = 0;
  let enjoymentSum = 0;

  for (const event of events) {
    if (!event.cooked) continue;
    const recipe = recipesById[event.recipeId];
    if (!recipe) continue;

    const s = sentiment(event);
    ratedCount += 1;
    if (typeof event.enjoyment === 'number') enjoymentSum += event.enjoyment;

    next.cuisineAffinity[recipe.cuisine] = clamp((next.cuisineAffinity[recipe.cuisine] ?? 0) + 0.35 * s);
    next.proteinAffinity[recipe.primaryProtein] = clamp(
      (next.proteinAffinity[recipe.primaryProtein] ?? 0) + 0.3 * s,
    );
    for (const t of recipe.techniques) {
      next.techniqueAffinity[t] = clamp((next.techniqueAffinity[t] ?? 0) + 0.2 * s);
    }
    for (const v of recipe.vegetables) {
      next.vegetableAffinity[v] = clamp((next.vegetableAffinity[v] ?? 0) + 0.15 * s);
    }

    if (event.tooSpicy) next.spiceTolerance = clamp(next.spiceTolerance - 0.25);
    if (event.tooBland) next.spiceTolerance = clamp(next.spiceTolerance + 0.15);
    if (event.tooMuchPrep) next.complexityPreference = clamp(next.complexityPreference - 0.25);
    if (event.tooExpensive) next.budgetSensitivity = clamp(next.budgetSensitivity + 0.25);
    if (event.tooManyLeftovers) next.leftoverTolerance = clamp(next.leftoverTolerance - 0.25);

    const stronglyDisliked =
      event.enjoyment === 1 || (typeof event.enjoyment === 'number' && event.enjoyment <= 2 && event.cookAgain === false);
    if (stronglyDisliked && !next.blockedRecipeIds.includes(recipe.id)) {
      next.blockedRecipeIds.push(recipe.id);
    }
  }

  if (ratedCount > 0) {
    const totalRated = next.mealsRated + ratedCount;
    const prevEnjoymentTotal = next.avgEnjoyment * next.mealsRated;
    next.mealsRated = totalRated;
    next.avgEnjoyment = (prevEnjoymentTotal + enjoymentSum) / totalRated;
  }

  return next;
}
