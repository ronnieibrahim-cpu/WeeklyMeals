import { PreferenceProfile, RatingEvent } from '@/domain/models';

/** Everything the learning loop persists. */
export interface LearningData {
  preferences: PreferenceProfile;
  favorites: string[]; // favorited recipe ids
  ratings: RatingEvent[]; // full rating history
}

export interface LearningRepository {
  load(): Promise<LearningData | null>;
  save(data: LearningData): Promise<void>;
  clear(): Promise<void>;
}
