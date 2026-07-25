import { createDefaultProfile, createIntakeFromProfile } from '@/domain/defaults';
import { IntakeAnswers, PlannedMeal, PreferenceProfile, Profile, Recipe, WeeklyPlan } from '@/domain/models';

import { createDefaultPreferences } from './learning';
import { CONFIDENCE_FULL_AT_RATINGS } from './rotation';

/** Not a *.test.ts file, so jest's testMatch (src/engine/**\/*.test.ts) skips it. */

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: nextId('recipe'),
    name: 'Test Recipe',
    cuisine: 'Italian',
    categories: ['ComfortFood'],
    primaryProtein: 'Chicken',
    vegetables: ['onion'],
    techniques: ['saute'],
    difficulty: 'Easy',
    spiceLevel: 'Mild',
    prepMinutes: 10,
    cookMinutes: 15,
    baseServings: 4,
    nutrition: { calories: 500, protein: 30, carbs: 40, fat: 20 },
    ingredients: [
      { name: 'chicken breasts', quantity: 1, unit: 'lb', department: 'Meat' },
      { name: 'onion', quantity: 1, unit: 'piece', department: 'Produce' },
      { name: 'salt', quantity: 1, unit: 'tsp', department: 'Spices', pantryStaple: true },
    ],
    steps: ['Cook the chicken.', 'Serve it.'],
    description: 'A test recipe.',
    makesLeftovers: false,
    seasons: [],
    allergens: [],
    dietTags: [],
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { ...createDefaultProfile(), ...overrides };
}

export function makeIntake(profile: Profile, overrides: Partial<IntakeAnswers> = {}): IntakeAnswers {
  return { ...createIntakeFromProfile(profile), ...overrides };
}

/**
 * A PreferenceProfile with enough rating history that learned signals count
 * at full strength (`mealsRated: CONFIDENCE_FULL_AT_RATINGS` — see
 * rotation.ts's `learningConfidence`). Learned affinity and the learned dials
 * are damped in proportion to how much has actually been rated, so a fixture
 * left at the real default of `mealsRated: 0` would silently zero out the
 * very signal a dial/affinity test is trying to exercise. Tests about the
 * damping itself set `mealsRated` explicitly.
 */
export function makePreferences(overrides: Partial<PreferenceProfile> = {}): PreferenceProfile {
  return { ...createDefaultPreferences(), mealsRated: CONFIDENCE_FULL_AT_RATINGS, ...overrides };
}

export function makeMeal(overrides: Partial<PlannedMeal> & Pick<PlannedMeal, 'recipeId' | 'dayIndex'>): PlannedMeal {
  return {
    servings: 4,
    locked: false,
    ...overrides,
  };
}

export function makePlan(overrides: Partial<WeeklyPlan> = {}): WeeklyPlan {
  return {
    id: nextId('plan'),
    weekStartISO: '2026-07-05',
    intake: makeIntake(makeProfile()),
    meals: [],
    status: 'approved',
    createdAtISO: '2026-07-05T00:00:00.000Z',
    ...overrides,
  };
}
