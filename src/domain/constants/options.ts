import { Difficulty, Protein, SpiceLevel } from '../models';
import { LabeledOption } from './cuisines';

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
  'Kosher',
];

/** Preset choices for quick single-tap selection. */
export const BUDGET_OPTIONS: number[] = [75, 100, 125, 150, 200];
export const COOK_TIME_OPTIONS: number[] = [20, 30, 45, 60, 90];
