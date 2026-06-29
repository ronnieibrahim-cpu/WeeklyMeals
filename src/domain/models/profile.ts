import { Cuisine, Difficulty, Protein, SpiceLevel } from './common';

export interface HouseholdMember {
  ageYears?: number;
  isChild: boolean;
}

/** The household's long-lived preferences. Seeds intake defaults and the engine. */
export interface Profile {
  id: string;
  familySize: number;
  members: HouseholdMember[];
  cookingSkill: Difficulty;
  favoriteCuisines: Cuisine[];
  dislikedCuisines: Cuisine[];
  preferredProteins: Protein[];
  dislikedIngredients: string[];
  allergies: string[];
  dietaryRestrictions: string[]; // e.g. ['vegetarian', 'gluten-free']
  spiceLevel: SpiceLevel;
  weeklyBudget: number; // USD
  avgCookMinutes: number;
  shoppingDay: number; // 0–6 (Sun–Sat)
  mealPrepDay: number; // 0–6
  favoriteStore: string; // 'HEB'
  equipment: string[]; // ['Oven', 'AirFryer', 'SlowCooker', ...]
  nutritionPriorities: string[]; // ['HighProtein', 'LowCarb', ...]
  targetCaloriesPerMeal?: number;
  targetProteinPerMeal?: number;
  pantryStaples: string[]; // things always on hand
}
