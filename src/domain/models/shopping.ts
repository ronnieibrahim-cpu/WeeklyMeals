import { Department, Unit } from './common';

export interface ShoppingItem {
  ingredientName: string;
  quantity: number;
  unit: Unit;
  department: Department;
  hebProductName?: string;
  estimatedPrice: number; // USD
  checked: boolean;
  checkedAtISO?: string | null; // when this device last toggled `checked` (sync merge key)
  fromRecipeIds: string[]; // provenance, for edits/regeneration
}

export interface ShoppingList {
  planId: string;
  items: ShoppingItem[]; // grouped by department in the UI
  estimatedTotal: number;
  costPerServing: number;
  generatedAtISO: string;
}

/**
 * A hand-added grocery item (M3.3) — "milk", "dish soap", not tied to any
 * week's plan. Keyed by its own normalized (trimmed/lowercased) name rather
 * than a generated id: that's what lets two devices independently add
 * "milk" and converge to one row instead of duplicating it. Renaming an
 * item changes its key, so a rename is a tombstone of the old key plus a
 * fresh entry under the new one (see `ManualItemMap`, `mergeManualItems`) —
 * `displayName` exists purely so the list can show the casing you typed
 * ("Milk") without affecting identity.
 *
 * Paper-list default: `quantityLabel` is free text and optional ("2 lbs",
 * "a dozen") rather than a structured quantity+unit — most items on a real
 * grocery list are just a name.
 */
export interface ManualItem {
  displayName: string;
  quantityLabel?: string;
  department: Department;
  checked: boolean;
  checkedAtISO?: string | null;
  /** Soft-delete flag, resolved by the same newer-timestamp-wins rule as
   * `checked` (see `resolveFlag`) — never a hard removal, so a delete on one
   * device can't be silently resurrected by a stale copy on another. */
  deleted: boolean;
  deletedAtISO?: string | null;
  /** Last edit to displayName/quantityLabel/department (NOT checked/deleted,
   * which have their own independent timestamps). */
  updatedAtISO: string;
  createdAtISO: string;
}

/** normalizeItemName(displayName) -> ManualItem */
export type ManualItemMap = Record<string, ManualItem>;
