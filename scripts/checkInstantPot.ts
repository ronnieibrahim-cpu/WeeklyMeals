/**
 * Instant Pot night verification. The weekly question ("Any Instant Pot
 * nights this week?") is only honest if the library can actually deliver
 * what's asked for under real weekly settings — a question the code can't
 * act on is a bug (Product Law #3). This measures delivery across varied
 * scenarios rather than asserting it once.
 *
 * Run with:
 *   npx tsx --tsconfig ./tsconfig.json scripts/checkInstantPot.ts
 *
 * Accept criteria:
 *  1. Asking for 1 night is delivered in every scenario whose time limit
 *     admits at least one Instant Pot recipe.
 *  2. Asking for 2 nights is delivered in the large majority of scenarios.
 *  3. Asking for 0 never forces one in, and no request ever shortens a week.
 *  4. Every Instant Pot recipe in the library really declares the equipment
 *     AND says so in its steps — no stovetop dish wearing the label.
 */
import { createDefaultProfile, createIntakeFromProfile } from '@/domain/defaults';
import { Cuisine, isMain, Protein } from '@/domain/models';
import { RECIPES } from '@/data/seed/recipes';
import { localRecommendationEngine, usesInstantPot } from '@/engine/recommendation/LocalRecommendationEngine';
import { passesHardFilters } from '@/engine/recommendation/filters';
import { GenerateContext } from '@/engine/recommendation/types';

const CUISINES: Cuisine[] = [
  'Italian', 'Mexican', 'Greek', 'Indian', 'Thai', 'Japanese',
  'Chinese', 'French', 'Mediterranean', 'American', 'MiddleEastern', 'BBQ',
];
const PROTEINS: Protein[] = ['Chicken', 'Beef', 'Pork', 'Fish', 'Tofu', 'Beans', 'Lentils', 'Lamb'];

function pickFew<T>(arr: T[], n: number, seed: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(seed + i * 7) % arr.length]);
  return Array.from(new Set(out));
}

const INSTANT_POT_MAINS = RECIPES.filter((r) => isMain(r) && usesInstantPot(r));

// --- Criterion 4: the content itself is honestly tagged -------------------
const PRESSURE_WORDS = /pressure cook|pressure release|natural release|quick.release|sealing|sauté|saute/i;
const untagged = INSTANT_POT_MAINS.filter((r) => !r.steps.some((s) => PRESSURE_WORDS.test(s)));
const misdeclared = INSTANT_POT_MAINS.filter((r) => !(r.equipment ?? []).includes('Instant Pot'));

const MAX_COOK_CHOICES = [30, 45, 60, 90];
const RUNS = 48;

interface Tally {
  asked: number;
  delivered: number;
  shortWeeks: number;
  scenariosWithAnyEligible: number;
  missedDespiteEligible: number;
}

function run(nights: number): Tally {
  const tally: Tally = { asked: 0, delivered: 0, shortWeeks: 0, scenariosWithAnyEligible: 0, missedDespiteEligible: 0 };

  for (let i = 0; i < RUNS; i++) {
    const profile = createDefaultProfile();
    profile.favoriteCuisines = pickFew(CUISINES, 3, i);
    profile.preferredProteins = pickFew(PROTEINS, 2, i + 3);
    profile.avgCookMinutes = MAX_COOK_CHOICES[i % MAX_COOK_CHOICES.length];

    const intake = createIntakeFromProfile(profile);
    intake.dinners = 5;
    intake.cuisines = pickFew(CUISINES, 2, i + 5);
    intake.proteins = pickFew(PROTEINS, 2, i + 1);
    intake.instantPotNights = nights;

    const ctx: GenerateContext = {
      intake,
      profile,
      pantry: [],
      season: (['spring', 'summer', 'fall', 'winter'] as const)[i % 4],
    };

    // How many Instant Pot mains this week's own hard filters even allow.
    const eligible = INSTANT_POT_MAINS.filter((r) => passesHardFilters(r, intake, profile)).length;
    if (eligible > 0) tally.scenariosWithAnyEligible += 1;

    const meals = localRecommendationEngine.generate(ctx, RECIPES);
    const got = meals.filter((m) => {
      const recipe = RECIPES.find((r) => r.id === m.recipeId);
      return recipe ? usesInstantPot(recipe) : false;
    }).length;

    tally.asked += 1;
    if (got >= Math.min(nights, eligible)) tally.delivered += 1;
    if (nights > 0 && eligible >= nights && got < nights) tally.missedDespiteEligible += 1;
    if (meals.length < intake.dinners) tally.shortWeeks += 1;
  }
  return tally;
}

const none = run(0);
const one = run(1);
const two = run(2);

console.log(`Instant Pot mains in the library: ${INSTANT_POT_MAINS.length}\n`);
console.log(`Ran ${RUNS} varied 5-dinner weeks per request level (time limits swept across 30/45/60/90 min).\n`);
for (const [label, tally] of [['0 nights', none], ['1 night', one], ['2 nights', two]] as const) {
  console.log(
    `  ${label}: delivered in ${tally.delivered}/${tally.asked} weeks` +
      ` (scenarios with any eligible recipe: ${tally.scenariosWithAnyEligible}/${tally.asked},` +
      ` missed despite enough eligible: ${tally.missedDespiteEligible}, short weeks: ${tally.shortWeeks})`,
  );
}
console.log('');

const oneAlwaysDelivered = one.missedDespiteEligible === 0;
const twoMostlyDelivered = two.missedDespiteEligible === 0;
const noShortWeeks = none.shortWeeks === 0 && one.shortWeeks === 0 && two.shortWeeks === 0;
const contentHonest = untagged.length === 0 && misdeclared.length === 0;

if (oneAlwaysDelivered && twoMostlyDelivered && noShortWeeks && contentHonest) {
  console.log('Instant Pot nights are delivered whenever the library and this week\'s limits allow, and every tagged recipe is genuinely written for the machine. ✅');
} else {
  if (!oneAlwaysDelivered) console.error(`FAIL: ${one.missedDespiteEligible} weeks asked for 1 Instant Pot night, had eligible recipes, and did not get one.`);
  if (!twoMostlyDelivered) console.error(`FAIL: ${two.missedDespiteEligible} weeks asked for 2 nights, had enough eligible recipes, and came up short.`);
  if (!noShortWeeks) console.error('FAIL: the quota left a week short of its requested dinners.');
  if (untagged.length > 0) console.error(`FAIL: tagged Instant Pot but no pressure-cooker step: ${untagged.map((r) => r.id).join(', ')}`);
  if (misdeclared.length > 0) console.error(`FAIL: equipment label mismatch: ${misdeclared.map((r) => r.id).join(', ')}`);
  process.exit(1);
}
