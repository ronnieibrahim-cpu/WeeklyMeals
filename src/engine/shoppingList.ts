import { GroceryProvider } from '@/data/grocery/GroceryProvider';
import { PlannedMeal, Recipe, RecipeIngredient, ShoppingItem, ShoppingList, ShoppingListDelta, ShoppingListDeltaLine } from '@/domain/models';

const lower = (s: string) => s.trim().toLowerCase();
const round2 = (n: number) => Math.round(n * 100) / 100;

function pantryHas(pantry: string[], name: string): boolean {
  const n = lower(name);
  return pantry.some((p) => {
    const pl = lower(p);
    return n.includes(pl) || pl.includes(n);
  });
}

/** Fold one recipe's ingredients (main or side, M4.2 part 2 — the caller
 * decides which) into the running shopping-list map, scaled by the same
 * `meal.servings` every recipe on that plate is scaled by. Shared by
 * `buildShoppingList`'s per-meal loop for both the main and each side. */
function addRecipeToMap(
  map: Map<string, ShoppingItem>,
  recipe: Recipe,
  servings: number,
  pantry: string[],
): void {
  const scale = recipe.baseServings > 0 ? servings / recipe.baseServings : 1;

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

/**
 * Consolidate every meal's ingredients into one shopping list: scale by servings,
 * combine duplicates, drop pantry staples + items the user already has, price each
 * line via the grocery provider, and total it up (with cost per serving).
 *
 * M4.2 part 2: a meal's composed sides (`sideRecipeIds`) flow in through the
 * exact same map/dedup/scale/price path as the main — one source of truth,
 * so the shopping list and the cost total the approval screen shows can
 * never drift from each other.
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
    if (recipe) addRecipeToMap(map, recipe, meal.servings, pantry);

    for (const sideId of meal.sideRecipeIds ?? []) {
      const side = getRecipe(sideId);
      if (side) addRecipeToMap(map, side, meal.servings, pantry);
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

/**
 * M3.1: append specific ingredients (already known to be missing from
 * pantry + this week's list) onto an existing shopping list. This is the
 * ONLY way the shopping list is ever edited outside of a plan rebuild —
 * it's wired to an explicit "Add these to shopping list" button on
 * pin-to-week, never called automatically. Dedupes by name+unit exactly
 * like `buildShoppingList`: re-adding an ingredient already on the list
 * bumps its quantity and records the new recipe as a source rather than
 * duplicating the line. Existing items untouched by this call keep their
 * exact object identity; `costPerServing` is left as-is (it's derived from
 * planned meals' servings, not meaningful for a manually-added line).
 */
export function addIngredientsToShoppingList(
  list: ShoppingList,
  ingredients: RecipeIngredient[],
  recipeId: string,
  grocery: GroceryProvider,
): ShoppingList {
  const map = new Map<string, ShoppingItem>(list.items.map((i) => [`${lower(i.ingredientName)}|${i.unit}`, i]));

  for (const ing of ingredients) {
    if (ing.pantryStaple) continue;
    const key = `${lower(ing.name)}|${ing.unit}`;
    const existing = map.get(key);

    if (existing) {
      const quantity = round2(existing.quantity + ing.quantity);
      const priced = grocery.priceFor(existing.ingredientName, quantity, existing.unit, existing.department);
      map.set(key, {
        ...existing,
        quantity,
        estimatedPrice: priced.price,
        hebProductName: priced.productName,
        fromRecipeIds: existing.fromRecipeIds.includes(recipeId)
          ? existing.fromRecipeIds
          : [...existing.fromRecipeIds, recipeId],
      });
    } else {
      const quantity = round2(ing.quantity);
      const priced = grocery.priceFor(ing.name, quantity, ing.unit, ing.department);
      map.set(key, {
        ingredientName: ing.name,
        quantity,
        unit: ing.unit,
        department: ing.department,
        estimatedPrice: priced.price,
        hebProductName: priced.productName,
        checked: false,
        fromRecipeIds: [recipeId],
      });
    }
  }

  const items = Array.from(map.values());
  const estimatedTotal = round2(items.reduce((sum, i) => sum + i.estimatedPrice, 0));
  return { ...list, items, estimatedTotal };
}

/**
 * M4.1: what one meal's servings change would do to the shopping list — for
 * showing "you'll need 0.4 lb more chicken thighs" (or "0.4 lb less") BEFORE
 * the user taps an explicit "Update"/"Reduce shopping list" button (Product
 * Law #1: never silently modify the shopping list). Pure/read-only; pairs
 * with `applyShoppingListDelta` below, which actually applies it.
 *
 * Filtered to the exact same "counts on the shopping list" rules
 * `buildShoppingList` uses (pantry staples + on-hand pantry items excluded)
 * so a delta never shows a line for an ingredient the real list would have
 * excluded in the first place. Lines whose quantity difference rounds to
 * zero are dropped — an empty result means nothing actually changes, and
 * callers should show no confirmation UI at all.
 *
 * `removesItem` is always `false` here — this function only sees one
 * recipe's own ingredients, not the live shopping list, so it can't know
 * whether a decrease would zero out a shared item. Callers that need the
 * accurate "will be removed" disclosure (the confirmation copy) fill it in
 * by comparing `deltaQuantity` against the real current item, exactly as
 * `applyShoppingListDelta` itself does when actually applying the change.
 */
export function computeServingsDelta(
  recipe: Recipe,
  oldServings: number,
  newServings: number,
  pantry: string[],
): ShoppingListDelta {
  const direction: 'increase' | 'decrease' = newServings >= oldServings ? 'increase' : 'decrease';
  const scaleOld = recipe.baseServings > 0 ? oldServings / recipe.baseServings : 1;
  const scaleNew = recipe.baseServings > 0 ? newServings / recipe.baseServings : 1;

  const lines: ShoppingListDeltaLine[] = [];
  for (const ing of recipe.ingredients) {
    if (ing.pantryStaple) continue;
    if (pantryHas(pantry, ing.name)) continue;

    const delta = round2(Math.abs(ing.quantity * scaleNew - ing.quantity * scaleOld));
    if (delta <= 0) continue;

    lines.push({ ingredientName: ing.name, unit: ing.unit, department: ing.department, deltaQuantity: delta, removesItem: false });
  }

  return { direction, lines };
}

/**
 * M4.1: apply a previously-computed `ShoppingListDelta` to an EXISTING
 * shopping list, in place — never a full `buildShoppingList` rebuild, which
 * would reset every item's `checked` flag to false and silently un-check
 * everything the family already crossed off. Every field on an untouched or
 * partially-adjusted item (crucially `checked`/`checkedAtISO`) is preserved
 * exactly; only `quantity`/`estimatedPrice`/`hebProductName`/`fromRecipeIds`
 * change on a touched line.
 *
 * A decrease that would take an item's quantity to zero or below removes
 * that line entirely rather than leaving a dead 0-quantity row — safe to do
 * because each item's quantity on the list is a running SUM across every
 * meal that uses it, and `line.deltaQuantity` here is only this one meal's
 * own reduction (its old contribution minus its new, smaller one).
 * Subtracting one meal's own shrinkage can only zero an item out if this
 * meal was that item's sole contributor to begin with — it can never eat
 * into another meal's share. That invariant is what makes it safe to apply
 * a per-meal delta to a list that's shared and deduplicated across meals.
 *
 * `removesSource` (M4.2 part 2, default `false` — every M4.1 call site is
 * unaffected): set `true` only when `recipeId` is being removed from the
 * plate ENTIRELY (e.g. "remove this side"), as opposed to M4.1's normal
 * servings-scale-down where `recipeId` stays a source, just a smaller one.
 * When `true`, `recipeId` is also stripped from `fromRecipeIds` on every
 * touched line — otherwise a removed side would stay listed as a source of
 * an ingredient it no longer contributes to, even though the quantity math
 * is already correct (a full-removal delta, from `computeServingsDelta(recipe,
 * servings, 0, pantry)`, only ever reflects `recipeId`'s own scaled
 * contribution, so subtracting it can never strip an ingredient another
 * recipe on the plate — the main, or another side — still needs).
 */
export function applyShoppingListDelta(
  list: ShoppingList,
  delta: ShoppingListDelta,
  recipeId: string,
  grocery: GroceryProvider,
  removesSource: boolean = false,
): ShoppingList {
  const map = new Map<string, ShoppingItem>(list.items.map((i) => [`${lower(i.ingredientName)}|${i.unit}`, i]));

  for (const line of delta.lines) {
    const key = `${lower(line.ingredientName)}|${line.unit}`;
    const existing = map.get(key);

    if (!existing) {
      // Only reachable on `increase` (a `decrease` line always corresponds
      // to an ingredient already on the list, since it was already scaled
      // in at the old, larger servings count).
      if (delta.direction === 'increase') {
        const quantity = round2(line.deltaQuantity);
        const priced = grocery.priceFor(line.ingredientName, quantity, line.unit, line.department);
        map.set(key, {
          ingredientName: line.ingredientName,
          quantity,
          unit: line.unit,
          department: line.department,
          estimatedPrice: priced.price,
          hebProductName: priced.productName,
          checked: false,
          fromRecipeIds: [recipeId],
        });
      }
      continue;
    }

    const signed = delta.direction === 'increase' ? line.deltaQuantity : -line.deltaQuantity;
    const newQty = round2(existing.quantity + signed);
    if (newQty <= 0) {
      map.delete(key);
      continue;
    }

    const priced = grocery.priceFor(existing.ingredientName, newQty, existing.unit, existing.department);
    const fromRecipeIds = removesSource
      ? existing.fromRecipeIds.filter((id) => id !== recipeId)
      : existing.fromRecipeIds.includes(recipeId)
        ? existing.fromRecipeIds
        : [...existing.fromRecipeIds, recipeId];
    map.set(key, {
      ...existing,
      quantity: newQty,
      estimatedPrice: priced.price,
      hebProductName: priced.productName,
      fromRecipeIds,
    });
  }

  const items = Array.from(map.values());
  const estimatedTotal = round2(items.reduce((sum, i) => sum + i.estimatedPrice, 0));
  // costPerServing is left as-is, same as `addIngredientsToShoppingList` —
  // the caller (planStore) recomputes it from the plan's total servings,
  // which this function has no visibility into.
  return { ...list, items, estimatedTotal };
}
