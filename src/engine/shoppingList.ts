import { GroceryProvider } from '@/data/grocery/GroceryProvider';
import { PlannedMeal, Recipe, ShoppingItem, ShoppingList, Unit } from '@/domain/models';

const lower = (s: string) => s.trim().toLowerCase();
const round2 = (n: number) => Math.round(n * 100) / 100;

function pantryHas(pantry: string[], name: string): boolean {
  const n = lower(name);
  return pantry.some((p) => {
    const pl = lower(p);
    return n.includes(pl) || pl.includes(n);
  });
}

// Convertible measures, so "2 tbsp" and "1/4 cup" of the same ingredient merge
// into one line. Volume is canonicalized to teaspoons, weight to grams; count
// units (piece, can, bunch…) only merge with themselves.
const VOLUME_TSP: Partial<Record<Unit, number>> = { tsp: 1, tbsp: 3, cup: 48, ml: 0.2029, l: 202.9 };
const WEIGHT_G: Partial<Record<Unit, number>> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };

function dimensionOf(unit: Unit): 'volume' | 'weight' | null {
  if (VOLUME_TSP[unit] != null) return 'volume';
  if (WEIGHT_G[unit] != null) return 'weight';
  return null;
}

/** Round to a friendly fraction (quarters) for display. */
const quarters = (n: number) => Math.max(0.25, Math.round(n * 4) / 4);

/** Pick the natural unit for a canonical amount (48 tsp → "1 cup", 32 oz → "2 lb"). */
function display(canonical: number, dim: 'volume' | 'weight'): { quantity: number; unit: Unit } {
  if (dim === 'volume') {
    if (canonical >= 12) return { quantity: quarters(canonical / 48), unit: 'cup' };
    if (canonical >= 3) return { quantity: quarters(canonical / 3), unit: 'tbsp' };
    return { quantity: quarters(canonical), unit: 'tsp' };
  }
  if (canonical >= 226.8) return { quantity: quarters(canonical / 453.6), unit: 'lb' };
  return { quantity: quarters(canonical / 28.35), unit: 'oz' };
}

/**
 * Consolidate every meal's ingredients into one shopping list: scale by servings,
 * combine duplicates (normalizing units, so tbsp + cups sum), drop pantry staples
 * + items the user already has, price each line via the grocery provider, and
 * total it up (with cost per serving).
 */
export function buildShoppingList(
  planId: string,
  meals: PlannedMeal[],
  getRecipe: (id: string) => Recipe | undefined,
  pantry: string[],
  grocery: GroceryProvider,
): ShoppingList {
  interface Line {
    item: ShoppingItem;
    dim: 'volume' | 'weight' | null;
    canonical: number; // tsp for volume, g for weight; display qty otherwise
  }
  const map = new Map<string, Line>();

  for (const meal of meals) {
    const recipe = getRecipe(meal.recipeId);
    if (!recipe) continue;
    const scale = recipe.baseServings > 0 ? meal.servings / recipe.baseServings : 1;

    for (const ing of recipe.ingredients) {
      if (ing.pantryStaple) continue;
      if (pantryHas(pantry, ing.name)) continue;

      const dim = dimensionOf(ing.unit);
      const key = `${lower(ing.name)}|${dim ?? ing.unit}`;
      const factor = dim === 'volume' ? VOLUME_TSP[ing.unit]! : dim === 'weight' ? WEIGHT_G[ing.unit]! : 1;
      const canonical = ing.quantity * scale * factor;
      const existing = map.get(key);
      if (existing) {
        existing.canonical += canonical;
        if (!existing.item.fromRecipeIds.includes(recipe.id)) {
          existing.item.fromRecipeIds.push(recipe.id);
        }
      } else {
        map.set(key, {
          dim,
          canonical,
          item: {
            ingredientName: ing.name,
            quantity: 0,
            unit: ing.unit,
            department: ing.department,
            estimatedPrice: 0,
            checked: false,
            fromRecipeIds: [recipe.id],
          },
        });
      }
    }
  }

  const items = Array.from(map.values()).map(({ item, dim, canonical }) => {
    if (dim) {
      const d = display(canonical, dim);
      return { ...item, quantity: d.quantity, unit: d.unit };
    }
    return { ...item, quantity: round2(canonical) };
  });
  for (const item of items) {
    const priced = grocery.priceFor(item.ingredientName, item.quantity, item.unit, item.department);
    item.estimatedPrice = priced.price;
    item.hebProductName = priced.productName;
  }

  const estimatedTotal = round2(items.reduce((sum, i) => sum + i.estimatedPrice, 0));
  const totalServings = meals.reduce((s, m) => s + m.servings, 0);
  const costPerServing = totalServings ? round2(estimatedTotal / totalServings) : 0;

  return { planId, items, estimatedTotal, costPerServing, generatedAtISO: new Date().toISOString() };
}
