import { WeeklyPlan } from '@/domain/models';

import { PlanRepository } from '../PlanRepository';
import { kvStore } from './kvStore';
import { isWeeklyPlan } from './shapeGuards';

const KEY = 'wm:draftPlan:v1';

/** A freshly generated plan pending review/approval — kept separate from
 * the active `plan` so a new week can't overwrite an already-approved one
 * (with its cooked progress) until the user explicitly approves it. */
export class LocalDraftPlanRepository implements PlanRepository {
  load(): Promise<WeeklyPlan | null> {
    return kvStore.getJSON<WeeklyPlan>(KEY, isWeeklyPlan);
  }

  save(plan: WeeklyPlan): Promise<void> {
    return kvStore.setJSON(KEY, plan);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localDraftPlanRepository = new LocalDraftPlanRepository();
