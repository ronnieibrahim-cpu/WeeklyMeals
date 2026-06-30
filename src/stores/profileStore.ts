import { create } from 'zustand';

import { localProfileRepository } from '@/data/repositories/local/LocalProfileRepository';
import { createDefaultProfile } from '@/domain/defaults';
import { Profile } from '@/domain/models';

interface ProfileState {
  profile: Profile | null;
  hydrated: boolean;
  /** Load the saved profile (or seed a default on first run). Call once at startup. */
  init: () => Promise<void>;
  /** Patch fields and persist immediately. */
  update: (patch: Partial<Profile>) => void;
  /** Restore the default profile. */
  reset: () => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const existing = await localProfileRepository.load();
    const profile = existing ?? createDefaultProfile();
    if (!existing) await localProfileRepository.save(profile);
    set({ profile, hydrated: true });
  },

  update: (patch) => {
    const current = get().profile;
    if (!current) return;
    const next = { ...current, ...patch };
    set({ profile: next });
    void localProfileRepository.save(next);
  },

  reset: async () => {
    const profile = createDefaultProfile();
    await localProfileRepository.save(profile);
    set({ profile });
  },
}));
