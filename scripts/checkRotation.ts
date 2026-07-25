/**
 * Cross-week rotation verification. Simulates the exact situation Ronnie
 * reported — "with just one week of data, three separate favorites were
 * placed into the following week's menu" — against the real recipe library,
 * and measures it twice per scenario:
 *
 *   BASELINE  the pre-rotation engine: no recency memory at all, favorites as
 *             a flat permanent +1.0 (`weightOverrides: { repeat: 0,
 *             favorite: 1.0 }` and no `recencyByRecipeId`, which together
 *             reproduce the old scoring exactly).
 *   ROTATION  the shipped engine: recency memory from week 1, the favorite
 *             rest ramp, the per-week favorite crowding taper and the repeat
 *             penalty.
 *
 * Each run generates week 1, hearts three of its mains, then generates week 2
 * with week 1 as history, and counts how much of week 1 came back.
 *
 * Run with:
 *   npx tsx --tsconfig ./tsconfig.json scripts/checkRotation.ts
 *
 * Accept criteria (all three must hold, or the script exits 1):
 *  1. Favorites returning to the very next week drop by at least half.
 *  2. Total week-1 mains returning to week 2 drop measurably.
 *  3. Week 2 is still FULL — rotation must never starve a week (the repeat
 *     penalty is a preference, not a filter).
 *
 * A standalone script rather than a jest test for the same reason as
 * checkWasteFit.ts/checkCuratedWeighting.ts: this is a distribution report
 * over randomized scenarios, not a deterministic pass/fail unit. The
 * deterministic pieces (ramp/taper/penalty shapes, weight discipline) are
 * covered in src/engine/rotation.test.ts and LocalRecommendationEngine.test.ts.
 */
import { createDefaultProfile, createIntakeFromProfile } from '@/domain/defaults';
import { Cuisine, PlannedMeal, Protein, WeeklyPlan } from '@/domain/models';
import { RECIPES } from '@/data/seed/recipes';
import { localRecommendationEngine } from '@/engine/recommendation/LocalRecommendationEngine';
import { GenerateContext } from '@/engine/recommendation/types';
import { recencyByRecipe } from '@/engine/rotation';

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

/** Same seeding rationale as checkWasteFit.ts: the engine breaks near-ties
 * with Math.random, so the baseline and rotation runs of a given scenario are
 * seeded identically to isolate what rotation actually changes. */
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

const DINNERS = 5;

function buildContext(run: number, extra: Partial<GenerateContext> = {}): GenerateContext {
  const profile = createDefaultProfile();
  profile.favoriteCuisines = pickFew(CUISINES, 3, run);
  profile.preferredProteins = pickFew(PROTEINS, 2, run + 3);
  profile.weeklyBudget = 100 + run * 15;
  profile.avgCookMinutes = 30 + run * 5;

  const intake = createIntakeFromProfile(profile);
  intake.dinners = DINNERS;
  intake.cuisines = pickFew(CUISINES, 2, run + 5);
  intake.proteins = pickFew(PROTEINS, 2, run + 1);
  intake.adventurousness = (run % 5) / 4;
  intake.healthyVsComfort = ((run + 2) % 5) / 4;

  return {
    intake,
    profile,
    pantry: [],
    season: (['spring', 'summer', 'fall', 'winter'] as const)[run % 4],
    ...extra,
  };
}

/** Week 1's meals as a plan dated one week before the week being planned, so
 * `recencyByRecipe` reads every one of its mains as "last week". */
function planFor(meals: PlannedMeal[]): WeeklyPlan {
  return {
    id: 'week-1',
    weekStartISO: '2026-07-19',
    intake: createIntakeFromProfile(createDefaultProfile()),
    meals,
    status: 'completed',
    createdAtISO: '2026-07-19T00:00:00.000Z',
  };
}

const REFERENCE_WEEK = '2026-07-26'; // week 2 starts exactly 7 days after week 1
const RUNS = 100;

interface Outcome {
  favoritesReturned: number;
  mainsReturned: number;
  weekSize: number;
}

function runScenario(run: number, rotationOn: boolean): Outcome {
  const seed = 2000 + run * 733;

  // Week 1 is generated identically either way — no history exists yet.
  const week1Ctx = buildContext(run);
  const week1 = withSeed(seed, () => localRecommendationEngine.generate(week1Ctx, RECIPES));

  // Heart three of week 1's dinners, the reported scenario exactly.
  const favoriteRecipeIds = week1.slice(0, 3).map((m) => m.recipeId);
  const week1Ids = new Set(week1.map((m) => m.recipeId));

  const week2Ctx = rotationOn
    ? buildContext(run, {
        favoriteRecipeIds,
        recencyByRecipeId: recencyByRecipe([planFor(week1)], REFERENCE_WEEK),
      })
    : buildContext(run, {
        favoriteRecipeIds,
        // No recency memory + a flat favorite bonus = the old engine.
        weightOverrides: { repeat: 0, favorite: 1.0 },
      });

  const week2 = withSeed(seed + 1, () => localRecommendationEngine.generate(week2Ctx, RECIPES));
  const week2Ids = week2.map((m) => m.recipeId);

  return {
    favoritesReturned: week2Ids.filter((id) => favoriteRecipeIds.includes(id)).length,
    mainsReturned: week2Ids.filter((id) => week1Ids.has(id)).length,
    weekSize: week2Ids.length,
  };
}

/**
 * The other half of the promise: "periodic reintroduction" has to actually
 * REINTRODUCE. Same setup, but week 1 sits `FAVORITE_REST_WEEKS` back, so its
 * dishes are fully rested — a hearted one should now return measurably more
 * often than the identical un-hearted dish does. Without this check, a rest
 * ramp that simply buried favorites forever would look like a pass above.
 */
function runRestedScenario(run: number, hearted: boolean): number {
  const seed = 2000 + run * 733;
  const week1Ctx = buildContext(run);
  const week1 = withSeed(seed, () => localRecommendationEngine.generate(week1Ctx, RECIPES));
  const candidateIds = week1.slice(0, 3).map((m) => m.recipeId);

  // Week 1 dated far enough back that every one of its mains is fully rested.
  const restedPlan: WeeklyPlan = { ...planFor(week1), weekStartISO: '2026-06-28' }; // 4 weeks before
  const ctx = buildContext(run, {
    favoriteRecipeIds: hearted ? candidateIds : [],
    recencyByRecipeId: recencyByRecipe([restedPlan], REFERENCE_WEEK),
  });

  const week2Ids = withSeed(seed + 1, () => localRecommendationEngine.generate(ctx, RECIPES)).map((m) => m.recipeId);
  return week2Ids.filter((id) => candidateIds.includes(id)).length;
}

const baseline: Outcome[] = [];
const rotation: Outcome[] = [];
const restedHearted: number[] = [];
const restedPlain: number[] = [];
for (let run = 0; run < RUNS; run++) {
  baseline.push(runScenario(run, false));
  rotation.push(runScenario(run, true));
  restedHearted.push(runRestedScenario(run, true));
  restedPlain.push(runRestedScenario(run, false));
}

const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
const favBaseline = avg(baseline.map((o) => o.favoritesReturned));
const favRotation = avg(rotation.map((o) => o.favoritesReturned));
const mainsBaseline = avg(baseline.map((o) => o.mainsReturned));
const mainsRotation = avg(rotation.map((o) => o.mainsReturned));
const shortWeeks = rotation.filter((o) => o.weekSize < DINNERS).length;

console.log(
  `Ran ${RUNS} two-week scenarios (${DINNERS} dinners each, 3 favorites hearted from week 1), ` +
    `twice per scenario: baseline (pre-rotation) vs rotation.\n`,
);
console.log(`  Favorites (of 3) returning to week 2:  baseline=${favBaseline.toFixed(2)}  rotation=${favRotation.toFixed(2)}`);
console.log(`  Week-1 mains (of ${DINNERS}) returning:      baseline=${mainsBaseline.toFixed(2)}  rotation=${mainsRotation.toFixed(2)}`);
console.log(`  Week 2 short of ${DINNERS} dinners:           ${shortWeeks} of ${RUNS}\n`);

const restedFavAvg = avg(restedHearted);
const restedPlainAvg = avg(restedPlain);
console.log(
  `  Rested (4 weeks) dishes returning:     hearted=${restedFavAvg.toFixed(2)}  not hearted=${restedPlainAvg.toFixed(2)}\n`,
);

const favHalved = favRotation <= favBaseline / 2;
const mainsImproved = mainsRotation < mainsBaseline;
const noStarvedWeeks = shortWeeks === 0;
// Reintroduction actually happens: a rested favorite outranks the identical
// un-hearted dish. (Rest suppresses a recent favorite; it must not erase the
// feature.)
const reintroduces = restedFavAvg > restedPlainAvg;

if (favHalved && mainsImproved && noStarvedWeeks && reintroduces) {
  console.log('Rotation works: favorites rest between appearances, weeks stop echoing each other, no week starved. ✅');
} else {
  if (!favHalved) console.error(`FAIL: favorites returning did not halve (${favBaseline.toFixed(2)} -> ${favRotation.toFixed(2)}).`);
  if (!mainsImproved) console.error(`FAIL: week-1 mains returning did not drop (${mainsBaseline.toFixed(2)} -> ${mainsRotation.toFixed(2)}).`);
  if (!noStarvedWeeks) console.error(`FAIL: ${shortWeeks} generated weeks came up short — rotation must never starve a week.`);
  if (!reintroduces) {
    console.error(
      `FAIL: rested favorites (${restedFavAvg.toFixed(2)}) do not come back more than un-hearted dishes ` +
        `(${restedPlainAvg.toFixed(2)}) — the rest ramp is suppressing favorites instead of pacing them.`,
    );
  }
  process.exit(1);
}
