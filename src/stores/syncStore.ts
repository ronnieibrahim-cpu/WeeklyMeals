import { create } from 'zustand';

import { kvStore } from '@/data/repositories/local/kvStore';
import { SYNC_ENABLED } from '@/data/sync/config';
import { getHousehold, SyncPayload, upsertHousehold } from '@/data/sync/householdApi';
import { mergeSyncPayload, stableStringify, SyncMergePayload } from '@/engine/syncMerge';

import { useLearningStore } from './learningStore';
import { usePlanStore } from './planStore';

const CODE_KEY = 'wm:household:v1';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function makeCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

function currentPayload(): SyncPayload {
  const p = usePlanStore.getState();
  return { plan: p.plan, shoppingList: p.shoppingList, favorites: useLearningStore.getState().favoritesMap };
}

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

// Module-scoped sync machinery (not reactive state).
let applying = false;
let lastDataJson: string | null = null;
let lastSyncedTs = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribePlan: (() => void) | null = null;
let unsubscribeLearning: (() => void) | null = null;

interface SyncState {
  code: string | null;
  status: SyncStatus;
  lastSyncedAt: string | null;
  error: string | null;
  hydrated: boolean;
  init: () => Promise<void>;
  createHousehold: () => Promise<string>;
  /** Join an existing household code. Returns 'not_found' (without joining)
   * if no household exists yet under that code, so the caller can confirm
   * before creating one — see `createHouseholdWithCode`. */
  joinHousehold: (code: string) => Promise<'joined' | 'not_found'>;
  /** Explicitly create a new household under a chosen code (rather than a
   * random one), seeding it from local data. Used after the user confirms
   * "no household found — create one?" */
  createHouseholdWithCode: (code: string) => Promise<void>;
  leave: () => void;
  syncNow: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => {
  const setStatus = (status: SyncStatus, extra: Partial<SyncState> = {}) => set({ status, ...extra });

  /** Write `data` to the household row unconditionally, and record it as
   * the new last-known-synced state. Shared by the debounced local-edit
   * push and the post-merge push-back, so there's one place that talks to
   * the server. */
  async function pushSnapshot(code: string, data: SyncPayload) {
    const row = await upsertHousehold(code, data);
    lastDataJson = stableStringify(data);
    lastSyncedTs = Date.parse(row.updated_at) || Date.now();
  }

  async function pull() {
    const code = get().code;
    if (!code || !SYNC_ENABLED) return;
    const row = await getHousehold(code);
    if (!row) {
      await push(); // no row yet — create it from local
      return;
    }
    const remoteTs = Date.parse(row.updated_at) || 0;
    if (remoteTs <= lastSyncedTs) return; // already caught up with this server state

    const remote: SyncMergePayload = {
      plan: row.data?.plan ?? null,
      shoppingList: row.data?.shoppingList ?? null,
      favorites: row.data?.favorites ?? {},
    };
    const local: SyncMergePayload = { ...currentPayload(), favorites: currentPayload().favorites ?? {} };
    const merged = mergeSyncPayload(local, remote);
    const mergedKey = stableStringify(merged);

    if (mergedKey !== stableStringify(local)) {
      // Snapshot first: hydrateFromSync must see the exact merged result,
      // not something re-read from the store after this point.
      const snapshot = merged;
      applying = true;
      usePlanStore.getState().hydrateFromSync(snapshot.plan, snapshot.shoppingList);
      useLearningStore.getState().hydrateFavoritesFromSync(snapshot.favorites);
      applying = false;
    }

    if (mergedKey !== stableStringify(remote)) {
      // Local (or the merge itself) knows something this server row
      // doesn't yet — write the converged result back so the other device
      // picks it up on its next poll, instead of re-sending its own stale
      // state and ping-ponging.
      await pushSnapshot(code, merged);
    } else {
      lastSyncedTs = remoteTs;
      lastDataJson = stableStringify(remote);
    }
  }

  async function push() {
    const code = get().code;
    if (!code || !SYNC_ENABLED || applying) return;
    const data = currentPayload();
    if (stableStringify(data) === lastDataJson) return; // nothing changed
    await pushSnapshot(code, data);
  }

  async function run(action: () => Promise<void>) {
    if (!get().code) return;
    setStatus('syncing');
    try {
      await action();
      setStatus('synced', { lastSyncedAt: new Date().toISOString(), error: null });
    } catch (e) {
      setStatus('error', { error: e instanceof Error ? e.message : 'Sync failed' });
    }
  }

  function schedulePush() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void run(push), 600);
  }

  function startPolling() {
    stopPolling();
    void run(pull); // pull latest immediately
    pollTimer = setInterval(() => void run(pull), 20000);
    unsubscribePlan = usePlanStore.subscribe((state, prev) => {
      if (applying) return;
      if (state.plan === prev.plan && state.shoppingList === prev.shoppingList) return;
      schedulePush();
    });
    unsubscribeLearning = useLearningStore.subscribe((state, prev) => {
      if (applying) return;
      if (state.favoritesMap === prev.favoritesMap) return;
      schedulePush();
    });
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    if (pushTimer) clearTimeout(pushTimer);
    if (unsubscribePlan) unsubscribePlan();
    if (unsubscribeLearning) unsubscribeLearning();
    pollTimer = null;
    pushTimer = null;
    unsubscribePlan = null;
    unsubscribeLearning = null;
  }

  function resetMarkers() {
    lastDataJson = null;
    lastSyncedTs = 0;
  }

  /** Adopt `code` as this device's household and seed the row with local
   * data. Shared by `createHousehold` (random code) and
   * `createHouseholdWithCode` (a code the user chose, after confirming). */
  async function seedHousehold(code: string) {
    resetMarkers();
    set({ code });
    await kvStore.setJSON(CODE_KEY, { code });
    await run(push); // seed the row with local data
    startPolling();
  }

  return {
    code: null,
    status: 'idle',
    lastSyncedAt: null,
    error: null,
    hydrated: false,

    init: async () => {
      if (get().hydrated) return;
      const saved = await kvStore.getJSON<{ code: string }>(CODE_KEY);
      set({ code: saved?.code ?? null, hydrated: true });
      if (saved?.code && SYNC_ENABLED) {
        resetMarkers();
        startPolling();
      }
    },

    createHousehold: async () => {
      const code = makeCode();
      await seedHousehold(code);
      return code;
    },

    joinHousehold: async (raw) => {
      const code = raw.trim().toUpperCase();
      if (code.length < 4 || !SYNC_ENABLED) return 'not_found';
      setStatus('syncing');
      try {
        const row = await getHousehold(code);
        if (!row) {
          setStatus('idle');
          return 'not_found';
        }
      } catch (e) {
        setStatus('error', { error: e instanceof Error ? e.message : 'Sync failed' });
        return 'not_found';
      }
      resetMarkers();
      set({ code });
      await kvStore.setJSON(CODE_KEY, { code });
      await run(pull); // adopt the household's existing data
      startPolling();
      return 'joined';
    },

    createHouseholdWithCode: async (raw) => {
      const code = raw.trim().toUpperCase();
      if (code.length < 4) return;
      await seedHousehold(code);
    },

    leave: () => {
      stopPolling();
      resetMarkers();
      set({ code: null, status: 'idle', lastSyncedAt: null, error: null });
      void kvStore.remove(CODE_KEY);
    },

    syncNow: async () => {
      await run(push);
      await run(pull);
    },
  };
});
