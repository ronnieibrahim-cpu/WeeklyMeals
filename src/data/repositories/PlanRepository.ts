import { WeeklyPlan } from '@/domain/models';

/** Persistence boundary for the current weekly plan. */
export interface PlanRepository {
  load(): Promise<WeeklyPlan | null>;
  save(plan: WeeklyPlan): Promise<void>;
  clear(): Promise<void>;
}
