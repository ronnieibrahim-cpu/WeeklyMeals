import { Department, Recipe } from '@/domain/models';

/** Identity key for a manual grocery item (M3.3) — trimmed, lowercased,
 * whitespace-collapsed, so "Milk", " milk ", and "milk" are the same item. */
export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const FALLBACK_DEPARTMENT: Department = 'DryGoods';

/**
 * Most common department each ingredient name appears under across the
 * recipe library, used to auto-guess a manual item's department. Ties
 * (equally common departments) keep whichever was seen first — a guess
 * doesn't need to be perfect, just a reasonable starting point the user can
 * correct.
 */
export function buildDepartmentGuessMap(recipes: Recipe[]): Record<string, Department> {
  const counts = new Map<string, Map<Department, number>>();
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const key = normalizeItemName(ing.name);
      const byDept = counts.get(key) ?? new Map<Department, number>();
      byDept.set(ing.department, (byDept.get(ing.department) ?? 0) + 1);
      counts.set(key, byDept);
    }
  }

  const out: Record<string, Department> = {};
  for (const [name, byDept] of counts) {
    let best: Department | null = null;
    let bestCount = -1;
    for (const [dept, count] of byDept) {
      if (count > bestCount) {
        best = dept;
        bestCount = count;
      }
    }
    if (best) out[name] = best;
  }
  return out;
}

/** Guess a manual item's department from its name, falling back to a
 * generic bucket for anything the recipe library has never seen. */
export function guessDepartment(name: string, guessMap: Record<string, Department>): Department {
  return guessMap[normalizeItemName(name)] ?? FALLBACK_DEPARTMENT;
}
