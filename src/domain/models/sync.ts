/**
 * Shared shape for anything synced across a household as a per-recipe
 * boolean flag with the timestamp it last changed — favorites (M3.1) and
 * kid-approved (M3.2) both use this. Merged with the same
 * newer-timestamp-wins, tie-resolves-to-true pattern as `checked`/`cooked`
 * (see `mergeTimestampedFlagMap` in `src/engine/syncMerge.ts`).
 */
export interface TimestampedFlag {
  flag: boolean;
  atISO: string;
}

export type TimestampedFlagMap = Record<string, TimestampedFlag>;

/** recipeId -> { flag: favorited, atISO: toggledAtISO } */
export type FavoritesMap = TimestampedFlagMap;

/** recipeId -> { flag: kid-approved, atISO: toggledAtISO } (M3.2) */
export type KidApprovedMap = TimestampedFlagMap;
