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
  /** What this dish is on a composed plate. Absent means 'main' — every
   * recipe authored before M4.2 stays valid. */
  role?: 'main' | 'side' | 'sauce';
  /** What this dish actually puts on the plate — the composition engine
   * (M4.2 part 2) uses this to fill gaps with sides. Absent/omitted means
   * "not authored yet," not "provides nothing." */
  provides?: Array<'protein' | 'vegetable' | 'starch'>;
  primaryProtein: Protein;
  /**
   * Special equipment a recipe genuinely REQUIRES, using the exact labels
   * from `EQUIPMENT` (src/domain/constants/equipment.ts) — e.g.
   * `['Instant Pot']`. Absent means "nothing beyond a stovetop and an oven",
   * which is every recipe authored before this field existed. Only claim
   * equipment whose real steps are written for it: this drives the weekly
   * "Instant Pot nights" request, and a dish tagged for a machine but
   * carrying stovetop instructions would be a promise the app can't keep.
   */
  equipment?: string[];
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
  description?: string; // 1-2 appetizing sentences shown on the detail screen
  tips?: string[]; // 0-3 practical notes: substitutions, make-ahead, kid adjustments
  leftoverNotes?: string;
  freezingNotes?: string;
  makesLeftovers: boolean;
  seasons: Season[]; // empty = available all year
  allergens: string[]; // e.g. ['peanuts', 'dairy']
  dietTags: string[]; // e.g. ['vegetarian', 'gluten-free']
  image?: string; // direct photo URL or asset key; UI falls back to a cuisine tile
  origin?: string; // true country/region label for display (may differ from the mapped `cuisine`)
  sourceName?: string; // attribution, e.g. 'TheMealDB'
  sourceUrl?: string; // link back to the original recipe (citation)
  estimated?: boolean; // true when nutrition/times were inferred during import, not authored
}

/** The main/side split, defined once (M4.2 part 2) — every consumer that
 * needs to pick or list "a main" (generation, re-roll, swap, the Recipes
 * browse tab) filters through this, rather than re-deriving the check. */
export function isMain(recipe: Recipe): boolean {
  return recipe.role === undefined || recipe.role === 'main';
}
