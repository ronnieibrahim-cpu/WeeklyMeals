/**
 * M2.4 verification: generates a batch of varied weekly plans and reports
 * what fraction of picks are hand-curated (id not prefixed `mealdb-`) vs
 * imported. Run with:
 *
 *   npx tsx --tsconfig ./tsconfig.json scripts/checkCuratedWeighting.ts
 *
 * Accept criterion (MILESTONE-2.md M2.4): across ~10 generated test weeks,
 * curated recipes make up a clear majority of picks while imported recipes
 * still appear. This intentionally stays a standalone script rather than a
 * jest test (M2.5 added `npm test` for the engine folder): it's a tuning/
 * distribution report over randomized synthetic scenarios, not a
 * deterministic pass/fail unit test.
 */
import { createDefaultProfile, createIntakeFromProfile } from '@/domain/defaults';
import { Cuisine, Protein } from '@/domain/models';
import { localRecommendationEngine } from '@/engine/recommendation/LocalRecommendationEngine';
import { GenerateContext } from '@/engine/recommendation/types';
import { RECIPES } from '@/data/seed/recipes';

const CUISINES: Cuisine[] = [
  'Italian', 'Mexican', 'Greek', 'Indian', 'Thai', 'Japanese',
  'Chinese', 'French', 'Mediterranean', 'American', 'MiddleEastern', 'BBQ',
];
const PROTEINS: Protein[] = ['Chicken', 'Beef', 'Pork', 'Fish', 'Shellfish', 'Tofu', 'Beans', 'Lentils', 'Eggs', 'Lamb', 'None'];

function pickFew<T>(arr: T[], n: number, seed: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(seed + i * 7) % arr.length]);
  return Array.from(new Set(out));
}

let totalPicks = 0;
let curatedPicks = 0;
let importedPicks = 0;
const perWeek: { curated: number; imported: number }[] = [];

const RUNS = 10;
for (let run = 0; run < RUNS; run++) {
  const profile = createDefaultProfile();
  profile.favoriteCuisines = pickFew(CUISINES, 3, run);
  profile.preferredProteins = pickFew(PROTEINS, 2, run + 3);
  profile.weeklyBudget = 100 + run * 15;
  profile.avgCookMinutes = 30 + run * 5;

  const intake = createIntakeFromProfile(profile);
  intake.dinners = 7;
  intake.cuisines = pickFew(CUISINES, 2, run + 5);
  intake.proteins = pickFew(PROTEINS, 2, run + 1);
  intake.adventurousness = (run % 5) / 4; // sweep 0..1
  intake.healthyVsComfort = ((run + 2) % 5) / 4;

  const ctx: GenerateContext = {
    intake,
    profile,
    pantry: [],
    season: (['spring', 'summer', 'fall', 'winter'] as const)[run % 4],
  };

  const meals = localRecommendationEngine.generate(ctx, RECIPES);
  const curated = meals.filter((m) => !m.recipeId.startsWith('mealdb-')).length;
  const imported = meals.length - curated;
  perWeek.push({ curated, imported });
  totalPicks += meals.length;
  curatedPicks += curated;
  importedPicks += imported;
}

console.log(`Ran ${RUNS} generated weeks (7 dinners each, ${totalPicks} total picks).\n`);
perWeek.forEach((w, i) => {
  console.log(`  week ${i + 1}: ${w.curated} curated / ${w.imported} imported`);
});

const curatedPct = (100 * curatedPicks) / totalPicks;
console.log(
  `\nOverall: ${curatedPicks} curated (${curatedPct.toFixed(1)}%), ${importedPicks} imported (${(100 - curatedPct).toFixed(1)}%).`,
);

const weeksWithImported = perWeek.filter((w) => w.imported > 0).length;
const majorityCurated = curatedPct > 50;

if (majorityCurated && importedPicks > 0) {
  console.log(
    `\nPASS ✅ — curated is a clear majority (${curatedPct.toFixed(1)}%) and imported recipes still appear (${weeksWithImported}/${RUNS} weeks included at least one).`,
  );
  process.exit(0);
} else {
  console.log(`\nFAIL ❌ — majorityCurated=${majorityCurated}, importedPicks=${importedPicks}`);
  process.exit(1);
}
