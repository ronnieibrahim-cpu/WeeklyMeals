import { Protein, Recipe } from '@/domain/models';

/**
 * Rough per-serving cost heuristic used by the engine's budget scoring.
 * Intentionally simple for now; replaced by real H-E-B pricing when the
 * shopping-list step lands (it will combine the curated price table with this
 * as a fallback). Returns USD.
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

/** Departments whose ingredients meaningfully move the bill. */
const MAJOR_DEPARTMENTS = new Set(['Meat', 'Seafood', 'Produce', 'Dairy', 'Frozen', 'Bakery']);

export function roughCostPerServing(recipe: Recipe): number {
  const protein = PROTEIN_COST[recipe.primaryProtein] ?? 1.5;
  // Groceries you actually buy add real cost; spices/condiments barely register.
  // (Counting every listed pinch equally made web-imported recipes — which
  // itemize each spice — look ~$1.50/serving pricier than hand-authored ones.)
  let extras = 0;
  for (const i of recipe.ingredients) {
    if (i.pantryStaple) continue;
    extras += MAJOR_DEPARTMENTS.has(i.department) ? 0.25 : 0.08;
  }
  return Math.round((protein + Math.min(extras, 2.5)) * 100) / 100;
}
