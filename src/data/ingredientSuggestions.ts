import { INGREDIENT_DICTIONARY } from '@/domain/constants';
import { buildDepartmentGuessMap } from '@/engine/manualItems';

import { RECIPES, RECIPE_INGREDIENT_NAMES } from './seed/recipes';

/**
 * Master autocomplete list: the curated dictionary plus every ingredient the
 * recipe library actually uses (so matches are useful for build-around).
 */
export const INGREDIENT_SUGGESTIONS: string[] = Array.from(
  new Set([...INGREDIENT_DICTIONARY, ...RECIPE_INGREDIENT_NAMES].map((s) => s.toLowerCase())),
).sort();

/** normalizedName -> most common department, used to auto-guess a manual
 * grocery item's department (M3.3). See `guessDepartment`. */
export const INGREDIENT_DEPARTMENT_MAP = buildDepartmentGuessMap(RECIPES);
