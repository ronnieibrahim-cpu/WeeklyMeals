import { Cuisine, Recipe } from '@/domain/models';

/**
 * Recipe imagery.
 *
 * We deliberately do NOT use a free keyword photo source: they return unrelated
 * pictures too often (a "greek,food" query might show a beach). Instead every
 * recipe gets a clean, deterministic per-cuisine tile — a soft two-tone
 * background with the cuisine's emoji. It always looks intentional, loads
 * instantly, and works offline. If we later wire up a real per-recipe photo
 * (e.g. bundled assets or a licensed API), set RECIPE_IMAGES_ENABLED = true and
 * return the URL from imageForRecipe.
 */
export const RECIPE_IMAGES_ENABLED = false;

/** Photo URL for a recipe, or '' to use the per-cuisine tile. */
export function imageForRecipe(_recipe: Recipe): string {
  return '';
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
