import { Profile } from '@/domain/models';

/**
 * Persistence boundary for the household Profile.
 * v1 implementation is local (AsyncStorage); a SupabaseProfileRepository can
 * implement the same interface later without changing callers.
 */
export interface ProfileRepository {
  load(): Promise<Profile | null>;
  save(profile: Profile): Promise<void>;
  clear(): Promise<void>;
}
