import { WeeklyPlan } from '@/domain/models';

/** Persistence boundary for the rolling per-device plan history archive (M5.0). */
export interface PlanHistoryRepository {
  load(): Promise<WeeklyPlan[] | null>;
  save(history: WeeklyPlan[]): Promise<void>;
  clear(): Promise<void>;
}
