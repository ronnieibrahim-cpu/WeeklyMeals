import { Recipe } from '@/domain/models';

/** Persistence boundary for family-authored recipes (M3.5) — per-device, not synced. */
export interface UserRecipesRepository {
  load(): Promise<Record<string, Recipe> | null>;
  save(map: Record<string, Recipe>): Promise<void>;
  clear(): Promise<void>;
}
