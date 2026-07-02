import { Cuisine, Protein } from './common';

/** One Sunday's answers. Defaults are seeded from the Profile. */
export interface IntakeAnswers {
  dinners: number;
  people: number;
  budget: number;
  maxPrepMinutes: number;
  maxCookMinutes: number;
  cuisines: Cuisine[]; // empty = no preference
  proteins: Protein[]; // proteins craving this week; empty = no preference
  healthyVsComfort: number; // 0 healthy … 1 comfort
  dietaryRestrictions: string[];
  ingredientsAtHome: string[];
  adventurousness: number; // 0 safe … 1 adventurous
}
