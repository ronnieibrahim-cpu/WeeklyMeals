import { ManualItemMap } from '@/domain/models';

import { ManualItemsRepository } from '../ManualItemsRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:manualItems:v1';

export class LocalManualItemsRepository implements ManualItemsRepository {
  load(): Promise<ManualItemMap | null> {
    return kvStore.getJSON<ManualItemMap>(KEY);
  }

  save(map: ManualItemMap): Promise<void> {
    return kvStore.setJSON(KEY, map);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localManualItemsRepository = new LocalManualItemsRepository();
