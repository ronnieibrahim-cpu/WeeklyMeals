/**
 * M4.7: `syncNow()` must pull before it pushes. Pushing first stamps the
 * local write's own `updated_at` as `lastSyncedTs`, so the following pull
 * sees `remoteTs <= lastSyncedTs` — the row it just fetched IS the row it
 * just wrote — and early-returns as "already caught up", silently
 * discarding whatever the partner device wrote since our last poll right
 * before callers like `app/plan/review.tsx`'s `onApprove` act on local state
 * that was never actually reconciled. See MILESTONE-4.md M4.7 and the
 * comment on `syncNow` in syncStore.ts.
 *
 * This is the one store-level test in the suite (stores are otherwise out of
 * scope per jest.config.js / MILESTONE-2.md) because the bug lives entirely
 * in call ORDERING between two network functions — `mergeSyncPayload`'s pure
 * merge logic (covered exhaustively in syncMerge.test.ts) is correct in
 * isolation either way; only the store wiring can regress this.
 */
import { ManualItemMap, RecipeNotesMap } from '@/domain/models';

const mockGetHousehold = jest.fn();
const mockUpsertHousehold = jest.fn();

jest.mock('@/data/sync/config', () => ({
  SYNC_ENABLED: true,
  SUPABASE_URL: 'https://example.invalid',
  SUPABASE_KEY: 'test-key',
  HOUSEHOLD_TABLE: 'households',
}));

jest.mock('@/data/sync/householdApi', () => ({
  getHousehold: (...args: unknown[]) => mockGetHousehold(...args),
  upsertHousehold: (...args: unknown[]) => mockUpsertHousehold(...args),
}));

jest.mock('@/data/repositories/local/kvStore', () => ({
  kvStore: {
    getJSON: jest.fn().mockResolvedValue(null),
    setJSON: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  },
}));

import { useManualItemsStore } from './manualItemsStore';
import { useRecipeNotesStore } from './recipeNotesStore';
import { useSyncStore } from './syncStore';

const REMOTE_MANUAL_ITEMS: ManualItemMap = {
  eggs: {
    displayName: 'eggs',
    department: 'Dairy',
    checked: true,
    checkedAtISO: '2026-07-01T10:05:00.000Z',
    deleted: false,
    deletedAtISO: null,
    updatedAtISO: '2026-07-01T10:05:00.000Z',
    createdAtISO: '2026-07-01T10:00:00.000Z',
  },
};

const REMOTE_RECIPE_NOTES: RecipeNotesMap = {
  'recipe-a': { text: 'halved the chili', updatedAtISO: '2026-07-01T10:10:00.000Z' },
};

describe('syncStore.syncNow ordering (M4.7)', () => {
  beforeEach(() => {
    mockGetHousehold.mockReset();
    mockUpsertHousehold.mockReset();
    useManualItemsStore.setState({ itemsMap: {}, items: [], hydrated: true });
    useRecipeNotesStore.setState({ notesMap: {}, hydrated: true });
    useSyncStore.setState({ code: 'ABCDEF', status: 'idle', lastSyncedAt: null, error: null, hydrated: true });
  });

  it('calls getHousehold (pull) before any upsertHousehold (push), and the partner check-off lands locally', async () => {
    const callOrder: string[] = [];

    mockGetHousehold.mockImplementation(async () => {
      callOrder.push('get');
      return {
        code: 'ABCDEF',
        updated_at: '2026-07-01T10:05:00.000Z',
        data: {
          plan: null,
          shoppingList: null,
          favorites: {},
          kidApproved: {},
          manualItems: REMOTE_MANUAL_ITEMS,
        },
      };
    });
    mockUpsertHousehold.mockImplementation(async (code: string, data: unknown) => {
      callOrder.push('upsert');
      return { code, data, updated_at: new Date().toISOString() };
    });

    await useSyncStore.getState().syncNow();

    // The pull's own getHousehold call must precede any push triggered
    // during syncNow (either pull()'s push-back or the trailing push()).
    expect(callOrder[0]).toBe('get');
    expect(callOrder).toContain('get');

    // The merge landed locally BEFORE syncNow's push phase ran, i.e. the
    // partner's checked=true was not lost to a premature "already caught up".
    expect(useManualItemsStore.getState().itemsMap.eggs?.checked).toBe(true);
  });

  it('(M4.4) a pulled remote row carrying a recipe note lands in recipeNotesStore before push', async () => {
    mockGetHousehold.mockImplementation(async () => ({
      code: 'ABCDEF',
      updated_at: '2026-07-01T10:10:00.000Z',
      data: {
        plan: null,
        shoppingList: null,
        favorites: {},
        kidApproved: {},
        manualItems: {},
        recipeNotes: REMOTE_RECIPE_NOTES,
      },
    }));
    mockUpsertHousehold.mockImplementation(async (code: string, data: unknown) => ({
      code,
      data,
      updated_at: new Date().toISOString(),
    }));

    await useSyncStore.getState().syncNow();

    expect(useRecipeNotesStore.getState().notesMap['recipe-a']?.text).toBe('halved the chili');
  });
});
