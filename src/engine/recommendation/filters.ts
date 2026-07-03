import { IntakeAnswers, Profile, Recipe } from '@/domain/models';

const lower = (s: string) => s.trim().toLowerCase();

/** Does the recipe satisfy a single dietary restriction? */
function satisfiesDiet(recipe: Recipe, diet: string): boolean {
  const tags = recipe.dietTags.map(lower);
  const d = lower(diet);
  const isVegetarianProtein = ['tofu', 'beans', 'lentils', 'eggs', 'none'].includes(
    recipe.primaryProtein.toLowerCase(),
  );
  switch (d) {
    case 'vegetarian':
      return tags.includes('vegetarian') || isVegetarianProtein;
    case 'vegan':
      return tags.includes('vegan');
    case 'pescatarian':
      return (
        ['fish', 'shellfish', 'tofu', 'beans', 'lentils', 'eggs', 'none'].includes(
          recipe.primaryProtein.toLowerCase(),
        ) || tags.includes('vegetarian')
      );
    case 'gluten-free':
      return tags.includes('gluten-free');
    case 'dairy-free':
      return tags.includes('dairy-free');
    case 'low-carb':
      return recipe.nutrition.carbs <= 35 || tags.includes('low-carb');
    case 'keto':
      return recipe.nutrition.carbs <= 15 || tags.includes('keto');
    case 'halal':
      return recipe.primaryProtein !== 'Pork' && (tags.includes('halal') || !tags.includes('pork'));
    default:
      return true;
  }
}

/**
 * The two safety-critical, non-negotiable allergy rules — extracted from
 * `passesHardFilters` so an explicit user action that bypasses the rest of
 * the hard filters (M3.1 pin-to-week: soft mismatches like dislikes, time
 * limits, and diet preferences don't block an explicit pick) still can't
 * bypass allergy safety. One implementation, shared by generation/reroll
 * (via `passesHardFilters`) and pinning.
 */
export function passesAllergySafety(recipe: Recipe, profile: Profile): boolean {
  // Allergies (profile-level, non-negotiable)
  const allergies = profile.allergies.map(lower);
  if (recipe.allergens.some((a) => allergies.includes(lower(a)))) return false;

  // Imported recipes have keyword-guessed allergen data (see normalize.ts's
  // inferAllergens), which can miss real allergens. Once any allergy is set,
  // only hand-curated recipes are trusted enough to serve.
  if (allergies.length > 0 && recipe.estimated) return false;

  return true;
}

/** Hard constraints: a recipe failing any of these is dropped from the pool. */
export function passesHardFilters(recipe: Recipe, intake: IntakeAnswers, profile: Profile): boolean {
  if (!passesAllergySafety(recipe, profile)) return false;

  // Dietary restrictions for this week
  for (const diet of intake.dietaryRestrictions) {
    if (!satisfiesDiet(recipe, diet)) return false;
  }

  // Time limits
  if (recipe.prepMinutes > intake.maxPrepMinutes) return false;
  if (recipe.cookMinutes > intake.maxCookMinutes) return false;

  // Disliked cuisines
  if (profile.dislikedCuisines.includes(recipe.cuisine)) return false;

  // Disliked ingredients
  const disliked = profile.dislikedIngredients.map(lower);
  if (disliked.length > 0 && recipe.ingredients.some((i) => disliked.includes(lower(i.name)))) {
    return false;
  }

  return true;
}
