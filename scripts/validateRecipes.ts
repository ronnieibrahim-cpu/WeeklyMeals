/**
 * Content-quality gate for the hand-curated recipe library (M2.2b). Run with:
 *
 *   npx tsx --tsconfig ./tsconfig.json scripts/validateRecipes.ts
 *
 * Only checks curated recipes (id NOT starting with `mealdb-`) — the 311
 * imported recipes are out of scope for this task; their source text is
 * their fidelity anchor. Fails loudly (non-zero exit) listing every
 * offending recipe id, rather than stopping at the first problem, so a
 * whole batch's gaps show up in one run.
 *
 * There's no test runner installed in this repo yet (PROJECT.md #11), so —
 * same as scripts/checkSyncMerge.ts — this lives here until M2.5 sets one
 * up, at which point it should migrate into the real test suite.
 */
import { Recipe } from '@/domain/models';
import { RECIPES } from '@/data/seed/recipes';

const MIN_STEPS = 5;
const MIN_STEP_CHARS = 40;
const OVEN_TECHNIQUES = ['roast', 'bake', 'broil'];
const OVEN_TEMP_PATTERN = /\d{3}\s*°?\s*F\b/i;

// Descriptive modifiers that legitimately won't appear in a step's prose
// the way they appear in an ingredient list (e.g. steps say "the chicken",
// not "the boneless skinless chicken breasts"). Excluded when picking the
// "significant" word(s) an ingredient must be referenced by.
const MODIFIER_STOPWORDS = new Set([
  'fresh', 'baby', 'large', 'small', 'medium', 'extra', 'virgin', 'whole',
  'ripe', 'canned', 'dried', 'frozen', 'shredded', 'grated', 'sliced',
  'halved', 'peeled', 'cooked', 'raw', 'cold', 'warm', 'room', 'plain',
  'unflavored', 'packed', 'drained', 'rinsed', 'softened', 'melted',
  'boneless', 'skinless', 'unsalted', 'low', 'sodium', 'reduced', 'light',
  'organic', 'chopped', 'diced', 'minced', 'crushed', 'ground', 'thin',
  'thick', 'coarse', 'temperature',
]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

/** Significant (distinguishing) words from an ingredient name — the parts a
 * step would plausibly actually say, e.g. "spinach" from "baby spinach". */
function significantWords(ingredientName: string): string[] {
  const words = norm(ingredientName)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !MODIFIER_STOPWORDS.has(w));
  return words.length > 0 ? words : norm(ingredientName).split(/\s+/).filter(Boolean);
}

interface Violation {
  recipeId: string;
  message: string;
}

function validateRecipe(recipe: Recipe, violations: Violation[]) {
  const fail = (message: string) => violations.push({ recipeId: recipe.id, message });

  if (recipe.steps.length < MIN_STEPS) {
    fail(`only ${recipe.steps.length} step(s) (need >= ${MIN_STEPS})`);
  }

  recipe.steps.forEach((step, i) => {
    if (step.length < MIN_STEP_CHARS) {
      fail(`step ${i + 1} too short (${step.length} chars, need >= ${MIN_STEP_CHARS}): "${step}"`);
    }
  });

  const stepText = norm(recipe.steps.join(' '));
  for (const ing of recipe.ingredients) {
    if (ing.pantryStaple) continue;
    const words = significantWords(ing.name);
    // Tolerate simple plural/singular mismatches ("limes" in the ingredient
    // list vs "lime" in a step, or "tomato" vs "tomatoes") rather than
    // demanding the exact same inflection.
    const referenced = words.some((w) => {
      const forms = new Set([w, w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, '')]);
      return Array.from(forms).some((f) => f.length >= 3 && new RegExp(`\\b${f}`).test(stepText));
    });
    if (!referenced) {
      fail(`ingredient "${ing.name}" is not referenced in any step`);
    }
  }

  const usesOven = recipe.techniques.some((t) => OVEN_TECHNIQUES.includes(t.toLowerCase()));
  if (usesOven && !recipe.steps.some((s) => OVEN_TEMP_PATTERN.test(s))) {
    fail(`uses ${recipe.techniques.filter((t) => OVEN_TECHNIQUES.includes(t.toLowerCase())).join('/')} but no step states an oven temperature`);
  }

  if (!recipe.description || recipe.description.trim().length === 0) {
    fail('missing description');
  }
}

const curated = RECIPES.filter((r) => !r.id.startsWith('mealdb-'));
console.log(`Validating ${curated.length} curated recipes...\n`);

const violations: Violation[] = [];
for (const recipe of curated) validateRecipe(recipe, violations);

const failedIds = Array.from(new Set(violations.map((v) => v.recipeId)));

if (violations.length === 0) {
  console.log(`All ${curated.length} curated recipes pass. ✅`);
  process.exit(0);
}

for (const id of failedIds) {
  console.log(`FAIL - ${id}`);
  for (const v of violations.filter((x) => x.recipeId === id)) {
    console.log(`  - ${v.message}`);
  }
}

console.log(
  `\n${curated.length} recipes checked, ${curated.length - failedIds.length} passed, ${failedIds.length} failed (${violations.length} total violations).`,
);
process.exit(1);
