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
import { IntakeAnswers, ManualItemMap, PlannedMeal, RecipeNotesMap, WeeklyPlan } from '@/domain/models';
import { localDateString } from '@/engine/schedule';

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
import { usePlanStore } from './planStore';
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

/**
 * "Stale week" fix: `pickUpFromToday` is a plan-store action, not a sync
 * function, but this file is the one sanctioned exception to "stores aren't
 * the coverage goal" (see the file-level doc comment above and
 * jest.config.js) and already mocks kvStore, which is all `pickUpFromToday`
 * touches (via `localPlanRepository.save`). Kept narrow — this is not a
 * general invitation to grow this file into a full planStore suite.
 */
describe('planStore.pickUpFromToday ("stale week" fix)', () => {
  const INTAKE = {} as IntakeAnswers;

  function meal(dayIndex: number, cooked: boolean): PlannedMeal {
    return {
      recipeId: `r${dayIndex}`,
      servings: 4,
      dayIndex,
      locked: false,
      cooked,
      cookedAtISO: cooked ? '2026-07-01T10:00:00.000Z' : null,
    };
  }

  function approvedPlan(meals: PlannedMeal[], weekStartISO: string): WeeklyPlan {
    return {
      id: 'plan-stale',
      weekStartISO,
      intake: INTAKE,
      meals,
      status: 'approved',
      createdAtISO: '2026-07-01T00:00:00.000Z',
    };
  }

  beforeEach(() => {
    usePlanStore.setState({ plan: null, draftPlan: null, shoppingList: null, intake: null, hydrated: true });
  });

  it('sets weekStartISO so the first uncooked meal lands on today (all cooked except day 2 -> weekStartISO = today − 2 days)', () => {
    const plan = approvedPlan(
      [meal(0, true), meal(1, true), meal(2, false), meal(3, false)],
      '2026-06-01', // stale — irrelevant to the result, only the first uncooked dayIndex matters
    );
    usePlanStore.setState({ plan });

    usePlanStore.getState().pickUpFromToday();

    const today = new Date();
    const expectedAnchor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    expectedAnchor.setDate(expectedAnchor.getDate() - 2); // firstUncooked dayIndex = 2
    const expected = localDateString(expectedAnchor);

    const result = usePlanStore.getState().plan;
    expect(result?.weekStartISO).toBe(expected);
    // Only weekStartISO changed — cooked flags, servings, everything else on
    // every meal is untouched (Product Law #1: same food, just re-dated).
    expect(result?.meals).toEqual(plan.meals);
  });

  it('is a no-op when every meal is already cooked', () => {
    const plan = approvedPlan([meal(0, true), meal(1, true)], '2026-06-01');
    usePlanStore.setState({ plan });

    usePlanStore.getState().pickUpFromToday();

    expect(usePlanStore.getState().plan?.weekStartISO).toBe('2026-06-01');
  });

  it('is a no-op when there is no active plan', () => {
    usePlanStore.getState().pickUpFromToday();
    expect(usePlanStore.getState().plan).toBeNull();
  });
});
