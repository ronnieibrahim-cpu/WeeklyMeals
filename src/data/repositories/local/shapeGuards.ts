import { ShoppingList, WeeklyPlan } from '@/domain/models';

/**
 * Minimal structural checks for kvStore.getJSON's `isValid` guard (P2-3) —
 * just enough to catch valid-JSON-but-wrong-shape data before it reaches a
 * screen that assumes the shape (e.g. `plan.meals.sort(...)`) and
 * white-screens. Not full schema validation.
 */

export function isWeeklyPlan(value: unknown): value is WeeklyPlan {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<WeeklyPlan>;
  return typeof p.id === 'string' && typeof p.weekStartISO === 'string' && Array.isArray(p.meals);
}

export function isShoppingList(value: unknown): value is ShoppingList {
  if (!value || typeof value !== 'object') return false;
  const l = value as Partial<ShoppingList>;
  return typeof l.planId === 'string' && Array.isArray(l.items);
}
