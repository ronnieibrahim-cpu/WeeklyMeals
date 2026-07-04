import { Category, Cuisine } from '../models';

export interface LabeledOption<T> {
  value: T;
  label: string;
}

/** Cuisines the engine rotates among (PRD "Meal Categories"). */
export const CUISINES: LabeledOption<Cuisine>[] = [
  { value: 'Italian', label: 'Italian' },
  { value: 'Mexican', label: 'Mexican' },
  { value: 'Greek', label: 'Greek' },
  { value: 'Indian', label: 'Indian' },
  { value: 'Thai', label: 'Thai' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'French', label: 'French' },
  { value: 'Mediterranean', label: 'Mediterranean' },
  { value: 'American', label: 'American' },
  { value: 'MiddleEastern', label: 'Middle Eastern' },
  { value: 'BBQ', label: 'BBQ' },
  { value: 'Other', label: 'Other' },
];

/** Cross-cutting meal styles / dietary angles used for variety and filtering. */
export const CATEGORIES: LabeledOption<Category>[] = [
  { value: 'ComfortFood', label: 'Comfort Food' },
  { value: 'Healthy', label: 'Healthy' },
  { value: 'LowCarb', label: 'Low Carb' },
  { value: 'HighProtein', label: 'High Protein' },
  { value: 'Seafood', label: 'Seafood' },
  { value: 'Vegetarian', label: 'Vegetarian' },
  { value: 'SlowCooker', label: 'Slow Cooker' },
  { value: 'Grilling', label: 'Grilling' },
  { value: 'SheetPan', label: 'Sheet Pan' },
  { value: 'OnePot', label: 'One Pot' },
  { value: 'Pasta', label: 'Pasta' },
  { value: 'RiceBowls', label: 'Rice Bowls' },
  { value: 'Soups', label: 'Soups' },
  { value: 'Stews', label: 'Stews' },
  { value: 'Sandwiches', label: 'Sandwiches' },
  { value: 'Salads', label: 'Salads' },
  { value: 'BreakfastForDinner', label: 'Breakfast for Dinner' },
  { value: 'SeasonalSpecial', label: 'Seasonal Specials' },
];

export const CUISINE_LABEL: Record<Cuisine, string> = CUISINES.reduce(
  (acc, c) => ({ ...acc, [c.value]: c.label }),
  {} as Record<Cuisine, string>,
);
