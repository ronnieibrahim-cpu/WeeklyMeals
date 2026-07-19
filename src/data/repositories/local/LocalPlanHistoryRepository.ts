import { WeeklyPlan } from '@/domain/models';

import { PlanHistoryRepository } from '../PlanHistoryRepository';
import { kvStore } from './kvStore';
import { isWeeklyPlan } from './shapeGuards';

const KEY = 'wm:planHistory:v1';

function isWeeklyPlanArray(value: unknown): value is WeeklyPlan[] {
  return Array.isArray(value) && value.every((v) => isWeeklyPlan(v));
}

/** M5.0: the rolling per-device archive of completed weeks — see
 * `planHistoryStore.ts` for why this never goes through household sync. */
export class LocalPlanHistoryRepository implements PlanHistoryRepository {
  load(): Promise<WeeklyPlan[] | null> {
    return kvStore.getJSON<WeeklyPlan[]>(KEY, isWeeklyPlanArray);
  }

  save(history: WeeklyPlan[]): Promise<void> {
    return kvStore.setJSON(KEY, history);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localPlanHistoryRepository = new LocalPlanHistoryRepository();
