import { Recipe } from '@/domain/models';

/**
 * Identity of the DISH, not the recipe card: twins (`sameDishAs`) share one
 * key, so "Beef & Broccoli" and "Beef and Broccoli Stir-Fry" can't both land
 * in one week or come back on consecutive weeks under different ids
 * (CONTENT-REVIEW.md R5). Every other recipe is its own dish.
 */
export function dishKey(recipe: Pick<Recipe, 'id' | 'sameDishAs'>): string {
  return recipe.sameDishAs ?? recipe.id;
}
