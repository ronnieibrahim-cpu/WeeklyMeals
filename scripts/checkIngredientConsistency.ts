/**
 * M4.7 repo-hygiene harness (pattern: scripts/checkCuratedWeighting.ts). Not
 * wired into CI — run by hand with:
 *
 *   npx tsx --tsconfig ./tsconfig.json scripts/checkIngredientConsistency.ts
 *
 * Scans every recipe's ingredients for groups that share a
 * `canonicalIngredientName` (the same identity `src/engine/shoppingList.ts`
 * now dedupes shopping-list lines by) but whose units span more than one
 * unit FAMILY — e.g. "cotija cheese" appearing as both `oz` (mass) and
 * `cup` (volume) across different recipes. Two mass units or two volume
 * units for the same ingredient are NOT a problem — `mergeQuantities`
 * converts and merges those automatically at shopping-list build time. A
 * cross-family split (mass vs volume, or either vs a non-convertible unit
 * like "piece") can't be converted, so it's worth a human eye: is this
 * really the same ingredient measured two incompatible ways (a genuine data
 * inconsistency worth hand-aligning), or two different things that just
 * share a name?
 *
 * FAILS (non-zero exit) if any such cross-family group exists among the
 * hand-curated recipes (230 mains + 50 sides/sauces — `id` NOT prefixed
 * `mealdb-`, same split `scripts/validateRecipes.ts` uses) — those are
 * hand-authored and it's cheap to just pick one unit. Imported (`mealdb-`)
 * recipes are INFO-ONLY: their source text is the fidelity anchor (per
 * validateRecipes.ts's own rationale) and their unit choices are whatever
 * TheMealDB's original recipe used — not a violation to fix here, just
 * useful visibility. `shoppingList.ts` already merges within a family and
 * simply keeps cross-family lines separate, so an imported recipe's odd
 * unit (e.g. "piece" of flour) is a display quirk, not a correctness bug —
 * out of scope for this script's PASS/FAIL gate.
 */
import { Recipe, Unit } from '@/domain/models';
import { RECIPES } from '@/data/seed/recipes';
import { canonicalIngredientName, unitFamily } from '@/engine/ingredientKey';

interface Occurrence {
  recipeId: string;
  ingredientName: string;
  unit: Unit;
  family: string;
}

function groupByCanonicalName(recipes: Recipe[]): Map<string, Occurrence[]> {
  const groups = new Map<string, Occurrence[]>();
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const canonical = canonicalIngredientName(ing.name);
      const list = groups.get(canonical) ?? [];
      list.push({ recipeId: recipe.id, ingredientName: ing.name, unit: ing.unit, family: unitFamily(ing.unit) });
      groups.set(canonical, list);
    }
  }
  return groups;
}

function crossFamilyGroups(groups: Map<string, Occurrence[]>): [string, Occurrence[]][] {
  return Array.from(groups.entries()).filter(([, occs]) => new Set(occs.map((o) => o.family)).size > 1);
}

const handAuthored = RECIPES.filter((r) => !r.id.startsWith('mealdb-')); // curated mains + sides
const imported = RECIPES.filter((r) => r.id.startsWith('mealdb-'));

const handAuthoredGroups = groupByCanonicalName(handAuthored);
const importedGroups = groupByCanonicalName(imported);

const handAuthoredViolations = crossFamilyGroups(handAuthoredGroups);
const importedInfo = crossFamilyGroups(importedGroups);

console.log(
  `Checked ${handAuthored.length} hand-curated recipes (mains + sides) and ${imported.length} imported recipes ` +
    `for same-canonical-name ingredients spanning different unit families...\n`,
);

if (importedInfo.length > 0) {
  console.log(`INFO — ${importedInfo.length} cross-family group(s) among IMPORTED recipes (not a gate, FYI only):`);
  for (const [canonical, occs] of importedInfo) {
    const byFamily = Array.from(new Set(occs.map((o) => o.family))).join(', ');
    console.log(`  - "${canonical}" spans families [${byFamily}] across ${occs.length} occurrence(s)`);
  }
  console.log('');
}

if (handAuthoredViolations.length === 0) {
  console.log('PASS ✅ — no cross-family ingredient-unit inconsistencies among curated mains + sides.');
  process.exit(0);
}

console.log(`FAIL ❌ — ${handAuthoredViolations.length} cross-family group(s) among curated mains + sides:\n`);
for (const [canonical, occs] of handAuthoredViolations) {
  console.log(`  "${canonical}":`);
  for (const o of occs) {
    console.log(`    - ${o.recipeId}: "${o.ingredientName}" (${o.unit}, family=${o.family})`);
  }
}
console.log('\nHand-align these to one unit family (edit the curated seed file directly — never recipeImported.ts).');
process.exit(1);
