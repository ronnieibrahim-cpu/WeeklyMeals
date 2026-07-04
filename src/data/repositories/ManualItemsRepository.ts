import { ManualItemMap } from '@/domain/models';

/** Persistence boundary for manual grocery items (M3.3). */
export interface ManualItemsRepository {
  load(): Promise<ManualItemMap | null>;
  save(map: ManualItemMap): Promise<void>;
  clear(): Promise<void>;
}
