import { WeeklyPlan } from '@/domain/models';

import { PlanHistoryRepository } from '../PlanHistoryRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:planHistory:v1';

/** Keep half a year of weeks; older ones age out. */
export const HISTORY_LIMIT = 26;

export const localPlanHistoryRepository: PlanHistoryRepository = {
  load() {
    return kvStore.getJSON<WeeklyPlan[]>(KEY);
  },
  save(plans) {
    return kvStore.setJSON(KEY, plans.slice(0, HISTORY_LIMIT));
  },
  clear() {
    return kvStore.remove(KEY);
  },
};
