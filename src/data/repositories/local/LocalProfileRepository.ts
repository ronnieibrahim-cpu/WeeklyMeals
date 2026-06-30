import { Profile } from '@/domain/models';

import { ProfileRepository } from '../ProfileRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:profile:v1';

export class LocalProfileRepository implements ProfileRepository {
  load(): Promise<Profile | null> {
    return kvStore.getJSON<Profile>(KEY);
  }

  save(profile: Profile): Promise<void> {
    return kvStore.setJSON(KEY, profile);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localProfileRepository = new LocalProfileRepository();
