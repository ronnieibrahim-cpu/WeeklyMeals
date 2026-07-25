/**
 * Re-roll pool size verification. Reported: "the re-roll pool is too small,
 * often only three." This measures, against the real recipe library and
 * realistic mid-week state (pantry + this week's shopping list assumed
 * bought), how many fully-cookable plates a re-roll can actually offer —
 * with and without the side-composition fix.
 *
 *   BASELINE  sides composed from the whole sides pool, as before: a
 *             perfectly cookable main is disqualified whenever the
 *             best-scoring side needs something not on hand.
 *   ON-HAND   sides composed from on-hand sides only (the shipped
 *             `coverableSides` behavior), so a main's eligibility depends on
 *             the main's own ingredients.
 *
 * Both counts are taken BEFORE the display cap, so this measures the real
 * candidate pool rather than the cap.
 *
 * Run with:
 *   npx tsx --tsconfig ./tsconfig.json scripts/checkRerollPool.ts
 *
 * Accept criteria: the on-hand pool is larger on average, no scenario gets
 * SMALLER (the filter can only remove uncookable sides, never good ones), and
 * every offered plate stays fully coverable — strictness (Law #2) is the
 * thing being preserved while the pool grows.
 */
import { createDefaultProfile, createIntakeFromProfile } from '@/domain/defaults';
import { Cuisine, isMain, Protein, Recipe, WeeklyPlan } from '@/domain/models';
import { RECIPES } from '@/data/seed/recipes';
import { composeSides } from '@/engine/mealComposition';
import { localRecommendationEngine } from '@/engine/recommendation/LocalRecommendationEngine';
import { passesHardFilters } from '@/engine/recommendation/filters';
import { GenerateContext } from '@/engine/recommendation/types';
import { canonicalIngredientName } from '@/engine/ingredientKey';
import { missingIngredients, missingIngredientsForPlate, rerollCandidates } from '@/engine/reroll';

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

const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
const SIDES_POOL = RECIPES.filter((r) => !isMain(r));

function buildContext(run: number): GenerateContext {
  const profile = createDefaultProfile();
  profile.favoriteCuisines = pickFew(CUISINES, 3, run);
  profile.preferredProteins = pickFew(PROTEINS, 2, run + 3);
  profile.weeklyBudget = 100 + run * 15;

  const intake = createIntakeFromProfile(profile);
  intake.dinners = 5;
  intake.cuisines = pickFew(CUISINES, 2, run + 5);
  intake.proteins = pickFew(PROTEINS, 2, run + 1);
  intake.adventurousness = (run % 5) / 4;
  intake.healthyVsComfort = ((run + 2) % 5) / 4;

  return {
    intake,
    profile,
    pantry: [],
    season: (['spring', 'summer', 'fall', 'winter'] as const)[run % 4],
  };
}

/**
 * Mid-week reality: everything this week's plates need is assumed bought (it
 * was on the shopping list), which is exactly what `availableIngredients`
 * builds from pantry + list + the outgoing plate.
 */
function availableFor(plan: WeeklyPlan): Set<string> {
  const set = new Set<string>();
  for (const meal of plan.meals) {
    for (const id of [meal.recipeId, ...(meal.sideRecipeIds ?? [])]) {
      const recipe = BY_ID.get(id);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) set.add(canonicalIngredientName(ing.name));
    }
  }
  return set;
}

/** The pre-fix rule: compose from every side, then require the whole plate to
 * be coverable. Counts candidates before any display cap. */
function baselinePoolSize(plan: WeeklyPlan, dayIndex: number, available: Set<string>, ctx: GenerateContext): number {
  const usedIds = new Set(plan.meals.map((m) => m.recipeId));
  const selectedRecipes = plan.meals
    .filter((m) => m.dayIndex !== dayIndex)
    .map((m) => BY_ID.get(m.recipeId))
    .filter((r): r is Recipe => !!r);

  let coverable = 0;
  for (const main of RECIPES.filter(isMain)) {
    if (usedIds.has(main.id) || !passesHardFilters(main, ctx.intake, ctx.profile)) continue;
    const sideIds = composeSides(main, SIDES_POOL, { ...ctx, weekRecipes: selectedRecipes });
    const sides = sideIds.map((id) => BY_ID.get(id)).filter((s): s is Recipe => !!s);
    if (missingIngredientsForPlate(main, sides, available).length === 0) coverable += 1;
  }
  return coverable;
}

/** The shipped rule, counted the same way (before the display cap): compose
 * from on-hand sides only. */
function onHandPoolSize(plan: WeeklyPlan, dayIndex: number, available: Set<string>, ctx: GenerateContext): number {
  const usedIds = new Set(plan.meals.map((m) => m.recipeId));
  const selectedRecipes = plan.meals
    .filter((m) => m.dayIndex !== dayIndex)
    .map((m) => BY_ID.get(m.recipeId))
    .filter((r): r is Recipe => !!r);
  const onHandSides = SIDES_POOL.filter((s) => missingIngredients(s, available).length === 0);

  let coverable = 0;
  for (const main of RECIPES.filter(isMain)) {
    if (usedIds.has(main.id) || !passesHardFilters(main, ctx.intake, ctx.profile)) continue;
    const sideIds = composeSides(main, onHandSides, { ...ctx, weekRecipes: selectedRecipes });
    const sides = sideIds.map((id) => BY_ID.get(id)).filter((s): s is Recipe => !!s);
    if (missingIngredientsForPlate(main, sides, available).length === 0) coverable += 1;
  }
  return coverable;
}

const RUNS = 60;
const baselineSizes: number[] = [];
const onHandSizes: number[] = [];
let offeredTotal = 0;
let uncookableOffered = 0;

for (let run = 0; run < RUNS; run++) {
  const ctx = buildContext(run);
  const meals = localRecommendationEngine.generate(ctx, RECIPES);
  const plan: WeeklyPlan = {
    id: `plan-${run}`,
    weekStartISO: '2026-07-19',
    intake: ctx.intake,
    meals,
    status: 'approved',
    createdAtISO: '2026-07-19T00:00:00.000Z',
  };
  const available = availableFor(plan);

  baselineSizes.push(baselinePoolSize(plan, 0, available, ctx));
  onHandSizes.push(onHandPoolSize(plan, 0, available, ctx));

  // What the screen actually offers must still be cookable in full.
  const outcome = rerollCandidates(plan, 0, RECIPES, (id) => BY_ID.get(id), available, ctx);
  for (const candidate of outcome.candidates) {
    offeredTotal += 1;
    const sides = candidate.sideRecipeIds.map((id) => BY_ID.get(id)).filter((s): s is Recipe => !!s);
    if (missingIngredientsForPlate(candidate.recipe, sides, available).length > 0) uncookableOffered += 1;
  }
}

const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
const baselineAvg = avg(baselineSizes);
const onHandAvg = avg(onHandSizes);
const shrank = baselineSizes.filter((n, i) => onHandSizes[i] < n).length;
const thinBefore = baselineSizes.filter((n) => n < 5).length;
const thinAfter = onHandSizes.filter((n) => n < 5).length;

console.log(`Ran ${RUNS} mid-week re-roll scenarios against the real library (5-dinner weeks, day 0 re-rolled).\n`);
console.log(`  Fully-cookable plates available:  baseline=${baselineAvg.toFixed(1)}  on-hand sides=${onHandAvg.toFixed(1)}`);
console.log(`  Scenarios offering fewer than 5:  baseline=${thinBefore}/${RUNS}  on-hand sides=${thinAfter}/${RUNS}`);
console.log(`  Scenarios where the pool shrank:  ${shrank}`);
console.log(`  Offered plates that were not fully cookable: ${uncookableOffered} of ${offeredTotal}\n`);

const bigger = onHandAvg > baselineAvg;
const neverSmaller = shrank === 0;
const strict = uncookableOffered === 0;

if (bigger && neverSmaller && strict) {
  console.log('Re-roll pool is larger, never smaller, and every offered plate is still fully cookable. ✅');
} else {
  if (!bigger) console.error(`FAIL: pool did not grow (${baselineAvg.toFixed(1)} -> ${onHandAvg.toFixed(1)}).`);
  if (!neverSmaller) console.error(`FAIL: ${shrank} scenarios got a SMALLER pool — the side filter must only remove uncookable sides.`);
  if (!strict) console.error(`FAIL: ${uncookableOffered} offered plates were not fully cookable — Law #2 violated.`);
  process.exit(1);
}
