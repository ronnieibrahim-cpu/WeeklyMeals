import { create } from 'zustand';

import { localRecipeNotesRepository } from '@/data/repositories/local/LocalRecipeNotesRepository';
import { RecipeNotesMap } from '@/domain/models';

/**
 * M4.4: one free-text note per recipe, household-synced (see
 * `mergeRecipeNotes` in `src/engine/syncMerge.ts`). Display only — never
 * feeds scoring (PROJECT.md §7 Law: never pretend).
 *
 * M4.0a lesson, restated here because it bit this app once already: any
 * screen reading a note MUST subscribe to `notesMap` (the data), never to a
 * stable function like `getNote`. A Zustand selector that returns a stable
 * function reference never triggers a re-render on change, so a screen that
 * subscribed to `s.getNote` would keep showing a stale note after an edit on
 * this device or a sync pull from the other one.
 */
interface RecipeNotesState {
  /** Source of truth (household-synced). recipeId -> note. */
  notesMap: RecipeNotesMap;
  hydrated: boolean;
  init: () => Promise<void>;
  /**
   * Set (or clear) a recipe's note. Text is trimmed and stamped with the
   * current time. An empty/cleared string still SAVES an entry — with
   * `text: ''` — rather than deleting the key, because emptiness is the
   * tombstone that makes a clear beat a stale non-empty copy elsewhere once
   * this syncs (see `RecipeNote`'s doc comment in
   * `src/domain/models/recipeNotes.ts`). The UI is responsible for treating
   * an empty `text` as "no note" when rendering.
   */
  setNote: (recipeId: string, text: string) => void;
  /** Adopt a synced notes map after a household sync merge (mirrors
   * learningStore.hydrateFavoritesFromSync) — replaces local state without
   * re-stamping timestamps, since the merge already resolved them. */
  hydrateFromSync: (map: RecipeNotesMap) => void;
}

function persist(map: RecipeNotesMap) {
  void localRecipeNotesRepository.save(map);
}

export const useRecipeNotesStore = create<RecipeNotesState>((set, get) => ({
  notesMap: {},
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const notesMap = (await localRecipeNotesRepository.load()) ?? {};
    set({ notesMap, hydrated: true });
  },

  setNote: (recipeId, text) => {
    const notesMap: RecipeNotesMap = {
      ...get().notesMap,
      [recipeId]: { text: text.trim(), updatedAtISO: new Date().toISOString() },
    };
    set({ notesMap });
    persist(notesMap);
  },

  hydrateFromSync: (map) => {
    set({ notesMap: map });
    persist(map);
  },
}));
