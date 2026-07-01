import { Cuisine, Recipe } from '@/domain/models';

import { RECIPE_IMAGE_URLS } from './recipeImages';

/**
 * Recipe imagery.
 *
 * We deliberately do NOT use a free keyword photo source: they return unrelated
 * pictures too often (a "greek,food" query might show a beach). Real photos are
 * instead curated per recipe in RECIPE_IMAGE_URLS. Any recipe without a curated
 * URL falls back to a clean, deterministic per-cuisine tile — a soft two-tone
 * background with the cuisine's emoji — which always looks intentional, loads
 * instantly, and works offline. Set RECIPE_IMAGES_ENABLED = false to force
 * tiles everywhere regardless of the map.
 */
export const RECIPE_IMAGES_ENABLED = true;

/** Curated photo URL for a recipe, or '' to use the per-cuisine tile. */
export function imageForRecipe(recipe: Recipe): string {
  if (!RECIPE_IMAGES_ENABLED) return '';
  return RECIPE_IMAGE_URLS[recipe.id] ?? recipe.image ?? '';
}

/**
 * Per-cuisine tile colors: [top, bottom] of a soft vertical wash. Chosen to feel
 * warm and appetizing while staying distinct enough to tell cuisines apart.
 */
export const CUISINE_TILE_COLORS: Record<Cuisine, [string, string]> = {
  Italian: ['#E8543E', '#C0392B'],
  Mexican: ['#F39C12', '#E67E22'],
  Greek: ['#4A90D9', '#2E6FBE'],
  Indian: ['#E8863E', '#D35400'],
  Thai: ['#3FA98A', '#2E8B6F'],
  Japanese: ['#D96C7A', '#B84C5E'],
  Chinese: ['#D64541', '#B03330'],
  French: ['#7E6BB0', '#5E4B90'],
  Mediterranean: ['#5BA88F', '#3F8A72'],
  American: ['#5B8DBE', '#3F6FA0'],
  MiddleEastern: ['#C99A3E', '#A67B27'],
  BBQ: ['#B5533A', '#8E3A26'],
};
