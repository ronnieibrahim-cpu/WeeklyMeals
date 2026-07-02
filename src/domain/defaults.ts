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

/** Seed this week's intake from the saved profile (the user can tweak each answer). */
export function createIntakeFromProfile(p: Profile): IntakeAnswers {
  return {
    dinners: 7,
    people: p.familySize,
    budget: p.weeklyBudget,
    maxPrepMinutes: 20,
    maxCookMinutes: p.avgCookMinutes,
    cuisines: [...p.favoriteCuisines],
    proteins: [...p.preferredProteins],
    healthyVsComfort: 0.5,
    dietaryRestrictions: [...p.dietaryRestrictions],
    ingredientsAtHome: [],
    adventurousness: 0.5,
  };
}
