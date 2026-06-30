import { create } from 'zustand';

import { localPantryRepository } from '@/data/repositories/local/LocalPantryRepository';

interface PantryState {
  items: string[];
  hydrated: boolean;
  init: () => Promise<void>;
  add: (item: string) => void;
  remove: (item: string) => void;
  clear: () => void;
}

const normalize = (s: string) => s.trim().toLowerCase();

/**
 * Persistent pantry — ingredients the user has on hand. Carries over week to week,
 * editable from the Profile and the Sunday questionnaire, and feeds the engine's
 * "build around what I have" scoring.
 */
export const usePantryStore = create<PantryState>((set, get) => ({
  items: [],
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const items = (await localPantryRepository.load()) ?? [];
    set({ items, hydrated: true });
  },

  add: (item) => {
    const value = item.trim();
    if (!value) return;
    const exists = get().items.some((i) => normalize(i) === normalize(value));
    if (exists) return;
    const items = [...get().items, value];
    set({ items });
    void localPantryRepository.save(items);
  },

  remove: (item) => {
    const items = get().items.filter((i) => normalize(i) !== normalize(item));
    set({ items });
    void localPantryRepository.save(items);
  },

  clear: () => {
    set({ items: [] });
    void localPantryRepository.clear();
  },
}));
