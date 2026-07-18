export interface CookModeProgress {
  index: number;
  /** Content-addressed identity of the plate (main id + sorted side ids)
   * this index was saved against (M4.2 part 2, `cookModePlateKey` in
   * engine/cookMode.ts). Lets a stale saved step be detected and reset
   * instead of silently pointing at different content after a side is
   * removed, swapped, or changes via sync. */
  plateKey: string;
}

/** planId:dayIndex -> progress. A bare `number` is the pre-M4.2 format
 * (still readable from disk on upgrade) — treated as unmigrated/stale, not
 * a crash; see `useCookModeStore.getStep`. */
export type CookModeSteps = Record<string, CookModeProgress | number>;

/** Persistence boundary for cook mode's "resume where I left off" step
 * (M3.4). Per-device only — never synced, since cooking is a real-time,
 * one-person activity. */
export interface CookModeRepository {
  load(): Promise<CookModeSteps | null>;
  save(steps: CookModeSteps): Promise<void>;
  clear(): Promise<void>;
}
