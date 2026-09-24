/**
 * Hand-reviewed triage of the TheMealDB imports (M5.8 task 3c), consumed by
 * scripts/importRecipes.ts. Checked in so every keep/fix/drop is reviewable.
 *
 * DROPS: recipe id → why it can't be fixed. Dropped recipes leave the
 * planning pool (generation, re-roll, search, browse) BEFORE the per-cuisine
 * cap, so the next-best candidate from the frozen fixture refills the slot.
 * They are still emitted as `recipeImportedRetired`, so a saved plan, rating,
 * favorite or note that points at one keeps resolving — ids are never reused.
 *
 * FIXES: recipe id → corrections applied to the RAW TheMealDB record before
 * normalize(), so allergens, diet tags, protein, spice and departments are
 * re-inferred from the corrected text (same British-keyword rules). Write
 * fix text in the fixture's own words; the US renames run on output.
 */

export interface ImportFix {
  /** One line: what was wrong. */
  note: string;
  /** Replaces strInstructions. One step per line. */
  instructions?: string;
  /** Replaces the whole ingredient list. */
  ingredients?: { name: string; measure: string }[];
  /** Appended to the ingredient list (a seasoning a step uses, etc.). */
  addIngredients?: { name: string; measure: string }[];
  /** Replace the technique-based time guess. */
  prepMinutes?: number;
  cookMinutes?: number;
}

export const IMPORT_DROPS: Record<string, string> = {};

export const IMPORT_FIXES: Record<string, ImportFix> = {};
