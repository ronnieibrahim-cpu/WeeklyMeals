/**
 * Recipe importer — regenerates src/data/seed/recipeImported.ts from a
 * committed snapshot of TheMealDB's raw API responses:
 *
 *   npx tsx --tsconfig ./tsconfig.json scripts/importRecipes.ts
 *
 * Source data is frozen in src/data/import/themealdb-raw.json (M4.2) rather
 * than fetched live on every run. This makes regeneration deterministic —
 * re-running after a normalize.ts change (e.g. adding `provides`) only
 * changes what the new logic changed, not also whatever happened to shift
 * upstream on TheMealDB since the last run. Refreshing the library with
 * genuinely new/changed upstream recipes is a deliberate, separate task:
 * re-fetch, overwrite themealdb-raw.json, and re-run this script.
 *
 * Each recipe is normalized into the app's Recipe shape by
 * src/data/import/normalize.ts, deduped against the hand-authored library,
 * balanced per cuisine, and cited. A blog/URL importer (schema.org/Recipe)
 * can be added alongside this using the same normalizer.
 */
import fs from 'fs';

import { IMPORT_DROPS, IMPORT_FIXES } from '@/data/import/importOverrides';
import { applyImportFix, fromMealDb, normalize } from '@/data/import/normalize';
import { RECIPES } from '@/data/seed/recipes';
import { isMain, Recipe } from '@/domain/models';

const CAP_PER_CUISINE = 45;
const RAW_FIXTURE_PATH = 'src/data/import/themealdb-raw.json';
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function loadMealDbFixture(): Record<string, string>[] {
  return JSON.parse(fs.readFileSync(RAW_FIXTURE_PATH, 'utf-8'));
}

async function main() {
  // Dedupe only against hand-authored MAINS (no sourceName), same as before
  // `RECIPES` gained sides (M4.2 part 2) — deliberately NOT extended to also
  // dedupe against side/sauce names in this commit, so regenerating
  // recipeImported.ts still produces byte-identical corpus membership. See
  // MILESTONE-4.md for the follow-up to dedupe against sides too.
  const curated = new Set(RECIPES.filter((r) => !r.sourceName && isMain(r)).map((r) => norm(r.name)));

  const meals = loadMealDbFixture();
  console.log('loaded', meals.length, 'meals from', RAW_FIXTURE_PATH);

  const scored: { r: Recipe; score: number; m: Record<string, string> }[] = [];
  const retired: Recipe[] = [];
  const seen = new Set<string>();
  for (const m of meals) {
    const r = normalize(fromMealDb(m));
    if (!r) continue;
    const key = norm(r.name);
    if (curated.has(key) || seen.has(key)) continue;
    seen.add(key);
    // Triage drops leave the pool BEFORE the cap, so the next candidate
    // refills the slot. The dropped recipe is kept (unfixed, exactly as it
    // shipped) only so saved plans/ratings/notes still resolve its id.
    if (IMPORT_DROPS[r.id]) {
      retired.push(r);
      continue;
    }
    const realSource = r.sourceUrl && !r.sourceUrl.includes('themealdb.com/meal') ? 2 : 0;
    const score = realSource + Math.min(r.ingredients.length, 10) / 10 + Math.min(r.steps.length, 8) / 8;
    scored.push({ r, score, m });
  }

  scored.sort((a, b) => b.score - a.score);
  const perCuisine: Record<string, number> = {};
  const out: Recipe[] = [];
  const next: Record<string, string[]> = {};
  for (const { r, m } of scored) {
    if ((perCuisine[r.cuisine] ?? 0) >= CAP_PER_CUISINE) {
      (next[r.cuisine] ??= []).push(`${r.id} ${r.name}`);
      continue;
    }
    perCuisine[r.cuisine] = (perCuisine[r.cuisine] ?? 0) + 1;
    // Fixes apply AFTER selection (scored on the unfixed text), so fixing a
    // recipe can never push a different recipe out of the corpus.
    const fix = IMPORT_FIXES[r.id];
    const fixed = fix ? normalize(applyImportFix(fromMealDb(m), fix), fix) : r;
    if (!fixed) throw new Error(`fix for ${r.id} makes it unusable`);
    out.push(fixed);
  }
  const outIds = new Set(out.map((r) => r.id));
  for (const id of Object.keys(IMPORT_FIXES)) {
    if (!outIds.has(id)) throw new Error(`IMPORT_FIXES has ${id}, which is not in the corpus`);
  }
  for (const id of Object.keys(IMPORT_DROPS)) {
    if (!retired.some((r) => r.id === id)) throw new Error(`IMPORT_DROPS has ${id}, which is not a candidate`);
  }
  out.sort((a, b) => a.cuisine.localeCompare(b.cuisine) || a.name.localeCompare(b.name));
  retired.sort((a, b) => a.id.localeCompare(b.id));

  const header =
    `import { Recipe } from '@/domain/models';\n\n` +
    `/**\n * Recipes imported from the web (TheMealDB) via scripts/importRecipes.ts.\n` +
    ` * GENERATED FILE — do not edit by hand; re-run the importer to refresh.\n` +
    ` * Every entry carries a citation (sourceName/sourceUrl) and is marked\n` +
    ` * \`estimated\` because times/nutrition are inferred, not hand-authored.\n */\n` +
    `export const recipeImported: Recipe[] = `;
  const retiredHeader =
    `\n/**\n * Imports dropped in triage (src/data/import/importOverrides.ts). NOT in\n` +
    ` * the planning pool — kept only so saved plans, ratings, favorites and\n` +
    ` * notes that point at these ids still resolve. Ids are never reused.\n */\n` +
    `export const recipeImportedRetired: Recipe[] = `;
  fs.writeFileSync(
    'src/data/seed/recipeImported.ts',
    header + JSON.stringify(out, null, 2) + ';\n' + retiredHeader + JSON.stringify(retired, null, 2) + ';\n',
  );
  console.log(`wrote ${out.length} imported recipes (+${retired.length} retired)`, JSON.stringify(perCuisine));
  if (process.env.SHOW_NEXT) for (const [c, ids] of Object.entries(next)) console.log('next', c, ids.slice(0, 5).join(' | '));
}

main();
