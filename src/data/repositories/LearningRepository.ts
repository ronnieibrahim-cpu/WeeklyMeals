import { FavoritesMap, KidApprovedMap, PreferenceProfile, RatingEvent } from '@/domain/models';

/** Everything the learning loop persists. */
export interface LearningData {
  preferences: PreferenceProfile;
  /** Legacy per-device shape, read for one-time migration only (M3.1
   * superseded this with `favoritesMap`, household-synced). Never written. */
  favorites?: string[];
  favoritesMap: FavoritesMap;
  /** M3.2, household-synced (no legacy shape — this is a new feature). */
  kidApprovedMap: KidApprovedMap;
  ratings: RatingEvent[]; // full rating history
}

export interface LearningRepository {
  load(): Promise<LearningData | null>;
  save(data: LearningData): Promise<void>;
  clear(): Promise<void>;
}
