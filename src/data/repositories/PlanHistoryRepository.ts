import { WeeklyPlan } from '@/domain/models';

/** Persistence boundary for past (archived) weekly plans, newest first. */
export interface PlanHistoryRepository {
  load(): Promise<WeeklyPlan[] | null>;
  save(plans: WeeklyPlan[]): Promise<void>;
  clear(): Promise<void>;
}
