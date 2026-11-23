/**
 * Recipes that are the same dish under two ids → the canonical id (the
 * hand-curated or stovetop version). Applied to `RECIPES` in recipes.ts as
 * `sameDishAs`; the engine then rotates them as one dish (src/engine/
 * dishKey.ts). Found by the November 2026 content review (CONTENT-REVIEW.md
 * R5) from name overlap, then confirmed by reading each pair. Imports can't
 * carry this field themselves — recipeImported.ts is generated.
 */
export const DISH_TWINS: Record<string, string> = {
  // Imported twin → curated original.
  'mealdb-53366': 'cn-beef-broccoli',
  'mealdb-52949': 'cn-sweet-sour-pork',
  'mealdb-53191': 'th-pad-thai-shrimp',
  'mealdb-52982': 'it-spaghetti-carbonara',
  'mealdb-53365': 'cn-orange-chicken',
  'mealdb-53027': 'me-koshari',
  'mealdb-53032': 'jp-pork-tonkatsu',
  'mealdb-53012': 'gr-gigantes',
  'mealdb-52814': 'th-green-curry-chicken',
  'mealdb-53194': 'th-tom-yum-shrimp',
  'mealdb-52871': 'jp-yaki-udon',
  'mealdb-52843': 'me-lamb-tagine',
  'mealdb-52947': 'cn-mapo-tofu',
  'mealdb-53372': 'cn-tomato-egg-stir-fry',
  // Instant Pot version → stovetop/oven original.
  'ip-pork-carnitas': 'mx-pork-carnitas',
  'ip-beef-barbacoa': 'mx-beef-barbacoa',
  'ip-chicken-tikka-masala': 'in-tikka-masala',
  'ip-chana-masala': 'in-chana-masala',
  'ip-mushroom-risotto': 'fr-mushroom-risotto',
  'ip-beef-bourguignon': 'fr-beef-bourguignon',
  'ip-pulled-pork': 'bq-pulled-pork',
};
