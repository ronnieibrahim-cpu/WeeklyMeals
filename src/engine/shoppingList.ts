import { GroceryProvider } from '@/data/grocery/GroceryProvider';
import { PlannedMeal, Recipe, ShoppingItem, ShoppingList } from '@/domain/models';

const lower = (s: string) => s.trim().toLowerCase();
const round2 = (n: number) => Math.round(n * 100) / 100;

function pantryHas(pantry: string[], name: string): boolean {
  const n = lower(name);
  return pantry.some((p) => {
    const pl = lower(p);
    return n.includes(pl) || pl.includes(n);
  });
}

/**
 * Consolidate every meal's ingredients into one shopping list: scale by servings,
 * combine duplicates, drop pantry staples + items the user already has, price each
 * line via the grocery provider, and total it up (with cost per serving).
 */
export function buildShoppingList(
  planId: string,
  meals: PlannedMeal[],
  getRecipe: (id: string) => Recipe | undefined,
  pantry: string[],
  grocery: GroceryProvider,
): ShoppingList {
  const map = new Map<string, ShoppingItem>();

  for (const meal of meals) {
    const recipe = getRecipe(meal.recipeId);
    if (!recipe) continue;
    const scale = recipe.baseServings > 0 ? meal.servings / recipe.baseServings : 1;

    for (const ing of recipe.ingredients) {
      if (ing.pantryStaple) continue;
      if (pantryHas(pantry, ing.name)) continue;

      const key = `${lower(ing.name)}|${ing.unit}`;
      const qty = round2(ing.quantity * scale);
      const existing = map.get(key);
      if (existing) {
        existing.quantity = round2(existing.quantity + qty);
        if (!existing.fromRecipeIds.includes(recipe.id)) existing.fromRecipeIds.push(recipe.id);
      } else {
        map.set(key, {
          ingredientName: ing.name,
          quantity: qty,
          unit: ing.unit,
          department: ing.department,
          estimatedPrice: 0,
          checked: false,
          fromRecipeIds: [recipe.id],
        });
      }
    }
  }

  const items = Array.from(map.values());
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
