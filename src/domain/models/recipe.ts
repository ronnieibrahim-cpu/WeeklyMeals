import { Category, Cuisine, Difficulty, Department, Protein, Season, SpiceLevel, Unit } from './common';

/** Nutrition values are always expressed per serving. */
export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipeIngredient {
  name: string; // canonical name, e.g. "chicken thighs"
  quantity: number; // amount for the recipe's base servings
  unit: Unit;
  department: Department; // drives shopping-list grouping
  optional?: boolean;
  pantryStaple?: boolean; // salt/oil/etc. — usually already at home
}

export interface Recipe {
  id: string;
  name: string;
  cuisine: Cuisine;
  categories: Category[];
  primaryProtein: Protein;
  vegetables: string[]; // for rotation/variety scoring
  techniques: string[]; // e.g. ['roast', 'sheet-pan'] for learning
  difficulty: Difficulty;
  spiceLevel: SpiceLevel;
  prepMinutes: number;
  cookMinutes: number;
  baseServings: number;
  nutrition: Nutrition; // per serving
  ingredients: RecipeIngredient[];
  steps: string[];
  leftoverNotes?: string;
  freezingNotes?: string;
  makesLeftovers: boolean;
  seasons: Season[]; // empty = available all year
  allergens: string[]; // e.g. ['peanuts', 'dairy']
  dietTags: string[]; // e.g. ['vegetarian', 'gluten-free']
  image?: string; // asset key; UI falls back to a gradient card
}
