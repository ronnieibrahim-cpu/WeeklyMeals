import { create } from 'zustand';

import { INGREDIENT_DEPARTMENT_MAP } from '@/data/ingredientSuggestions';
import { localManualItemsRepository } from '@/data/repositories/local/LocalManualItemsRepository';
import { Department, ManualItem, ManualItemMap } from '@/domain/models';
import { guessDepartment, normalizeItemName } from '@/engine/manualItems';

interface ManualItemsState {
  /** Source of truth, household-synced exactly like favorites/kidApproved
   * (M3.1/M3.2) — keyed by normalized name, see `ManualItemMap`. */
  itemsMap: ManualItemMap;
  /** Derived, non-deleted items with their key attached for rendering/
   * actions, kept in sync with itemsMap on every change. */
  items: (ManualItem & { key: string })[];
  hydrated: boolean;
  init: () => Promise<void>;
  /** Add (or, if the same normalized name was previously deleted, revive)
   * an item. Adding an already-active name is a no-op — it's already on the
   * list. Department is auto-guessed unless given explicitly. */
  add: (rawName: string, department?: Department) => void;
  /**
   * Edit a manual item. Changing the name is a rename: per M3.3's identity
   * rule (items are keyed by normalized name, not a generated id), that
   * tombstones the old key and creates a fresh entry under the new one,
   * rather than editing displayName in place — otherwise two devices that
   * both add "milk" independently could never merge into a single row.
   * Editing quantityLabel/department alone is a normal in-place edit.
   */
  edit: (key: string, patch: { displayName?: string; quantityLabel?: string; department?: Department }) => void;
  toggleChecked: (key: string) => void;
  /** Soft-delete (never a hard removal — see `ManualItem.deleted`). */
  remove: (key: string) => void;
  /** M3.3 lifecycle: called when a new week's plan is approved. Clears
   * (soft-deletes) every currently-checked item; unchecked items carry over
   * untouched, since they were never plan-scoped to begin with. Callers
   * should reconcile with the household sync partner (a pull/merge) first,
   * so this clears based on the merged checked-state rather than a
   * possibly-stale local view — see app/plan/review.tsx. */
  clearChecked: () => void;
  /** Adopt a synced items map after a household sync merge (mirrors
   * planStore.hydrateFromSync / learningStore.hydrateFavoritesFromSync). */
  hydrateFromSync: (map: ManualItemMap) => void;
}

function deriveItems(map: ManualItemMap): (ManualItem & { key: string })[] {
  return Object.entries(map)
    .filter(([, item]) => !item.deleted)
    .map(([key, item]) => ({ ...item, key }));
}

function persist(map: ManualItemMap) {
  void localManualItemsRepository.save(map);
}

export const useManualItemsStore = create<ManualItemsState>((set, get) => ({
  itemsMap: {},
  items: [],
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const itemsMap = (await localManualItemsRepository.load()) ?? {};
    set({ itemsMap, items: deriveItems(itemsMap), hydrated: true });
  },

  add: (rawName, department) => {
    const displayName = rawName.trim();
    if (!displayName) return;
    const key = normalizeItemName(displayName);
    const existing = get().itemsMap[key];
    if (existing && !existing.deleted) return; // already on the list

    const now = new Date().toISOString();
    const next: ManualItem = {
      displayName,
      quantityLabel: existing?.quantityLabel,
      department: department ?? guessDepartment(displayName, INGREDIENT_DEPARTMENT_MAP),
      checked: false,
      // Stamped `now`, not null, even though the item is unchecked: a
      // revived key's `checked: false` needs a real, current timestamp so it
      // deterministically beats a stale remote `checked: true` from before
      // the delete (resolveFlag's "newer wins" would otherwise let an old
      // real timestamp beat our null and resurrect the item pre-checked —
      // see syncMerge.test.ts "revive race" and MILESTONE-4.md M4.7).
      checkedAtISO: now,
      // Reviving a tombstoned key needs a fresh, later deletedAtISO so a
      // re-add always beats the old delete marker once this syncs (see
      // syncMerge.test.ts "tombstone override").
      deleted: false,
      deletedAtISO: now,
      updatedAtISO: now,
      createdAtISO: existing?.createdAtISO ?? now,
    };
    const itemsMap = { ...get().itemsMap, [key]: next };
    set({ itemsMap, items: deriveItems(itemsMap) });
    persist(itemsMap);
  },

  edit: (key, patch) => {
    const existing = get().itemsMap[key];
    if (!existing) return;
    const now = new Date().toISOString();

    const renamedTo = patch.displayName?.trim();
    const renaming = renamedTo !== undefined && normalizeItemName(renamedTo) !== key;

    if (renaming && renamedTo) {
      const newKey = normalizeItemName(renamedTo);
      const tombstoned: ManualItem = { ...existing, deleted: true, deletedAtISO: now };
      const created: ManualItem = {
        ...existing,
        displayName: renamedTo,
        quantityLabel: patch.quantityLabel ?? existing.quantityLabel,
        department: patch.department ?? existing.department,
        deleted: false,
        deletedAtISO: now,
        updatedAtISO: now,
        createdAtISO: now,
      };
      const itemsMap = { ...get().itemsMap, [key]: tombstoned, [newKey]: created };
      set({ itemsMap, items: deriveItems(itemsMap) });
      persist(itemsMap);
      return;
    }

    const next: ManualItem = {
      ...existing,
      quantityLabel: patch.quantityLabel ?? existing.quantityLabel,
      department: patch.department ?? existing.department,
      updatedAtISO: now,
    };
    const itemsMap = { ...get().itemsMap, [key]: next };
    set({ itemsMap, items: deriveItems(itemsMap) });
    persist(itemsMap);
  },

  toggleChecked: (key) => {
    const existing = get().itemsMap[key];
    if (!existing) return;
    const next: ManualItem = { ...existing, checked: !existing.checked, checkedAtISO: new Date().toISOString() };
    const itemsMap = { ...get().itemsMap, [key]: next };
    set({ itemsMap, items: deriveItems(itemsMap) });
    persist(itemsMap);
  },

  remove: (key) => {
    const existing = get().itemsMap[key];
    if (!existing) return;
    const next: ManualItem = { ...existing, deleted: true, deletedAtISO: new Date().toISOString() };
    const itemsMap = { ...get().itemsMap, [key]: next };
    set({ itemsMap, items: deriveItems(itemsMap) });
    persist(itemsMap);
  },

  clearChecked: () => {
    const now = new Date().toISOString();
    const map = get().itemsMap;
    let changed = false;
    const itemsMap: ManualItemMap = { ...map };
    for (const [key, item] of Object.entries(map)) {
      if (!item.deleted && item.checked) {
        itemsMap[key] = { ...item, deleted: true, deletedAtISO: now };
        changed = true;
      }
    }
    if (!changed) return;
    set({ itemsMap, items: deriveItems(itemsMap) });
    persist(itemsMap);
  },

  hydrateFromSync: (map) => {
    set({ itemsMap: map, items: deriveItems(map) });
    persist(map);
  },
}));
