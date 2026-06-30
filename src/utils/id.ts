/** Compact, dependency-free unique id (sortable-ish by creation time). */
export function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
