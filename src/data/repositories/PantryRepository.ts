/** Persistence boundary for the user's reusable pantry (ingredients on hand). */
export interface PantryRepository {
  load(): Promise<string[] | null>;
  save(items: string[]): Promise<void>;
  clear(): Promise<void>;
}
