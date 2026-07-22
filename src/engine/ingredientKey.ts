import { Unit } from '@/domain/models';

/**
 * M4.7: shared identity + unit-conversion rules the shopping list uses to
 * decide when two ingredient lines are "the same real-world ingredient" and
 * should merge into one, instead of the exact lowercased name+unit match
 * `shoppingList.ts` used before — which let "carrot"/"carrots" or "cotija
 * cheese" in oz vs cup from different recipe sources (curated vs imported,
 * main vs side) show up as separate lines for the same thing.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Identity key for an ingredient NAME, matching purposes only — trim,
 * lowercase, collapse whitespace, and fold a simple trailing plural 's' to
 * its singular form. Display always keeps the first-seen line's original
 * `ingredientName` casing/spelling; this is never shown to the user.
 *
 * Deliberately narrow, favoring false negatives (two spellings of the same
 * ingredient that stay unmerged) over false positives (two different
 * ingredients wrongly folded together):
 * - Words ending in 'ss' are left untouched, so "swiss"/"glass"/"grass"
 *   never get mangled into "glas"/"gras".
 * - Words of length <= 3 are left alone, so short words like "yes"/"gas"
 *   never get stripped down to something odd.
 * - No real morphology: irregular plurals ("tomatoes"/"tomato",
 *   "leaves"/"leaf", "cherries"/"cherry") are NOT special-cased, so those
 *   stay on separate lines rather than risk a wrong fold. This is a known,
 *   accepted gap — see the curated-data scan (`scripts/
 *   checkIngredientConsistency.ts`) for real occurrences worth hand-fixing
 *   at the source instead.
 * - False-positive risk (the tradeoff this rule accepts): ordinary singular
 *   nouns that happen to end in a bare 's' but aren't plurals — "hummus",
 *   "molasses", "asparagus" — get folded to an odd internal key ("hummu",
 *   "molasse", "asparagu"). Harmless on its own (still a unique key, and
 *   display text is untouched) UNLESS some other real ingredient's name
 *   coincidentally folds to that exact same string, which would wrongly
 *   merge two different ingredients. `scripts/checkIngredientConsistency.ts`
 *   audits this: it surfaces every plural-fold merge among curated recipes
 *   for review (INFO) and hard-FAILS on any canonical collision NOT
 *   explained by the trailing-s fold. It passes on the current library —
 *   the price of staying a one-line, dependency-free fold instead of a real
 *   pluralization library.
 */
export function canonicalIngredientName(name: string): string {
  const base = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (base.length > 3 && base.endsWith('s') && !base.endsWith('ss')) {
    return base.slice(0, -1);
  }
  return base;
}

/** Grams-per-unit for every mass unit. */
const MASS_TO_GRAMS: Partial<Record<Unit, number>> = {
  g: 1,
  kg: 1000,
  oz: 28.35,
  lb: 453.59,
};

/** ML-per-unit for every volume unit. */
const VOLUME_TO_ML: Partial<Record<Unit, number>> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
};

/**
 * The convertibility family a unit belongs to. `'mass'` and `'volume'` units
 * freely convert against every other unit in the same family; everything
 * else (piece, bunch, can, clove, pinch) is its own standalone family —
 * "2 cloves" and "3 cloves" merge, but a clove count never converts against
 * anything, so the family is just the unit itself.
 */
export function unitFamily(unit: Unit): string {
  if (unit in MASS_TO_GRAMS) return 'mass';
  if (unit in VOLUME_TO_ML) return 'volume';
  return unit;
}

/** Base-unit (grams for mass, ml for volume) conversion factor. Only
 * meaningful for comparing two units already known to share a family —
 * callers never compare a mass factor against a volume factor. */
function baseFactor(unit: Unit): number {
  return MASS_TO_GRAMS[unit] ?? VOLUME_TO_ML[unit] ?? 1;
}

/**
 * The dedup key two shopping-list lines must share to be "the same
 * ingredient": canonical name + unit family. Two lines with this same key
 * are always mergeable via `mergeQuantities` below (same family, by
 * construction — for a non-convertible unit the "family" IS the unit, so a
 * shared key there also means a shared exact unit).
 */
export function ingredientDedupKey(name: string, unit: Unit): string {
  return `${canonicalIngredientName(name)}|${unitFamily(unit)}`;
}

/** Convert a quantity from one unit to another WITHIN THE SAME FAMILY (the
 * caller must guarantee that — this never checks). Used to bring a servings
 * delta, expressed in a recipe's own native unit, into an existing shopping
 * list line's current display unit before adding/subtracting (M4.1's
 * `applyShoppingListDelta`, extended for M4.7's cross-unit merged lines). */
export function convertQuantity(quantity: number, fromUnit: Unit, toUnit: Unit): number {
  if (fromUnit === toUnit) return quantity;
  return (quantity * baseFactor(fromUnit)) / baseFactor(toUnit);
}

/**
 * Merge two quantities of the same ingredient (same dedup key, so same
 * family) into one. Same-unit is the common case and stays exact —
 * straight addition, no unit-conversion roundoff. A genuine cross-unit
 * merge (only possible within mass or within volume) converts both to the
 * base unit, sums, and re-expresses the total in whichever of the two
 * units has the LARGER base-conversion factor — not whichever produces a
 * quantity >= 1; picking the larger of the units actually in play is what
 * makes "2 tbsp + 0.5 cup" read as "0.63 cup" (not "10 tbsp", even though
 * that's the only one of the two that clears 1) and "700 g + 1 lb" read as
 * "2.54 lb". This is a fold: applying it pairwise as contributions arrive,
 * in any order, converges to the same total in the same unit (associative
 * and commutative — the running total always ends up expressed in whichever
 * unit has ever had the largest base factor among all contributions seen so
 * far), which is what keeps a household's two phones building byte-identical
 * lists from the same meals regardless of iteration order.
 */
export function mergeQuantities(
  aQuantity: number,
  aUnit: Unit,
  bQuantity: number,
  bUnit: Unit,
): { quantity: number; unit: Unit } {
  if (aUnit === bUnit) {
    return { quantity: round2(aQuantity + bQuantity), unit: aUnit };
  }
  const unit = baseFactor(aUnit) >= baseFactor(bUnit) ? aUnit : bUnit;
  const totalBase = aQuantity * baseFactor(aUnit) + bQuantity * baseFactor(bUnit);
  return { quantity: round2(totalBase / baseFactor(unit)), unit };
}
