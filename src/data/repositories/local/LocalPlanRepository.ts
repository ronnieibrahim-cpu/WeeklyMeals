import { WeeklyPlan } from '@/domain/models';

import { PlanRepository } from '../PlanRepository';
import { kvStore } from './kvStore';

const KEY = 'wm:plan:v1';

export class LocalPlanRepository implements PlanRepository {
  load(): Promise<WeeklyPlan | null> {
    return kvStore.getJSON<WeeklyPlan>(KEY);
  }

  save(plan: WeeklyPlan): Promise<void> {
    return kvStore.setJSON(KEY, plan);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localPlanRepository = new LocalPlanRepository();
