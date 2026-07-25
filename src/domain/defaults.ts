import { createId } from '@/utils/id';

import { IntakeAnswers, Profile } from './models';

/** Sensible starting profile for a first-run Texas / H-E-B household. Fully editable. */
export function createDefaultProfile(): Profile {
  return {
    id: createId(),
    familySize: 4,
    members: [],
    cookingSkill: 'Medium',
    favoriteCuisines: ['Italian', 'Mexican', 'American'],
    dislikedCuisines: [],
    preferredProteins: ['Chicken', 'Beef'],
    dislikedIngredients: [],
    allergies: [],
    dietaryRestrictions: [],
    spiceLevel: 'Medium',
    weeklyBudget: 150,
    avgCookMinutes: 45,
    shoppingDay: 0,
    mealPrepDay: 0,
    favoriteStore: 'HEB',
    equipment: ['Oven', 'Stovetop', 'Air Fryer'],
    nutritionPriorities: ['HighProtein'],
    targetCaloriesPerMeal: 600,
    targetProteinPerMeal: 40,
    pantryStaples: ['Salt', 'Pepper', 'Olive Oil'],
  };
}

/**
 * Seed this week's intake from the saved profile (the user can tweak each
 * answer). `servingsPerMeal` here is a plain placeholder (`familySize`, the
 * old flat headcount) — this file is `src/domain/`, which by design depends
 * on nothing, so it can't reach into `engine/portions.ts` for the real
 * adult-equivalent math. The authoritative value is computed by
 * `usePlanStore.generate()` (which already depends on the engine layer)
 * immediately before generating, overwriting whatever's here — so this
 * placeholder is never actually used to size a shopping list.
 */
export function createIntakeFromProfile(p: Profile): IntakeAnswers {
  return {
    dinners: 7,
    servingsPerMeal: p.familySize,
    budget: p.weeklyBudget,
    maxPrepMinutes: 20,
    maxCookMinutes: p.avgCookMinutes,
    cuisines: [...p.favoriteCuisines],
    proteins: [...p.preferredProteins],
    healthyVsComfort: 0.5,
    dietaryRestrictions: [...p.dietaryRestrictions],
    ingredientsAtHome: [],
    adventurousness: 0.5,
    instantPotNights: 0,
  };
}
