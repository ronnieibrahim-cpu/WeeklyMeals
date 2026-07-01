import { LearningData, LearningRepository } from '../LearningRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:learning:v1';

export class LocalLearningRepository implements LearningRepository {
  load(): Promise<LearningData | null> {
    return kvStore.getJSON<LearningData>(KEY);
  }

  save(data: LearningData): Promise<void> {
    return kvStore.setJSON(KEY, data);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localLearningRepository = new LocalLearningRepository();
