/**
 * Photo matcher for curated recipes (M3.0b) — licensed sources ONLY.
 *
 *   npx tsx --tsconfig ./tsconfig.json scripts/importPhotos.ts
 *
 * Goal: photo-realistic, ACCURATE images for as many of the 230 curated
 * recipes as possible. A wrong photo is worse than no photo, so this script
 * never guesses — it only proposes a match on a strong name/dish match
 * (exact or near-exact, plus a protein sanity check when the recipe's own
 * name references a protein), and everything else is left alone (the
 * existing per-cuisine tile fallback keeps working).
 *
 * Sources, in priority order:
 *   1. TheMealDB (https://www.themealdb.com) — same free API already used by
 *      scripts/importRecipes.ts. Attribution: "courtesy of TheMealDB.com".
 *   2. Wikimedia Commons, queried via the Openverse API
 *      (https://api.openverse.org) — filtered to CC0/Public Domain/CC-BY/
 *      CC-BY-SA/CC-BY-ND (never NC — noncommercial-licensed images are
 *      excluded outright). Openverse's `attribution` field is used verbatim
 *      as the in-app credit line.
 *
 * This script does NOT touch the app. It writes two files:
 *   - PHOTO-REVIEW.md — human-readable list of every proposed match, for the
 *     Product Owner to review and reject any that are wrong before anything
 *     is wired in.
 *   - scripts/photoCandidates.json — the same data, machine-readable, so the
 *     follow-up wiring step (after approval) doesn't need to re-run the
 *     matching/network calls.
 * Recipes that already have a curated photo (src/data/recipeImages.ts,
 * Stage 1) are left untouched and not re-proposed.
 */
import fs from 'fs';

import { RECIPES } from '@/data/seed/recipes';
import { RECIPE_IMAGE_URLS } from '@/data/recipeImages';
import { Protein, Recipe } from '@/domain/models';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOPWORDS = new Set(['with', 'and', 'the', 'a', 'an', 'of', 'in', 'style', 'recipe']);

/** Trailing-s plural fold so "fajita"/"fajitas" compare equal. */
const singularize = (w: string) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w);

function tokenSet(s: string): Set<string> {
  return new Set(
    norm(s)
      .split(' ')
      .filter((w) => w && !STOPWORDS.has(w))
      .map(singularize),
  );
}

const setsEqual = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));
const isSubset = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x));

/** Protein keywords checked against a candidate's name/ingredients — guards
 * against the exact failure mode Stage 1 hit by hand (a same-family dish
 * name matching a photo of a different protein, e.g. "tofu shawarma" vs a
 * lamb shawarma photo). Only enforced when the curated recipe's OWN name
 * mentions one of these keywords; dishes that don't name their protein
 * (Shakshuka, Ratatouille, ...) rely on the dish-name match alone. */
const PROTEIN_KEYWORDS: Partial<Record<Protein, string[]>> = {
  Chicken: ['chicken'],
  Beef: ['beef', 'steak', 'brisket'],
  Pork: ['pork', 'bacon', 'ham', 'sausage', 'chorizo'],
  Fish: ['fish', 'salmon', 'cod', 'tilapia', 'tuna', 'trout', 'halibut', 'snapper', 'catfish', 'mahi'],
  Shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'shellfish'],
  Turkey: ['turkey'],
  Lamb: ['lamb'],
  Tofu: ['tofu'],
  Beans: ['bean', 'beans', 'chickpea', 'chickpeas'],
  Lentils: ['lentil', 'lentils'],
  Eggs: ['egg', 'eggs'],
};

/** Every protein keyword (any protein) found in the curated recipe's own name. */
function proteinKeywordsInName(recipe: Recipe): string[] {
  const nameTokens = tokenSet(recipe.name);
  const found: string[] = [];
  for (const keywords of Object.values(PROTEIN_KEYWORDS)) {
    for (const kw of keywords ?? []) {
      if (nameTokens.has(singularize(kw))) found.push(kw);
    }
  }
  return found;
}

/** True unless the recipe's name names a protein that's absent from `haystack`. */
function passesProteinCheck(recipe: Recipe, haystack: string): boolean {
  const named = proteinKeywordsInName(recipe);
  if (named.length === 0) return true; // dish name doesn't reference a protein — name match alone disambiguates
  const h = norm(haystack);
  return named.some((kw) => h.includes(kw));
}

interface PhotoCandidate {
  recipeId: string;
  recipeName: string;
  imageUrl: string;
  source: 'themealdb' | 'wikimedia';
  license: string;
  attribution: string;
  attributionUrl?: string;
  confidence: 'exact' | 'strong';
  matchNote: string;
}

// ---------------------------------------------------------------------------
// TheMealDB
// ---------------------------------------------------------------------------

interface MealDbMeal {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
  strCategory?: string;
  [key: `strIngredient${number}`]: string | undefined;
}

async function fetchAllMealDbMeals(): Promise<MealDbMeal[]> {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const byId: Record<string, MealDbMeal> = {};
  for (const letter of letters) {
    try {
      const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${letter}`);
      const data = (await res.json()) as { meals: MealDbMeal[] | null };
      for (const m of data.meals ?? []) byId[m.idMeal] = m;
    } catch (e) {
      console.error('TheMealDB fetch failed for letter', letter, e);
    }
    await sleep(150);
  }
  return Object.values(byId);
}

function mealDbIngredientText(m: MealDbMeal): string {
  const parts: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const v = m[`strIngredient${i}`];
    if (v) parts.push(v);
  }
  return parts.join(' ');
}

function matchMealDb(recipe: Recipe, meals: MealDbMeal[]): PhotoCandidate | null {
  const recipeTokens = tokenSet(recipe.name);
  let best: { meal: MealDbMeal; confidence: 'exact' | 'strong' } | null = null;

  for (const meal of meals) {
    const mealTokens = tokenSet(meal.strMeal);
    let confidence: 'exact' | 'strong' | null = null;
    if (setsEqual(recipeTokens, mealTokens)) confidence = 'exact';
    else if (
      (isSubset(recipeTokens, mealTokens) || isSubset(mealTokens, recipeTokens)) &&
      Math.abs(recipeTokens.size - mealTokens.size) <= 1
    ) {
      confidence = 'strong';
    }
    if (!confidence) continue;
    if (!passesProteinCheck(recipe, `${meal.strMeal} ${meal.strCategory ?? ''} ${mealDbIngredientText(meal)}`)) {
      continue;
    }
    // Prefer an exact match over a strong one if we find both.
    if (!best || (confidence === 'exact' && best.confidence === 'strong')) {
      best = { meal, confidence };
    }
  }

  if (!best) return null;
  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    imageUrl: best.meal.strMealThumb,
    source: 'themealdb',
    license: 'TheMealDB (free tier, attribution required)',
    attribution: 'Photo courtesy of TheMealDB.com',
    attributionUrl: 'https://www.themealdb.com',
    confidence: best.confidence,
    matchNote: `Matched TheMealDB "${best.meal.strMeal}"${best.meal.strCategory ? ` (${best.meal.strCategory})` : ''}.`,
  };
}

// ---------------------------------------------------------------------------
// Wikimedia Commons via Openverse
// ---------------------------------------------------------------------------

interface OpenverseResult {
  title: string;
  url: string;
  foreign_landing_url: string;
  creator: string;
  license: string;
  license_version: string;
  attribution: string;
}

// Never NC (noncommercial) — everything else that only requires attribution
// (or nothing, for CC0/public domain) is fine for unmodified display.
const ALLOWED_LICENSES = new Set(['cc0', 'pdm', 'by', 'by-sa', 'by-nd']);

function formatLicense(license: string, version: string): string {
  if (license === 'cc0') return `CC0 ${version}`.trim();
  if (license === 'pdm') return 'Public Domain';
  return `CC ${license.toUpperCase()} ${version}`.trim();
}

async function matchOpenverse(recipe: Recipe): Promise<PhotoCandidate | null> {
  const query = encodeURIComponent(recipe.name);
  let data: { results: OpenverseResult[] };
  try {
    const res = await fetch(
      `https://api.openverse.org/v1/images/?q=${query}&source=wikimedia&page_size=8`,
    );
    data = (await res.json()) as { results: OpenverseResult[] };
  } catch (e) {
    console.error('Openverse fetch failed for', recipe.name, e);
    return null;
  }

  const recipeTokens = tokenSet(recipe.name);
  for (const result of data.results ?? []) {
    if (!ALLOWED_LICENSES.has(result.license)) continue;
    const titleTokens = tokenSet(result.title);
    let confidence: 'exact' | 'strong' | null = null;
    if (setsEqual(recipeTokens, titleTokens)) confidence = 'exact';
    else if (isSubset(recipeTokens, titleTokens) && titleTokens.size - recipeTokens.size <= 2) {
      confidence = 'strong';
    }
    if (!confidence) continue;
    if (!passesProteinCheck(recipe, result.title)) continue;

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      imageUrl: result.url,
      source: 'wikimedia',
      license: formatLicense(result.license, result.license_version),
      attribution: result.attribution,
      attributionUrl: result.foreign_landing_url,
      confidence,
      matchNote: `Matched Wikimedia Commons "${result.title}" by ${result.creator || 'unknown creator'}.`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const curated = RECIPES.filter((r) => !r.sourceName);
  const withoutPhoto = curated.filter((r) => !RECIPE_IMAGE_URLS[r.id]);
  console.log(`${curated.length} curated recipes; ${withoutPhoto.length} without a photo yet.`);

  console.log('Fetching TheMealDB catalog...');
  const meals = await fetchAllMealDbMeals();
  console.log(`fetched ${meals.length} TheMealDB meals`);

  const candidates: PhotoCandidate[] = [];
  const stillUnmatched: Recipe[] = [];

  for (const recipe of withoutPhoto) {
    const mealDbMatch = matchMealDb(recipe, meals);
    if (mealDbMatch) {
      candidates.push(mealDbMatch);
      continue;
    }
    stillUnmatched.push(recipe);
  }
  console.log(`TheMealDB: ${candidates.length} proposed matches, ${stillUnmatched.length} still unmatched.`);

  console.log('Querying Openverse (Wikimedia Commons) for the rest...');
  const finalUnmatched: Recipe[] = [];
  let openverseCount = 0;
  for (const recipe of stillUnmatched) {
    const match = await matchOpenverse(recipe);
    if (match) {
      candidates.push(match);
      openverseCount += 1;
    } else {
      finalUnmatched.push(recipe);
    }
    await sleep(250);
  }
  console.log(`Wikimedia/Openverse: ${openverseCount} proposed matches, ${finalUnmatched.length} still unmatched.`);

  fs.writeFileSync('scripts/photoCandidates.json', JSON.stringify(candidates, null, 2) + '\n');

  const already = curated.length - withoutPhoto.length;
  const lines: string[] = [];
  lines.push('# PHOTO-REVIEW.md — M3.0b curated recipe photo candidates');
  lines.push('');
  lines.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/importPhotos.ts\`.`);
  lines.push('');
  lines.push(
    `${curated.length} curated recipes total. ${already} already have a photo from Stage 1 ` +
      `(\`src/data/recipeImages.ts\`) and are untouched by this run. Of the remaining ${withoutPhoto.length}:`,
  );
  lines.push('');
  lines.push(`- **${candidates.length} proposed matches** below — please review before anything is wired in.`);
  lines.push(
    `  - ${candidates.filter((c) => c.source === 'themealdb').length} from TheMealDB, ` +
      `${candidates.filter((c) => c.source === 'wikimedia').length} from Wikimedia Commons.`,
  );
  lines.push(
    `- **${finalUnmatched.length} recipes had no confident match** and will keep the clean tile fallback ` +
      `(a wrong photo is worse than no photo, so these were left alone rather than guessed).`,
  );
  lines.push('');
  lines.push('## How to review');
  lines.push('');
  lines.push(
    'Reply with any rejections by number (e.g. "reject 3, 17, 42") — everything else in this list will be ' +
      'wired into the app as-is. Tap/open the image URL to check it before approving.',
  );
  lines.push('');
  lines.push('## Proposed matches');
  lines.push('');
  lines.push('| # | Recipe (id) | Source | License | Confidence | Image | Note |');
  lines.push('|---|---|---|---|---|---|---|');
  candidates.forEach((c, i) => {
    lines.push(
      `| ${i + 1} | ${c.recipeName} (\`${c.recipeId}\`) | ${c.source === 'themealdb' ? 'TheMealDB' : 'Wikimedia Commons'} | ${c.license} | ${c.confidence} | [image](${c.imageUrl}) | ${c.matchNote} |`,
    );
  });
  lines.push('');
  lines.push('## No confident match (unchanged — tile fallback)');
  lines.push('');
  lines.push(
    finalUnmatched.length > 0
      ? finalUnmatched.map((r) => `- ${r.name} (\`${r.id}\`)`).join('\n')
      : '_None — every curated recipe now has either a photo or a proposed candidate._',
  );
  lines.push('');

  fs.writeFileSync('PHOTO-REVIEW.md', lines.join('\n'));
  console.log(`Wrote PHOTO-REVIEW.md (${candidates.length} candidates) and scripts/photoCandidates.json`);
}

main();
