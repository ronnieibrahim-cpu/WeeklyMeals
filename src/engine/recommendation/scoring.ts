import { Recipe } from '@/domain/models';

import { roughCostPerServing } from '../cost';
import { GenerateContext, WEIGHTS } from './types';

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
  if (ctx.profile.favoriteCuisines.includes(recipe.cuisine)) score += 0.3;
  if (ctx.intake.cuisines.length > 0 && ctx.intake.cuisines.includes(recipe.cuisine)) score += 0.2;
  if (ctx.profile.preferredProteins.includes(recipe.primaryProtein)) score += 0.2;
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
  const perMealBudget = ctx.intake.budget / Math.max(1, ctx.intake.dinners) / Math.max(1, ctx.intake.people);
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
  return (
    WEIGHTS.pantry * pantryOverlap(recipe, ctx.pantry) +
    WEIGHTS.preference * preferenceMatch(recipe, ctx) +
    WEIGHTS.variety * varietyBonus(recipe, selected) +
    WEIGHTS.budget * budgetFit(recipe, ctx) +
    WEIGHTS.time * timeFit(recipe, ctx) +
    WEIGHTS.nutrition * nutritionFit(recipe, ctx) +
    WEIGHTS.healthyComfort * healthyComfortFit(recipe, ctx) +
    WEIGHTS.adventurous * adventurousFit(recipe, ctx) +
    WEIGHTS.season * seasonFit(recipe, ctx) -
    WEIGHTS.ratingsPenalty * ratingsPenalty(recipe, ctx)
  );
}
