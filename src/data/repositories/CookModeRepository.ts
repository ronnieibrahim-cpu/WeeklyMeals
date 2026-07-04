/** planId:dayIndex -> current step index. */
export type CookModeSteps = Record<string, number>;

/** Persistence boundary for cook mode's "resume where I left off" step
 * (M3.4). Per-device only — never synced, since cooking is a real-time,
 * one-person activity. */
export interface CookModeRepository {
  load(): Promise<CookModeSteps | null>;
  save(steps: CookModeSteps): Promise<void>;
  clear(): Promise<void>;
}
