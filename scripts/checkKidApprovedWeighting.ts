/**
 * M3.2 verification: generates a batch of varied weekly plans with a
 * realistic set of recipes marked "Kids approved" and reports how much more
 * often they get picked than their share of the pool would predict by
 * chance — mirrors scripts/checkCuratedWeighting.ts (M2.4)'s approach for
 * exactly the same kind of "measurable but bounded" scoring bonus. Run with:
 *
 *   npx tsx --tsconfig ./tsconfig.json scripts/checkKidApprovedWeighting.ts
 *
 * Accept criterion (MILESTONE-3.md M3.2): kid-approved recipes are
 * measurably favored (picked well above their base rate in the pool) across
 * ~10 generated test weeks, but never dominate — non-kid-approved recipes
 * still make up the bulk of picks, and every week still includes some.
 * Standalone script rather than a jest test, same reasoning as
 * checkCuratedWeighting.ts: a distribution report over randomized synthetic
 * scenarios, not a deterministic pass/fail unit test.
 */
import { createDefaultProfile, createIntakeFromProfile } from '@/domain/defaults';
import { Cuisine, Protein } from '@/domain/models';
import { RECIPES } from '@/data/seed/recipes';
import { localRecommendationEngine } from '@/engine/recommendation/LocalRecommendationEngine';
import { GenerateContext } from '@/engine/recommendation/types';

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

// A realistic "family has marked a bunch of go-to meals" sample: every 18th
// recipe across the whole (curated + imported) 541-recipe library, so it
// spans cuisines/proteins rather than clustering in one corner of the pool.
const kidApprovedRecipeIds = RECIPES.filter((_, i) => i % 18 === 0).map((r) => r.id);
const baseRate = kidApprovedRecipeIds.length / RECIPES.length;

let totalPicks = 0;
let kidApprovedPicks = 0;
const perWeek: { kidApproved: number; total: number }[] = [];

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
    kidApprovedRecipeIds,
  };

  const meals = localRecommendationEngine.generate(ctx, RECIPES);
  const approved = meals.filter((m) => kidApprovedRecipeIds.includes(m.recipeId)).length;
  perWeek.push({ kidApproved: approved, total: meals.length });
  totalPicks += meals.length;
  kidApprovedPicks += approved;
}

console.log(
  `${kidApprovedRecipeIds.length}/${RECIPES.length} recipes marked kid-approved (${(baseRate * 100).toFixed(1)}% base rate).\n`,
);
console.log(`Ran ${RUNS} generated weeks (7 dinners each, ${totalPicks} total picks).\n`);
perWeek.forEach((w, i) => {
  console.log(`  week ${i + 1}: ${w.kidApproved}/${w.total} kid-approved`);
});

const actualRate = kidApprovedPicks / totalPicks;
const lift = actualRate / baseRate;
console.log(
  `\nOverall: ${kidApprovedPicks}/${totalPicks} picks kid-approved (${(actualRate * 100).toFixed(1)}%), ` +
    `vs ${(baseRate * 100).toFixed(1)}% base rate — ${lift.toFixed(1)}x lift.`,
);

const weeksWithNonApproved = perWeek.filter((w) => w.kidApproved < w.total).length;
const measurableNudge = lift > 1.3; // picked noticeably more than chance alone would predict
const notDominant = actualRate < 0.6 && weeksWithNonApproved === RUNS; // never buries everything else

if (measurableNudge && notDominant) {
  console.log(
    `\nPASS ✅ — kid-approved recipes are favored (${lift.toFixed(1)}x their base rate) without dominating ` +
      `(every week still included non-approved picks).`,
  );
  process.exit(0);
} else {
  console.log(`\nFAIL ❌ — measurableNudge=${measurableNudge} (lift=${lift.toFixed(2)}), notDominant=${notDominant}`);
  process.exit(1);
}
