import { Difficulty, Protein, SpiceLevel, Unit } from '../models';
import { LabeledOption } from './cuisines';

/** Units offered on the "Add recipe" form's ingredient rows (M3.5). */
export const UNITS: LabeledOption<Unit>[] = [
  { value: 'piece', label: 'piece' },
  { value: 'cup', label: 'cup' },
  { value: 'tbsp', label: 'tbsp' },
  { value: 'tsp', label: 'tsp' },
  { value: 'lb', label: 'lb' },
  { value: 'oz', label: 'oz' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'clove', label: 'clove' },
  { value: 'can', label: 'can' },
  { value: 'bunch', label: 'bunch' },
  { value: 'pinch', label: 'pinch' },
];

export const PROTEINS: LabeledOption<Protein>[] = [
  { value: 'Chicken', label: 'Chicken' },
  { value: 'Beef', label: 'Beef' },
  { value: 'Pork', label: 'Pork' },
  { value: 'Turkey', label: 'Turkey' },
  { value: 'Lamb', label: 'Lamb' },
  { value: 'Fish', label: 'Fish' },
  { value: 'Shellfish', label: 'Shellfish' },
  { value: 'Tofu', label: 'Tofu' },
  { value: 'Beans', label: 'Beans' },
  { value: 'Lentils', label: 'Lentils' },
  { value: 'Eggs', label: 'Eggs' },
];

export const SPICE_LEVELS: LabeledOption<SpiceLevel>[] = [
  { value: 'None', label: 'None' },
  { value: 'Mild', label: 'Mild' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Hot', label: 'Hot' },
];

export const COOKING_SKILLS: LabeledOption<Difficulty>[] = [
  { value: 'Easy', label: 'Beginner' },
  { value: 'Medium', label: 'Intermediate' },
  { value: 'Hard', label: 'Advanced' },
];

export const COMMON_ALLERGENS: string[] = [
  'Peanuts',
  'Tree Nuts',
  'Dairy',
  'Eggs',
  'Gluten',
  'Soy',
  'Shellfish',
  'Fish',
  'Sesame',
];

export const COMMON_DIETS: string[] = [
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Gluten-Free',
  'Dairy-Free',
  'Keto',
  'Low-Carb',
  'Halal',
];

/** Preset choices for quick single-tap selection. */
export const BUDGET_OPTIONS: number[] = [75, 100, 125, 150, 200];
export const COOK_TIME_OPTIONS: number[] = [20, 30, 45, 60, 90];
export const MAX_PREP_OPTIONS: number[] = [10, 15, 20, 30, 45];
export const MAX_COOK_OPTIONS: number[] = [20, 30, 45, 60, 90];

/** Things the user might already have at home (skippable). */
export const COMMON_PANTRY: string[] = [
  'Rice',
  'Pasta',
  'Onions',
  'Garlic',
  'Eggs',
  'Chicken',
  'Ground beef',
  'Cheese',
  'Tortillas',
  'Beans',
  'Potatoes',
  'Canned tomatoes',
];

/** Segmented choices mapped to the 0…1 sliders in IntakeAnswers. */
export const HEALTHY_COMFORT_OPTIONS: LabeledOption<string>[] = [
  { value: '0', label: 'Healthy' },
  { value: '0.5', label: 'Balanced' },
  { value: '1', label: 'Comfort' },
];

export const ADVENTUROUS_OPTIONS: LabeledOption<string>[] = [
  { value: '0', label: 'Play it safe' },
  { value: '0.5', label: 'Some variety' },
  { value: '1', label: 'Adventurous' },
];

/** How many dinners to reserve for Instant Pot recipes. Capped at 2: the
 * curated Instant Pot set is 15 dishes and a tight weekly time limit filters
 * some of them out, so offering "3+" would be offering something the library
 * can't reliably deliver. */
export const INSTANT_POT_OPTIONS: LabeledOption<string>[] = [
  { value: '0', label: 'None' },
  { value: '1', label: '1 night' },
  { value: '2', label: '2 nights' },
];
