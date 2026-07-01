import { Cuisine, Recipe } from '@/domain/models';

/**
 * Recipe imagery. Real photos are fetched at runtime from a free, keyword-based
 * image source (no API key), curated per cuisine, with a stable per-recipe "lock"
 * so each recipe keeps the same photo. The UI always falls back to a tinted
 * emoji tile while loading, on error, or offline. Flip RECIPE_IMAGES_ENABLED to
 * false to use the emoji tiles only.
 */
export const RECIPE_IMAGES_ENABLED = true;

const CUISINE_KEYWORD: Record<Cuisine, string> = {
  Italian: 'italian,food',
  Mexican: 'mexican,food',
  Greek: 'greek,food',
  Indian: 'indian,food',
  Thai: 'thai,food',
  Japanese: 'japanese,food',
  Chinese: 'chinese,food',
  French: 'french,food',
  Mediterranean: 'mediterranean,food',
  American: 'american,food',
  MiddleEastern: 'arabic,food',
  BBQ: 'barbecue,food',
};

/** Small stable hash so a given recipe consistently shows one photo. */
function lockFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 100000;
}

/** Photo URL for a recipe, or '' when images are disabled. */
export function imageForRecipe(recipe: Recipe): string {
  if (!RECIPE_IMAGES_ENABLED) return '';
  const keyword = CUISINE_KEYWORD[recipe.cuisine] ?? 'food';
  return `https://loremflickr.com/640/480/${keyword}?lock=${lockFor(recipe.id)}`;
}
