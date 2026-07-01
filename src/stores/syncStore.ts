import { create } from 'zustand';

import { kvStore } from '@/data/repositories/local/kvStore';
import { SYNC_ENABLED } from '@/data/sync/config';
import { getHousehold, SyncPayload, upsertHousehold } from '@/data/sync/householdApi';

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
  return { plan: p.plan, shoppingList: p.shoppingList };
}

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

// Module-scoped sync machinery (not reactive state).
let applying = false;
let lastDataJson: string | null = null;
let lastSyncedTs = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribePlan: (() => void) | null = null;

interface SyncState {
  code: string | null;
  status: SyncStatus;
  lastSyncedAt: string | null;
  error: string | null;
  hydrated: boolean;
  init: () => Promise<void>;
  createHousehold: () => Promise<string>;
  joinHousehold: (code: string) => Promise<void>;
  leave: () => void;
  syncNow: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => {
  const setStatus = (status: SyncStatus, extra: Partial<SyncState> = {}) => set({ status, ...extra });

  async function pull() {
    const code = get().code;
    if (!code || !SYNC_ENABLED) return;
    const row = await getHousehold(code);
    if (!row) {
      await push(); // no row yet — create it from local
      return;
    }
    const remoteTs = Date.parse(row.updated_at) || 0;
    const remoteJson = JSON.stringify(row.data);
    if (remoteTs > lastSyncedTs && remoteJson !== JSON.stringify(currentPayload())) {
      applying = true;
      usePlanStore.getState().hydrateFromSync(row.data?.plan ?? null, row.data?.shoppingList ?? null);
      applying = false;
    }
    if (remoteTs > lastSyncedTs) {
      lastSyncedTs = remoteTs;
      lastDataJson = remoteJson;
    }
  }

  async function push() {
    const code = get().code;
    if (!code || !SYNC_ENABLED || applying) return;
    const data = currentPayload();
    const json = JSON.stringify(data);
    if (json === lastDataJson) return; // nothing changed
    const row = await upsertHousehold(code, data);
    lastDataJson = json;
    lastSyncedTs = Date.parse(row.updated_at) || Date.now();
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
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    if (pushTimer) clearTimeout(pushTimer);
    if (unsubscribePlan) unsubscribePlan();
    pollTimer = null;
    pushTimer = null;
    unsubscribePlan = null;
  }

  function resetMarkers() {
    lastDataJson = null;
    lastSyncedTs = 0;
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
      resetMarkers();
      set({ code });
      await kvStore.setJSON(CODE_KEY, { code });
      await run(push); // seed the row with local data
      startPolling();
      return code;
    },

    joinHousehold: async (raw) => {
      const code = raw.trim().toUpperCase();
      if (code.length < 4) return;
      resetMarkers();
      set({ code });
      await kvStore.setJSON(CODE_KEY, { code });
      await run(pull); // adopt the household's existing data (or create if missing)
      startPolling();
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
