/**
 * M4.4 data layer: one free-text note per recipe (not per cooking), edited
 * from the meal/recipe detail screen — "we added a vegetable", "the kids
 * hated the sauce". Household-synced, merged per `recipeId` newer-timestamp-
 * wins, same deterministic pattern as favorites/kidApproved
 * (`mergeRecipeNotes` in `src/engine/syncMerge.ts`).
 *
 * An empty `text` with a fresh `updatedAtISO` is a deliberate "note cleared"
 * record, not absence of a note — it acts as its own tombstone in the merge,
 * so clearing a note on one phone can't be resurrected by a stale non-empty
 * copy still sitting on the other phone (there is no separate `deleted`
 * flag; emptiness IS the tombstone). The UI treats an empty `text` as "no
 * note" for display purposes, but the record itself must round-trip through
 * sync like any other note.
 *
 * Display only — see PROJECT.md §7 Law: notes never feed scoring.
 */
export interface RecipeNote {
  text: string;
  updatedAtISO: string;
}

/** recipeId -> that recipe's note. */
export type RecipeNotesMap = Record<string, RecipeNote>;
