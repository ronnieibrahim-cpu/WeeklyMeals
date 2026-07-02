import { Protein, Recipe } from '@/domain/models';

/**
 * Rough per-serving cost heuristic used ONLY for internal budget scoring
 * (picking recipes). Any cost shown to the user must come from
 * `buildShoppingList()` / `HebProvider` instead, so every screen agrees.
 */
const PROTEIN_COST: Record<Protein, number> = {
  Beef: 3.2,
  Lamb: 4.0,
  Shellfish: 3.8,
  Fish: 3.2,
  Pork: 2.4,
  Turkey: 2.2,
  Chicken: 2.0,
  Eggs: 0.8,
  Tofu: 1.2,
  Beans: 0.6,
  Lentils: 0.5,
  None: 0.4,
};

export function roughCostPerServing(recipe: Recipe): number {
  const protein = PROTEIN_COST[recipe.primaryProtein] ?? 1.5;
  // Each non-staple ingredient adds a little; produce-heavy dishes cost a bit more.
  const extras = recipe.ingredients.filter((i) => !i.pantryStaple).length * 0.25;
  return Math.round((protein + extras) * 100) / 100;
}
