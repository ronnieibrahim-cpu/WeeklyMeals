import { Category, Cuisine, Difficulty, Protein, Recipe } from '@/domain/models';

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Client-side, no-network search over recipe name, cuisine, protein, and
 * ingredient names (M3.1). Ranked (name match highest) rather than just
 * filtered, so typing a couple letters of a well-known dish surfaces it
 * first even among partial matches. An empty query returns every recipe
 * untouched (the caller decides what "no query" should show).
 */
export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
  const q = norm(query);
  if (!q) return recipes;

  const scored: { recipe: Recipe; score: number }[] = [];
  for (const recipe of recipes) {
    const score = matchScore(recipe, q);
    if (score > 0) scored.push({ recipe, score });
  }
  scored.sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name));
  return scored.map((s) => s.recipe);
}

function matchScore(recipe: Recipe, q: string): number {
  const name = norm(recipe.name);
  if (name === q) return 5;
  if (name.startsWith(q)) return 4;
  if (name.includes(q)) return 3;
  if (norm(recipe.cuisine).includes(q) || norm(recipe.primaryProtein).includes(q)) return 2;
  if (recipe.ingredients.some((ing) => norm(ing.name).includes(q))) return 1;
  return 0;
}

/**
 * As-you-type suggestion strings (recipe names, cuisines, ingredient names)
 * for the search box's autocomplete dropdown. Shorter matches first (a
 * closer match to what's likely being typed), deduplicated, capped at
 * `limit`. Purely string suggestions — selecting one just fills the search
 * box, it doesn't jump straight to a recipe.
 */
export function autocompleteSuggestions(recipes: Recipe[], query: string, limit = 8): string[] {
  const q = norm(query);
  if (!q) return [];

  const suggestions = new Set<string>();
  for (const recipe of recipes) {
    if (norm(recipe.name).includes(q)) suggestions.add(recipe.name);
    if (norm(recipe.cuisine).includes(q)) suggestions.add(recipe.cuisine);
    for (const ing of recipe.ingredients) {
      if (norm(ing.name).includes(q)) suggestions.add(ing.name);
    }
  }

  return Array.from(suggestions)
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .slice(0, limit);
}

export interface RecipeFilters {
  cuisine?: Cuisine;
  protein?: Protein;
  maxTotalMinutes?: number;
  difficulty?: Difficulty;
  /** Recipe must have every selected category (AND), matching how the
   * Sunday intake's dietary restrictions narrow rather than broaden. */
  categories?: Category[];
  /** recipeIds currently favorited — only used when `favoritesOnly` is set. */
  favoriteIds?: Set<string>;
  favoritesOnly?: boolean;
  /** Excludes estimated (`mealdb-`) imports, keeping only hand-curated recipes. */
  curatedOnly?: boolean;
}

/** Apply the Recipes tab's filter chips. Independent of `searchRecipes` —
 * the screen composes both (filter, then search, or vice versa; order
 * doesn't matter since both are pure predicates/sorts over the same list). */
export function filterRecipes(recipes: Recipe[], filters: RecipeFilters): Recipe[] {
  return recipes.filter((recipe) => {
    if (filters.cuisine && recipe.cuisine !== filters.cuisine) return false;
    if (filters.protein && recipe.primaryProtein !== filters.protein) return false;
    if (filters.difficulty && recipe.difficulty !== filters.difficulty) return false;
    if (
      filters.maxTotalMinutes !== undefined &&
      recipe.prepMinutes + recipe.cookMinutes > filters.maxTotalMinutes
    ) {
      return false;
    }
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.every((c) => recipe.categories.includes(c))) return false;
    }
    if (filters.favoritesOnly && !filters.favoriteIds?.has(recipe.id)) return false;
    if (filters.curatedOnly && recipe.id.startsWith('mealdb-')) return false;
    return true;
  });
}
