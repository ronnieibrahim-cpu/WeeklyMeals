import { Cuisine, Difficulty, Nutrition, Protein, Recipe, RecipeIngredient } from '@/domain/models';
import { createId } from '@/utils/id';

/** Id prefix for family-authored recipes (M3.5) — mirrors `mealdb-` for imports. */
export const USER_RECIPE_ID_PREFIX = 'user-';

export function isUserRecipe(recipeId: string): boolean {
  return recipeId.startsWith(USER_RECIPE_ID_PREFIX);
}

/** Milestone-mandated minimums: a "recipe" with fewer than this isn't really one. */
export const MIN_INGREDIENTS = 1;
export const MIN_STEPS = 3;

/** What the "Add recipe" form collects — the rest of `Recipe` is derived/inferred. */
export interface UserRecipeInput {
  name: string;
  cuisine: Cuisine;
  primaryProtein: Protein;
  baseServings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  description?: string;
  tips?: string[];
  /** Pre-populated from `inferAllergensFromIngredients` and shown as editable
   * chips on the form — the user has the final say before saving, since
   * allergy filtering is safety-critical (see passesAllergySafety). */
  allergens: string[];
}

/** Plain-English validation errors, empty when the input is savable. */
export function validateUserRecipeInput(input: UserRecipeInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('Give the recipe a name.');
  if (input.ingredients.length < MIN_INGREDIENTS) {
    errors.push(`Add at least ${MIN_INGREDIENTS} ingredient.`);
  }
  if (input.steps.filter((s) => s.trim().length > 0).length < MIN_STEPS) {
    errors.push(`Add at least ${MIN_STEPS} steps.`);
  }
  if (input.baseServings < 1) errors.push('Servings must be at least 1.');
  return errors;
}

const has = (text: string, ...keywords: string[]) => keywords.some((k) => text.includes(k));

function ingredientText(ingredients: RecipeIngredient[]): string {
  return ingredients.map((i) => i.name.toLowerCase()).join(', ');
}

/**
 * Keyword-guess allergens from ingredient names, using the exact labels in
 * `COMMON_ALLERGENS` (notably 'Tree Nuts' with a space) so matches line up
 * with `profile.allergies` — the importer's equivalent (`inferAllergens` in
 * normalize.ts) has a known 'TreeNuts'/'Tree Nuts' mismatch bug (see
 * PROJECT.md §7 #1); this is a fresh implementation, not a copy, specifically
 * to avoid repeating it. Shown back to the user as editable chips on the
 * form rather than silently trusted, since a family recipe fully bypasses the
 * "imported recipes are excluded once any allergy is set" guard.
 */
export function inferAllergensFromIngredients(ingredients: RecipeIngredient[]): string[] {
  const text = ingredientText(ingredients);
  const found = new Set<string>();
  if (has(text, 'flour', 'bread', 'pasta', 'noodle', 'soy sauce', 'breadcrumb', 'wheat', 'couscous', 'panko', 'barley', 'cracker', 'tortilla'))
    found.add('Gluten');
  if (has(text, 'milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'paneer', 'ghee', 'parmesan', 'mozzarella', 'feta'))
    found.add('Dairy');
  if (has(text, 'shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'clam', 'scallop', 'squid')) found.add('Shellfish');
  if (has(text, 'salmon', 'tuna', 'cod', 'fish', 'anchov', 'haddock', 'sardine')) found.add('Fish');
  if (has(text, 'egg')) found.add('Eggs');
  if (has(text, 'soy sauce', 'tofu', 'edamame', 'miso', 'tempeh', 'soybean')) found.add('Soy');
  if (has(text, 'peanut')) found.add('Peanuts');
  if (has(text, 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut')) found.add('Tree Nuts');
  if (has(text, 'sesame', 'tahini')) found.add('Sesame');
  return [...found];
}

/**
 * Guess vegetarian/vegan/gluten-free/dairy-free tags from the protein and
 * ingredients, mirroring the approach normalize.ts's `inferDietTags` already
 * uses for imports — lets a homemade vegan/gluten-free dish correctly match
 * a week's dietary restriction without asking the user to fill in tags by hand.
 */
export function inferDietTagsFromIngredients(
  primaryProtein: Protein,
  ingredients: RecipeIngredient[],
  allergens: string[],
): string[] {
  const text = ingredientText(ingredients);
  const tags: string[] = [];
  const meaty: Protein[] = ['Chicken', 'Beef', 'Pork', 'Fish', 'Shellfish', 'Turkey', 'Lamb'];
  const vegetarian =
    !meaty.includes(primaryProtein) &&
    !has(text, 'chicken', 'beef', 'pork', 'lamb', 'fish', 'bacon', 'sausage', 'anchov', 'gelatin', 'shrimp');
  if (vegetarian) {
    tags.push('vegetarian');
    if (!allergens.includes('Dairy') && !allergens.includes('Eggs') && !has(text, 'honey')) tags.push('vegan');
  }
  if (!allergens.includes('Gluten')) tags.push('gluten-free');
  if (!allergens.includes('Dairy')) tags.push('dairy-free');
  return tags;
}

const STARCH_KEYWORDS = ['rice', 'pasta', 'noodle', 'potato', 'bread', 'tortilla', 'bun', 'couscous', 'quinoa', 'flour', 'polenta', 'gnocchi'];
const RICH_KEYWORDS = ['cream', 'butter', 'cheese', 'coconut milk', 'oil', 'fried'];

/**
 * Rough per-serving nutrition estimate from the ingredients the form already
 * collected — not accurate, but deliberately non-degenerate: a carb-heavy
 * recipe shouldn't default to 0 carbs and trivially satisfy the "low-carb"/
 * "keto" diet filters (`satisfiesDiet` in filters.ts) just because nutrition
 * wasn't typed in by hand.
 */
export function estimateNutritionFromIngredients(ingredients: RecipeIngredient[], primaryProtein: Protein): Nutrition {
  const text = ingredientText(ingredients);
  const starch = has(text, ...STARCH_KEYWORDS);
  const rich = has(text, ...RICH_KEYWORDS);
  const proteinG: Record<Protein, number> = {
    Chicken: 38, Beef: 36, Pork: 34, Fish: 34, Shellfish: 30, Turkey: 36, Lamb: 34,
    Tofu: 20, Beans: 18, Lentils: 18, Eggs: 20, None: 12,
  };
  return {
    calories: 420 + (starch ? 100 : 0) + (rich ? 60 : 0),
    protein: proteinG[primaryProtein],
    carbs: starch ? 48 : 18,
    fat: 18 + (rich ? 12 : 0),
  };
}

/** Cheap difficulty default from total time — not asked on the v1 form. */
export function difficultyFromMinutes(prepMinutes: number, cookMinutes: number): Difficulty {
  const total = prepMinutes + cookMinutes;
  if (total <= 30) return 'Easy';
  if (total <= 60) return 'Medium';
  return 'Hard';
}

/**
 * Assemble a full `Recipe` from the form input, filling in every field the
 * v1 form doesn't ask about with a safe, inert default. `estimated` stays
 * unset (falsy) — per the milestone spec, a family recipe should behave like
 * a hand-curated one, not like an imported/estimated one (so it isn't
 * excluded from generation/pinning the moment any profile allergy is set).
 */
export function buildUserRecipe(input: UserRecipeInput, existingId?: string): Recipe {
  return {
    id: existingId ?? `${USER_RECIPE_ID_PREFIX}${createId()}`,
    name: input.name.trim(),
    cuisine: input.cuisine,
    categories: [],
    primaryProtein: input.primaryProtein,
    vegetables: [],
    techniques: [],
    difficulty: difficultyFromMinutes(input.prepMinutes, input.cookMinutes),
    spiceLevel: 'Mild',
    prepMinutes: input.prepMinutes,
    cookMinutes: input.cookMinutes,
    baseServings: input.baseServings,
    nutrition: estimateNutritionFromIngredients(input.ingredients, input.primaryProtein),
    ingredients: input.ingredients,
    steps: input.steps.filter((s) => s.trim().length > 0),
    description: input.description?.trim() || undefined,
    tips: input.tips?.map((t) => t.trim()).filter((t) => t.length > 0),
    makesLeftovers: false,
    seasons: [],
    allergens: input.allergens,
    dietTags: inferDietTagsFromIngredients(input.primaryProtein, input.ingredients, input.allergens),
  };
}
