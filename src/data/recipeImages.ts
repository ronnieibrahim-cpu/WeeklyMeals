/**
 * Curated per-recipe photo URLs, keyed by recipe id. Loaded by the app at
 * runtime (the user's device is not behind the dev network policy), so these
 * can point at any public, appropriately-licensed source.
 *
 * Populated in stages. For a personal / web build the plan is:
 *   - TheMealDB custom artwork (https://www.themealdb.com/images/media/meals/…)
 *     for well-known classics — free, credit TheMealDB.
 *   - Wikimedia Commons (https://upload.wikimedia.org/…) to fill gaps — CC/PD.
 * Anything without an entry here falls back to its clean per-cuisine tile, so
 * this map can stay partial indefinitely without looking broken.
 */
export const RECIPE_IMAGE_URLS: Record<string, string> = {
  // e.g. 'in-tikka-masala': 'https://www.themealdb.com/images/media/meals/xxxxxx.jpg',
};
