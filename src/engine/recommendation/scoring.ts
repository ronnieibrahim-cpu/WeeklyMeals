import { Recipe } from '@/domain/models';

import { roughCostPerServing } from '../cost';
import {
  favoriteCrowdingFactor,
  favoriteRestFactor,
  learningConfidence,
  repeatPenaltyFactor,
} from '../rotation';
import { wasteFitBonus } from '../wasteFit';
import { GenerateContext, WEIGHTS } from './types';

/** Widened (plain-`number`) shape of `WEIGHTS` — `WEIGHTS` itself is
 * declared `as const` for self-documenting literal defaults, but an
 * override (`ctx.weightOverrides`) needs to be able to set any number. */
type Weights = Record<keyof typeof WEIGHTS, number>;

/** `WEIGHTS` with any test/harness-only per-call overrides applied
 * (`ctx.weightOverrides` — see GenerateContext, never set by app code). */
function weightsFor(ctx: GenerateContext): Weights {
  return ctx.weightOverrides ? { ...WEIGHTS, ...ctx.weightOverrides } : WEIGHTS;
}

const lower = (s: string) => s.trim().toLowerCase();

/** Fraction (0–1) of a recipe's non-staple ingredients the user already has. */
function pantryOverlap(recipe: Recipe, pantry: string[]): number {
  if (pantry.length === 0) return 0;
  const have = pantry.map(lower);
  const usable = recipe.ingredients.filter((i) => !i.pantryStaple);
  if (usable.length === 0) return 0;
  const matches = usable.filter((i) =>
    have.some((h) => lower(i.name).includes(h) || h.includes(lower(i.name))),
  );
  return matches.length / usable.length;
}

function preferenceMatch(recipe: Recipe, ctx: GenerateContext): number {
  let score = 0.5;
  if (ctx.profile.favoriteCuisines.includes(recipe.cuisine)) score += 0.25;
  if (ctx.intake.cuisines.length > 0 && ctx.intake.cuisines.includes(recipe.cuisine)) score += 0.2;
  if (ctx.profile.preferredProteins.includes(recipe.primaryProtein)) score += 0.15;
  // This week's craving (from the questionnaire) gets a stronger, timely boost.
  const weekProteins = ctx.intake.proteins ?? [];
  if (weekProteins.length > 0 && weekProteins.includes(recipe.primaryProtein)) {
    score += 0.3;
  }
  return Math.min(1, score);
}

/** Reward new cuisines/proteins/techniques relative to what's already picked. */
function varietyBonus(recipe: Recipe, selected: Recipe[]): number {
  if (selected.length === 0) return 1;
  const cuisines = selected.map((r) => r.cuisine);
  const proteins = selected.map((r) => r.primaryProtein);
  let score = 1;
  const cuisineCount = cuisines.filter((c) => c === recipe.cuisine).length;
  const proteinCount = proteins.filter((p) => p === recipe.primaryProtein).length;
  score -= cuisineCount * 0.4;
  score -= proteinCount * 0.3;
  return Math.max(0, score);
}

function budgetFit(recipe: Recipe, ctx: GenerateContext): number {
  const perMealBudget = ctx.intake.budget / Math.max(1, ctx.intake.dinners) / Math.max(1, ctx.intake.servingsPerMeal);
  const cost = roughCostPerServing(recipe);
  if (cost <= perMealBudget) return 1;
  // Soft falloff once over budget.
  return Math.max(0, 1 - (cost - perMealBudget) / Math.max(1, perMealBudget));
}

function timeFit(recipe: Recipe, ctx: GenerateContext): number {
  const total = recipe.prepMinutes + recipe.cookMinutes;
  const limit = ctx.intake.maxPrepMinutes + ctx.intake.maxCookMinutes;
  if (limit <= 0) return 0.5;
  return Math.max(0, Math.min(1, 1 - total / (limit * 1.5)));
}

function nutritionFit(recipe: Recipe, ctx: GenerateContext): number {
  let score = 0.5;
  const priorities = ctx.profile.nutritionPriorities.map(lower);
  if (priorities.includes('highprotein') && recipe.nutrition.protein >= 35) score += 0.3;
  if (priorities.includes('lowcarb') && recipe.nutrition.carbs <= 30) score += 0.3;
  const target = ctx.profile.targetCaloriesPerMeal;
  if (target) {
    const diff = Math.abs(recipe.nutrition.calories - target);
    score += Math.max(0, 0.2 - diff / 2000);
  }
  return Math.min(1, score);
}

/** Map intake.healthyVsComfort (0 healthy … 1 comfort) onto the recipe's style. */
function healthyComfortFit(recipe: Recipe, ctx: GenerateContext): number {
  const wantsComfort = ctx.intake.healthyVsComfort;
  const isHealthy = recipe.categories.some((c) => c === 'Healthy' || c === 'LowCarb' || c === 'Salads');
  const isComfort = recipe.categories.some((c) => c === 'ComfortFood' || c === 'Pasta' || c === 'Stews');
  if (isHealthy && !isComfort) return 1 - wantsComfort;
  if (isComfort && !isHealthy) return wantsComfort;
  return 0.5;
}

function adventurousFit(recipe: Recipe, ctx: GenerateContext): number {
  const familiar: Recipe['cuisine'][] = ['American', 'Italian', 'Mexican'];
  const isFamiliar = familiar.includes(recipe.cuisine);
  // Low adventurousness favors familiar; high favors the rest.
  return isFamiliar ? 1 - ctx.intake.adventurousness : ctx.intake.adventurousness;
}

function seasonFit(recipe: Recipe, ctx: GenerateContext): number {
  if (recipe.seasons.length === 0) return 0.6; // all-year
  return recipe.seasons.includes(ctx.season) ? 1 : 0.2;
}

/** Learned positive likes (0–1): favored cuisine/protein/technique drift the
 * score up — damped by how much the household has actually rated, so one
 * week of data can't steer the whole next week (see `learningConfidence`). */
function affinityBonus(recipe: Recipe, ctx: GenerateContext): number {
  const prefs = ctx.preferences;
  if (!prefs) return 0;
  const parts: number[] = [];
  parts.push(Math.max(0, prefs.cuisineAffinity[recipe.cuisine] ?? 0));
  parts.push(Math.max(0, prefs.proteinAffinity[recipe.primaryProtein] ?? 0));
  let techMax = 0;
  for (const t of recipe.techniques) techMax = Math.max(techMax, Math.max(0, prefs.techniqueAffinity[t] ?? 0));
  parts.push(techMax);
  const raw = parts.reduce((a, b) => a + b, 0) / parts.length;
  return raw * learningConfidence(prefs.mealsRated);
}

/**
 * Favorites, as an actual *periodic* reintroduction rather than the flat
 * permanent +1 this used to be. Two independent dampers, both 0–1:
 *
 * - **rest** (`favoriteRestFactor`): a favorite that was on the menu last
 *   week earns almost none of the bonus; one that hasn't appeared for
 *   `FAVORITE_REST_WEEKS` earns all of it. This is what stops three hearted
 *   dishes from reappearing every single week.
 * - **crowding** (`favoriteCrowdingFactor`): the bonus tapers as favorites
 *   accumulate in the week being built, so a long list of well-rested
 *   favorites yields a couple of re-runs, not a menu of them.
 *
 * `alreadyChosen` is the week-so-far — `selected` for a main, the plate plus
 * the rest of the week for a side. Neither damper can ever push the bonus
 * negative or above 1, so `WEIGHTS.favorite` remains the hard ceiling on
 * this factor's contribution.
 */
function favoriteBonus(recipe: Recipe, ctx: GenerateContext, alreadyChosen: Recipe[]): number {
  const favorites = ctx.favoriteRecipeIds;
  if (!favorites?.includes(recipe.id)) return 0;
  const rest = favoriteRestFactor(ctx.recencyByRecipeId?.[recipe.id]);
  const favoritesSoFar = alreadyChosen.filter((r) => favorites.includes(r.id)).length;
  return rest * favoriteCrowdingFactor(favoritesSoFar);
}

/**
 * Cross-week repeat discouragement (0–1, subtracted): a main that was on a
 * recent plan is steered away from, fading to nothing after
 * `REPEAT_FADE_WEEKS`. Soft by design — a repeat that's still the best
 * pantry match can and should win anyway; the point is that the engine stops
 * reproducing near-identical weeks (AUDIT.md B7/P1.2). Sides have no entry in
 * the recency map, so this is a no-op for them (see rotation.ts on why that's
 * deliberate).
 */
function repeatPenalty(recipe: Recipe, ctx: GenerateContext): number {
  return repeatPenaltyFactor(ctx.recencyByRecipeId?.[recipe.id]);
}

/** M2.4: flat bonus for hand-curated recipes (id not prefixed `mealdb-`). */
function curatedBonus(recipe: Recipe): number {
  return recipe.id.startsWith('mealdb-') ? 0 : 1;
}

/** M3.2: flat bonus for recipes the family has marked "Kids approved". */
function kidApprovedBonus(recipe: Recipe, ctx: GenerateContext): number {
  return ctx.kidApprovedRecipeIds?.includes(recipe.id) ? 1 : 0;
}

const clampSigned = (n: number) => Math.max(-1, Math.min(1, n));

const SPICE_NUMERIC: Record<Recipe['spiceLevel'], number> = {
  None: -1,
  Mild: -0.33,
  Medium: 0.33,
  Hot: 1,
};

const DIFFICULTY_NUMERIC: Record<Recipe['difficulty'], number> = {
  Easy: -1,
  Medium: 0,
  Hard: 1,
};

/**
 * M2.6: learned spice/complexity/budget/leftover/vegetable dials from ratings.
 * Each part is a signed -1…1 nudge (0 for a dial that hasn't drifted from
 * neutral); averaged together so no single learned dial can dominate the
 * explicit profile/questionnaire factors above. Hard filters run before
 * scoring ever sees a recipe, so this never overrides an allergy or other
 * profile hard-filter — it only reorders what's already allowed.
 */
function learnedDialsFit(recipe: Recipe, ctx: GenerateContext): number {
  const prefs = ctx.preferences;
  if (!prefs) return 0;

  const parts: number[] = [];
  parts.push(prefs.spiceTolerance * SPICE_NUMERIC[recipe.spiceLevel]);
  parts.push(prefs.complexityPreference * DIFFICULTY_NUMERIC[recipe.difficulty]);

  const perMealBudget = ctx.intake.budget / Math.max(1, ctx.intake.dinners) / Math.max(1, ctx.intake.servingsPerMeal);
  if (perMealBudget > 0) {
    const cheapness = clampSigned((perMealBudget - roughCostPerServing(recipe)) / perMealBudget);
    parts.push(prefs.budgetSensitivity * cheapness);
  }

  parts.push(prefs.leftoverTolerance * (recipe.makesLeftovers ? 1 : -1));

  if (recipe.vegetables.length > 0) {
    const vegScores = recipe.vegetables.map((v) => prefs.vegetableAffinity[v] ?? 0);
    parts.push(vegScores.reduce((a, b) => a + b, 0) / vegScores.length);
  }

  // Damped by rating volume for the same reason as `affinityBonus`: these
  // dials move off a handful of checkboxes, and a first week's worth of them
  // shouldn't carry the authority of a season's worth.
  const raw = clampSigned(parts.reduce((a, b) => a + b, 0) / parts.length);
  return raw * learningConfidence(prefs.mealsRated);
}

function ratingsPenalty(recipe: Recipe, ctx: GenerateContext): number {
  const prefs = ctx.preferences;
  if (!prefs) return 0;
  let penalty = 0;
  const cuisineAff = prefs.cuisineAffinity[recipe.cuisine] ?? 0;
  const proteinAff = prefs.proteinAffinity[recipe.primaryProtein] ?? 0;
  if (cuisineAff < 0) penalty += -cuisineAff;
  if (proteinAff < 0) penalty += -proteinAff;
  return Math.min(1, penalty);
}

/** Weighted, explainable score. Higher is better. */
export function scoreRecipe(recipe: Recipe, ctx: GenerateContext, selected: Recipe[]): number {
  const w = weightsFor(ctx);
  return (
    w.pantry * pantryOverlap(recipe, ctx.pantry) +
    w.preference * preferenceMatch(recipe, ctx) +
    w.affinity * affinityBonus(recipe, ctx) +
    w.favorite * favoriteBonus(recipe, ctx, selected) +
    w.curated * curatedBonus(recipe) +
    w.kidApproved * kidApprovedBonus(recipe, ctx) +
    w.learnedDials * learnedDialsFit(recipe, ctx) +
    w.variety * varietyBonus(recipe, selected) +
    w.budget * budgetFit(recipe, ctx) +
    w.time * timeFit(recipe, ctx) +
    w.nutrition * nutritionFit(recipe, ctx) +
    w.healthyComfort * healthyComfortFit(recipe, ctx) +
    w.adventurous * adventurousFit(recipe, ctx) +
    w.season * seasonFit(recipe, ctx) +
    w.wasteFit * wasteFitBonus(recipe, ctx.weekRecipes ?? selected) -
    w.ratingsPenalty * ratingsPenalty(recipe, ctx) -
    w.repeat * repeatPenalty(recipe, ctx)
  );
}

function cuisineFitBonus(recipe: Recipe, main: Recipe): number {
  return recipe.cuisine === main.cuisine ? 1 : 0;
}

/**
 * Score a SIDE candidate for a given plate (M4.2 part 2). Reuses every
 * `scoreRecipe` signal except `varietyBonus` — that function's cuisine/
 * protein-repeat penalty is calibrated for "don't pick the same cuisine
 * twice across a week of mains," which is the wrong comparison at plate
 * scope: it would penalize a side for fitting the main's cuisine (the
 * opposite of MILESTONE-4.md Rule 3) and penalize a second vegetable side
 * for sharing `primaryProtein: 'None'` with the first, biasing every plate
 * toward a single side. In its place: a small, deliberately modest
 * `cuisineFitBonus` against the main's cuisine specifically (never strong
 * enough to bury a better-scoring cross-cuisine candidate).
 *
 * `budgetFit`/`timeFit`/`nutritionFit` still score the side's own
 * cost/time/nutrition against the FULL per-meal target, not "what's left
 * after the main" — a stated, accepted simplification (see MILESTONE-4.md),
 * not an oversight. The combined main+side time budget is enforced
 * separately as a hard filter in `mealComposition.ts`, not here.
 */
export function scoreSide(side: Recipe, main: Recipe, ctx: GenerateContext): number {
  const w = weightsFor(ctx);
  // The plate plus the rest of the week — what `favoriteBonus` measures
  // favorite crowding against. No `repeatPenalty` term appears below: side
  // repeats are not a defect (rotation.ts explains why, and the recency map
  // holds no side entries anyway).
  const chosenSoFar = [main, ...(ctx.weekRecipes ?? [])];
  return (
    w.pantry * pantryOverlap(side, ctx.pantry) +
    w.preference * preferenceMatch(side, ctx) +
    w.affinity * affinityBonus(side, ctx) +
    w.favorite * favoriteBonus(side, ctx, chosenSoFar) +
    w.curated * curatedBonus(side) +
    w.kidApproved * kidApprovedBonus(side, ctx) +
    w.learnedDials * learnedDialsFit(side, ctx) +
    w.sideCuisineFit * cuisineFitBonus(side, main) +
    w.budget * budgetFit(side, ctx) +
    w.time * timeFit(side, ctx) +
    w.nutrition * nutritionFit(side, ctx) +
    w.healthyComfort * healthyComfortFit(side, ctx) +
    w.adventurous * adventurousFit(side, ctx) +
    w.season * seasonFit(side, ctx) +
    // M4.3: a side that uses up the main's own half-unit, or another meal's,
    // both count — the "half cabbage becomes sautéed cabbage on Thursday"
    // case from MILESTONE-4.md.
    w.wasteFit * wasteFitBonus(side, [main, ...(ctx.weekRecipes ?? [])]) -
    w.ratingsPenalty * ratingsPenalty(side, ctx)
  );
}
