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

/** Same lower/trim/whitespace normalization `canonicalIngredientName` does,
 * but WITHOUT the trailing-s fold — the raw form the fold is applied to. */
function normalizeRaw(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Name-fold audit (the check `ingredientKey.ts` references). For each
 * canonical key, the distinct RAW spellings that fold onto it. Two outcomes:
 *  - `pluralMerges`: a canonical key reached from 2+ distinct raw spellings —
 *    always an {X, Xs} pair by construction of the single-trailing-s fold.
 *    Almost always a legitimate plural (carrot/carrots), but a mass noun
 *    ("molasses"→"molasse") folds the same way, so these are surfaced for a
 *    human eye, INFO-only (they still form a unique key — harmless unless a
 *    different real ingredient shares it, which is the hard check below).
 *  - `collisions`: a raw spelling that folds onto a canonical key it is
 *    NEITHER equal to NOR the `+"s"` plural of — impossible under today's
 *    fold, so this is a forward guard: if the fold is ever made lossier and
 *    starts merging genuinely different ingredients, this fails loudly.
 */
function nameFoldAudit(recipes: Recipe[]): {
  pluralMerges: [string, string[]][];
  collisions: [string, string[]][];
} {
  const byCanonical = new Map<string, Set<string>>();
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const canonical = canonicalIngredientName(ing.name);
      const set = byCanonical.get(canonical) ?? new Set<string>();
      set.add(normalizeRaw(ing.name));
      byCanonical.set(canonical, set);
    }
  }
  const pluralMerges: [string, string[]][] = [];
  const collisions: [string, string[]][] = [];
  for (const [canonical, raws] of byCanonical) {
    if (raws.size > 1) pluralMerges.push([canonical, [...raws].sort()]);
    const bad = [...raws].filter((r) => r !== canonical && r !== `${canonical}s`);
    if (bad.length > 0) collisions.push([canonical, bad.sort()]);
  }
  return { pluralMerges, collisions };
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

// Name-fold audit (the check `ingredientKey.ts`'s doc comment references).
const foldAudit = nameFoldAudit(handAuthored);
if (foldAudit.pluralMerges.length > 0) {
  console.log(
    `INFO — ${foldAudit.pluralMerges.length} canonical key(s) among curated recipes reached from more than one ` +
      `spelling via the plural fold (verify each is a true plural, not a lossy fold of a mass noun):`,
  );
  for (const [canonical, raws] of foldAudit.pluralMerges) {
    console.log(`  - "${canonical}" ← ${raws.map((r) => `"${r}"`).join(', ')}`);
  }
  console.log('');
}

const failures = handAuthoredViolations.length + foldAudit.collisions.length;
if (failures === 0) {
  console.log(
    'PASS ✅ — no cross-family unit inconsistencies and no non-plural name-fold collisions among curated mains + sides.',
  );
  process.exit(0);
}

if (handAuthoredViolations.length > 0) {
  console.log(`FAIL ❌ — ${handAuthoredViolations.length} cross-family group(s) among curated mains + sides:\n`);
  for (const [canonical, occs] of handAuthoredViolations) {
    console.log(`  "${canonical}":`);
    for (const o of occs) {
      console.log(`    - ${o.recipeId}: "${o.ingredientName}" (${o.unit}, family=${o.family})`);
    }
  }
  console.log('\nHand-align these to one unit family (edit the curated seed file directly — never recipeImported.ts).');
}

if (foldAudit.collisions.length > 0) {
  console.log(
    `\nFAIL ❌ — ${foldAudit.collisions.length} canonical key(s) reached by a NON-plural fold (two different ` +
      `ingredients would merge into one shopping-list line):`,
  );
  for (const [canonical, bad] of foldAudit.collisions) {
    console.log(`  - "${canonical}" ← unexpected raw spelling(s) ${bad.map((r) => `"${r}"`).join(', ')}`);
  }
}
process.exit(1);
