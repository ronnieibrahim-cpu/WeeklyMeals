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

import { fromMealDb, normalize } from '@/data/import/normalize';
import { RECIPES } from '@/data/seed/recipes';
import { Recipe } from '@/domain/models';

const CAP_PER_CUISINE = 45;
const RAW_FIXTURE_PATH = 'src/data/import/themealdb-raw.json';
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function loadMealDbFixture(): Record<string, string>[] {
  return JSON.parse(fs.readFileSync(RAW_FIXTURE_PATH, 'utf-8'));
}

async function main() {
  // Dedupe only against hand-authored recipes (no sourceName), so re-running
  // regenerates the imported set cleanly rather than skipping itself.
  const curated = new Set(RECIPES.filter((r) => !r.sourceName).map((r) => norm(r.name)));

  const meals = loadMealDbFixture();
  console.log('loaded', meals.length, 'meals from', RAW_FIXTURE_PATH);

  const scored: { r: Recipe; score: number }[] = [];
  const seen = new Set<string>();
  for (const m of meals) {
    const r = normalize(fromMealDb(m));
    if (!r) continue;
    const key = norm(r.name);
    if (curated.has(key) || seen.has(key)) continue;
    seen.add(key);
    const realSource = r.sourceUrl && !r.sourceUrl.includes('themealdb.com/meal') ? 2 : 0;
    const score = realSource + Math.min(r.ingredients.length, 10) / 10 + Math.min(r.steps.length, 8) / 8;
    scored.push({ r, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const perCuisine: Record<string, number> = {};
  const out: Recipe[] = [];
  for (const { r } of scored) {
    if ((perCuisine[r.cuisine] ?? 0) >= CAP_PER_CUISINE) continue;
    perCuisine[r.cuisine] = (perCuisine[r.cuisine] ?? 0) + 1;
    out.push(r);
  }
  out.sort((a, b) => a.cuisine.localeCompare(b.cuisine) || a.name.localeCompare(b.name));

  const header =
    `import { Recipe } from '@/domain/models';\n\n` +
    `/**\n * Recipes imported from the web (TheMealDB) via scripts/importRecipes.ts.\n` +
    ` * GENERATED FILE — do not edit by hand; re-run the importer to refresh.\n` +
    ` * Every entry carries a citation (sourceName/sourceUrl) and is marked\n` +
    ` * \`estimated\` because times/nutrition are inferred, not hand-authored.\n */\n` +
    `export const recipeImported: Recipe[] = `;
  fs.writeFileSync('src/data/seed/recipeImported.ts', header + JSON.stringify(out, null, 2) + ';\n');
  console.log(`wrote ${out.length} imported recipes`, JSON.stringify(perCuisine));
}

main();
