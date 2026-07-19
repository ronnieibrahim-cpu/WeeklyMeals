/**
 * M4.3 verification: generates a batch of varied weekly plans TWICE per
 * scenario — once with the waste-fit bonus disabled (`weightOverrides: {
 * wasteFit: 0 }`, i.e. the pre-M4.3 engine) and once with the default
 * weights — and reports the average number of whole-unit perishable
 * ingredients used by only one meal (dayIndex) that week ("half a cabbage,
 * no other use"). Mirrors scripts/checkCuratedWeighting.ts (M2.4) and
 * scripts/checkKidApprovedWeighting.ts (M3.2)'s approach for the same kind
 * of "measurable but bounded" scoring bonus. Run with:
 *
 *   npx tsx --tsconfig ./tsconfig.json scripts/checkWasteFit.ts
 *
 * Accept criterion (MILESTONE-4.md M4.3): across simulated weeks, the
 * average count of single-use whole-unit perishables is measurably lower
 * with the waste-fit bonus on than off. Standalone script rather than a
 * jest test, same reasoning as the other two: a distribution report over
 * randomized synthetic scenarios (the engine's own near-tie randomness),
 * not a deterministic pass/fail unit test.
 *
 * `RUNS = 100`: the waste-fit bonus is a deliberately modest tie-breaker
 * (WEIGHTS.wasteFit, kept under half of `variety`'s weight — see
 * recommendation/types.ts), so its effect on any single week is easily lost
 * in the engine's own near-tie randomness. Seeding that randomness
 * identically per baseline/bonus pair (see `withSeed` below) removes most of
 * the noise; RUNS=30 still flapped occasionally across different random
 * scenario seeds during tuning, RUNS=100 passed reliably across 8
 * independent seed bases tried (~2–6% reduction; also used to sweep
 * WEIGHTS.wasteFit itself — 0.5 landed clearly ahead of the original 0.35
 * with no gate broken, see WEIGHTS.wasteFit's comment) and runs in ~4s.
 */
import { createDefaultProfile, createIntakeFromProfile } from '@/domain/defaults';
import { Cuisine, PlannedMeal, Protein, Recipe } from '@/domain/models';
import { RECIPES } from '@/data/seed/recipes';
import { localRecommendationEngine } from '@/engine/recommendation/LocalRecommendationEngine';
import { GenerateContext } from '@/engine/recommendation/types';
import { isWholeUnitPerishable } from '@/engine/wasteFit';

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

const RECIPES_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

/**
 * The engine's own greedy main-selection loop breaks near-ties with
 * `Math.random()` (`pickNearBest` in LocalRecommendationEngine.ts) — as it
 * should for real use. But that means an unseeded baseline-vs-bonus pair for
 * the *same* scenario can end up choosing entirely different mains for
 * reasons that have nothing to do with the waste-fit weight, swamping the
 * (real but modest, by design — WEIGHTS.wasteFit is a tie-breaker) effect
 * being measured in unrelated noise. `composeSides`/`scoreSide` are pure
 * argmax, no randomness — so seeding `Math.random()` identically for the
 * baseline and bonus call of a given run aligns the random draws the main
 * loop consumes, isolating the comparison to what the waste-fit weight
 * actually changes (which mains/sides it tips) rather than an unrelated
 * re-roll of the whole week. Restored after each call so it never leaks into
 * anything else (including the two other harnesses this script also runs).
 */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function withSeed<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

/**
 * Count of whole-unit-perishable ingredient keys (name|unit) used by exactly
 * one day's plate (main + composed sides) across the whole week — the
 * "half a cabbage, no other use" case the waste-fit bonus targets.
 */
function singleUsePerishableCount(meals: PlannedMeal[]): number {
  const daysByKey = new Map<string, Set<number>>();
  for (const meal of meals) {
    const plateRecipes: Recipe[] = [];
    const main = RECIPES_BY_ID.get(meal.recipeId);
    if (main) plateRecipes.push(main);
    for (const sideId of meal.sideRecipeIds ?? []) {
      const side = RECIPES_BY_ID.get(sideId);
      if (side) plateRecipes.push(side);
    }

    for (const recipe of plateRecipes) {
      for (const ing of recipe.ingredients) {
        if (!isWholeUnitPerishable(ing)) continue;
        const key = `${ing.name.trim().toLowerCase()}|${ing.unit}`;
        if (!daysByKey.has(key)) daysByKey.set(key, new Set());
        daysByKey.get(key)!.add(meal.dayIndex);
      }
    }
  }

  let singleUse = 0;
  for (const days of daysByKey.values()) {
    if (days.size === 1) singleUse += 1;
  }
  return singleUse;
}

function buildContext(run: number, overrides?: GenerateContext['weightOverrides']): GenerateContext {
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

  return {
    intake,
    profile,
    pantry: [],
    season: (['spring', 'summer', 'fall', 'winter'] as const)[run % 4],
    weightOverrides: overrides,
  };
}

const RUNS = 100;
const baselineCounts: number[] = [];
const bonusCounts: number[] = [];

for (let run = 0; run < RUNS; run++) {
  const seed = 1000 + run * 733;

  const baselineCtx = buildContext(run, { wasteFit: 0 });
  const baselineMeals = withSeed(seed, () => localRecommendationEngine.generate(baselineCtx, RECIPES));
  baselineCounts.push(singleUsePerishableCount(baselineMeals));

  const bonusCtx = buildContext(run); // default weights, wasteFit at its normal value
  const bonusMeals = withSeed(seed, () => localRecommendationEngine.generate(bonusCtx, RECIPES));
  bonusCounts.push(singleUsePerishableCount(bonusMeals));
}

const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
const baselineAvg = avg(baselineCounts);
const bonusAvg = avg(bonusCounts);

console.log(`Ran ${RUNS} generated weeks (7 dinners each), twice per scenario (baseline vs waste-fit bonus).\n`);
for (let i = 0; i < RUNS; i++) {
  console.log(`  week ${i + 1}: baseline=${baselineCounts[i]} single-use, with-bonus=${bonusCounts[i]} single-use`);
}

const reductionPct = baselineAvg === 0 ? 0 : (100 * (baselineAvg - bonusAvg)) / baselineAvg;
console.log(
  `\nAverage single-use whole-unit perishables per week: baseline=${baselineAvg.toFixed(2)}, ` +
    `with-bonus=${bonusAvg.toFixed(2)} (${reductionPct.toFixed(1)}% reduction).`,
);

const improved = bonusAvg < baselineAvg;

if (improved) {
  console.log(
    `\nPASS ✅ — the waste-fit bonus measurably reduces single-use whole-unit perishables ` +
      `(${baselineAvg.toFixed(2)} → ${bonusAvg.toFixed(2)}, ${reductionPct.toFixed(1)}% fewer).`,
  );
  process.exit(0);
} else {
  console.log(`\nFAIL ❌ — with-bonus average (${bonusAvg.toFixed(2)}) is not below baseline (${baselineAvg.toFixed(2)}).`);
  process.exit(1);
}
