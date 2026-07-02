import { PlannedMeal } from '@/domain/models';

export function isMealRated(meal: PlannedMeal): boolean {
  return typeof meal.rating === 'number';
}

export function unratedMeals(meals: PlannedMeal[]): PlannedMeal[] {
  return meals.filter((m) => !isMealRated(m));
}

export function allMealsRated(meals: PlannedMeal[]): boolean {
  return meals.length > 0 && meals.every(isMealRated);
}
