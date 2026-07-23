import { FavoritesMap, KidApprovedMap, ManualItemMap, RecipeNotesMap, ShoppingList, UserRecipeSyncMap, WeeklyPlan } from '@/domain/models';

import { HOUSEHOLD_TABLE, SUPABASE_KEY, SUPABASE_URL } from './config';

/** The shared state synced across a household's devices. `favorites`/
 * `kidApproved`/`manualItems`/`recipeNotes`/`userRecipes` are optional on the
 * wire (M3.1, M3.2, M3.3, M4.4, M5.4) since existing rows written before
 * those fields existed won't have them — treat a missing map the same as an
 * empty one. */
export interface SyncPayload {
  plan: WeeklyPlan | null;
  shoppingList: ShoppingList | null;
  favorites?: FavoritesMap;
  kidApproved?: KidApprovedMap;
  manualItems?: ManualItemMap;
  recipeNotes?: RecipeNotesMap;
  userRecipes?: UserRecipeSyncMap;
}

export interface HouseholdRow {
  code: string;
  data: SyncPayload;
  updated_at: string;
}

const BASE = `${SUPABASE_URL}/rest/v1/${HOUSEHOLD_TABLE}`;
const HEADERS: Record<string, string> = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

/** Fetch a household row by code, or null if it doesn't exist yet. */
export async function getHousehold(code: string): Promise<HouseholdRow | null> {
  const res = await fetch(`${BASE}?code=eq.${encodeURIComponent(code)}&select=*`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Sync read failed (${res.status})`);
  const rows = (await res.json()) as HouseholdRow[];
  return rows[0] ?? null;
}

/** Create or update a household row (upsert on the code primary key). */
export async function upsertHousehold(code: string, data: SyncPayload): Promise<HouseholdRow> {
  const body = [{ code, data, updated_at: new Date().toISOString() }];
  const res = await fetch(`${BASE}?on_conflict=code`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Sync write failed (${res.status})`);
  const rows = (await res.json()) as HouseholdRow[];
  return rows[0];
}
