import {
  Category,
  Cuisine,
  Department,
  Difficulty,
  Nutrition,
  Protein,
  Recipe,
  RecipeIngredient,
  SpiceLevel,
  Unit,
} from '@/domain/models';

import type { ImportFix } from './importOverrides';

/**
 * A loosely-structured recipe from an external source (an API or a web page's
 * schema.org/Recipe data). The normalizer below turns this into a fully-typed
 * Recipe the on-device planner can use: protein, cuisine, per-department
 * ingredients, times, and nutrition are inferred where the source omits them.
 *
 * These heuristics are intentionally conservative — an imported recipe is
 * marked `estimated` and always carries a citation, so it reads as "good, and
 * sourced" rather than pretending to be hand-authored.
 */
export interface RawRecipe {
  sourceId: string; // stable id within the source
  name: string;
  area?: string; // e.g. 'Vietnamese'
  category?: string; // e.g. 'Chicken', 'Vegetarian', 'Dessert'
  instructions: string;
  ingredients: { name: string; measure: string }[];
  image?: string;
  sourceName: string;
  sourceUrl?: string;
  tags?: string[];
}

const lc = (s: string) => s.toLowerCase();
const has = (hay: string, ...needles: string[]) => needles.some((n) => hay.includes(n));

// ---------------------------------------------------------------------------
// Cuisine mapping. Our library is organized around 12 named cuisines plus an
// `Other` catch-all; external areas are mapped to the nearest named cuisine
// when there's a genuine fit, or `Other` when there isn't (rather than
// defaulting to American, which used to dishonestly absorb a dozen
// unrelated regions) — the true origin is preserved on `recipe.origin`
// either way, for honest display.
// ---------------------------------------------------------------------------
const AREA_TO_CUISINE: Record<string, Cuisine> = {
  italian: 'Italian',
  mexican: 'Mexican',
  greek: 'Greek',
  indian: 'Indian',
  india: 'Indian',
  thai: 'Thai',
  vietnamese: 'Thai',
  malaysian: 'Thai',
  filipino: 'Thai',
  japanese: 'Japanese',
  chinese: 'Chinese',
  french: 'French',
  france: 'French',
  american: 'American',
  'united states': 'American',
  canadian: 'American',
  british: 'American',
  irish: 'American',
  australian: 'American',
  spanish: 'Mediterranean',
  portuguese: 'Mediterranean',
  croatian: 'Mediterranean',
  turkish: 'MiddleEastern',
  moroccan: 'MiddleEastern',
  tunisian: 'MiddleEastern',
  algerian: 'MiddleEastern',
  egyptian: 'MiddleEastern',
  syrian: 'MiddleEastern',
  'saudi arabian': 'MiddleEastern',
  lebanese: 'MiddleEastern',
  jamaican: 'BBQ',
  argentina: 'BBQ',
  uruguayan: 'BBQ',
  venezuela: 'Mexican',
  // Genuinely distinct cuisines with no close existing bucket — mapping
  // these to American was inflating that bucket with dishes that don't
  // taste, look, or cook anything like American food (Belgian stoemp,
  // Slovak halušky, Norwegian lapskaus, ...), which in turn skewed
  // recommendation/swap variety toward "American" far more than intended.
  dutch: 'Other',
  netherlands: 'Other',
  norway: 'Other',
  polish: 'Other',
  russian: 'Other',
  ukrainian: 'Other',
  slovakia: 'Other',
  kenyan: 'Other',
};

function mapCuisine(area: string | undefined, ingredientText: string): Cuisine {
  if (area) {
    const m = AREA_TO_CUISINE[lc(area.trim())];
    if (m) return m;
  }
  // Fall back to flavor cues from the ingredients.
  if (has(ingredientText, 'soy sauce', 'hoisin', 'oyster sauce')) return 'Chinese';
  if (has(ingredientText, 'garam masala', 'curry powder', 'turmeric', 'masala')) return 'Indian';
  if (has(ingredientText, 'tortilla', 'salsa', 'chipotle', 'refried')) return 'Mexican';
  if (has(ingredientText, 'fish sauce', 'lemongrass', 'coconut milk', 'curry paste')) return 'Thai';
  if (has(ingredientText, 'feta', 'kalamata', 'tahini')) return 'Mediterranean';
  if (has(ingredientText, 'parmesan', 'mozzarella', 'basil', 'pasta')) return 'Italian';
  // Genuinely unclassifiable (no area match, no flavor cue) — honest
  // "we don't know" rather than defaulting to American.
  return 'Other';
}

// ---------------------------------------------------------------------------
// Ingredient parsing: quantity + unit + shopping department.
// ---------------------------------------------------------------------------
const UNIT_WORDS: Record<string, Unit> = {
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp',
  // M5.8 task 3b: TheMealDB spellings that used to fall through to 'piece'
  // ("2 tblsp olive oil" was 2 pieces), plus loose amounts with a sensible
  // customary equivalent.
  tblsp: 'tbsp', tbls: 'tbsp', tbl: 'tbsp', tbsps: 'tbsp', splash: 'tbsp', drizzle: 'tbsp', knob: 'tbsp', knobs: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', tsps: 'tsp', tspn: 'tsp',
  sprinkling: 'pinch', sprinking: 'pinch', dusting: 'pinch',
  handfull: 'cup', handfuls: 'cup', litres: 'l', liters: 'l',
  cup: 'cup', cups: 'cup',
  g: 'g', gram: 'g', grams: 'g', gr: 'g',
  kg: 'kg', kilogram: 'kg',
  ml: 'ml', l: 'l', litre: 'l', liter: 'l',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  bunch: 'bunch', handful: 'cup',
  pinch: 'pinch', dash: 'pinch',
  slice: 'piece', slices: 'piece', piece: 'piece', pieces: 'piece',
  sprig: 'piece', sprigs: 'piece', whole: 'piece', large: 'piece', medium: 'piece', small: 'piece',
};

function parseFraction(token: string): number | null {
  if (/^\d+\/\d+$/.test(token)) {
    const [a, b] = token.split('/').map(Number);
    return b ? a / b : null;
  }
  if (/^\d*\.?\d+$/.test(token)) return Number(token);
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
function roundToStep(value: number, step: number): number {
  return round2(Math.round(value / step) * step);
}

/**
 * TheMealDB (the only source that ever emits g/kg/ml/l) is UK-authored and
 * metric-first, but every hand-authored recipe in this app already uses
 * customary units (lb/oz, cup/tbsp/tsp) — see `recipes.ts`. Convert within
 * the same dimensional family (mass -> oz/lb, volume -> tsp/tbsp/cup) so
 * imported recipes read the same way; this deliberately does NOT attempt a
 * mass->volume density conversion (e.g. "5 g of paprika" -> tsp), which
 * would need a per-ingredient density table. The mass/volume conversion
 * factors here match `ingredientKey.ts`'s `MASS_TO_GRAMS`/`VOLUME_TO_ML`
 * exactly, so a converted quantity round-trips identically once it reaches
 * the shopping list's own unit-family merge logic.
 */
function toCustomary(quantity: number, unit: Unit): { quantity: number; unit: Unit } {
  if (unit === 'kg') return toCustomary(quantity * 1000, 'g');
  if (unit === 'l') return toCustomary(quantity * 1000, 'ml');

  if (unit === 'g') {
    const ounces = quantity / 28.35;
    if (ounces < 16) return { quantity: Math.max(0.25, roundToStep(ounces, 0.25)), unit: 'oz' };
    return { quantity: roundToStep(ounces / 16, 0.25), unit: 'lb' };
  }

  if (unit === 'ml') {
    const teaspoons = quantity / 5;
    if (teaspoons < 3) return { quantity: Math.max(0.25, roundToStep(teaspoons, 0.25)), unit: 'tsp' };
    const tablespoons = quantity / 15;
    if (tablespoons < 4) return { quantity: roundToStep(tablespoons, 0.5), unit: 'tbsp' };
    const cups = quantity / 240;
    return { quantity: roundToStep(cups, 0.25), unit: 'cup' };
  }

  return { quantity, unit };
}

/** Exported so normalize.test.ts can verify the metric->customary unit
 * conversion directly. */
export function parseMeasure(measure: string): { quantity: number; unit: Unit } {
  const m = measure.trim().toLowerCase();
  if (!m || /to taste|to serve|for serving|as needed|garnish|as required/.test(m)) {
    return { quantity: 1, unit: 'pinch' };
  }
  // Split a stuck-together measure like "400g" into "400 g".
  const spaced = m.replace(/(\d)([a-z])/g, '$1 $2').replace(/½/g, ' 1/2').replace(/¼/g, ' 1/4').replace(/¾/g, ' 3/4');
  const tokens = spaced.split(/\s+/).filter(Boolean);
  let quantity = 0;
  let i = 0;
  // Accumulate a leading number, supporting "1 1/2".
  while (i < tokens.length) {
    const v = parseFraction(tokens[i]);
    if (v === null) break;
    quantity += v;
    i++;
  }
  if (quantity === 0) quantity = 1;
  const unitWord = tokens[i]?.replace(/[.,;:]+$/, '');
  const unit = (unitWord && UNIT_WORDS[unitWord]) || 'piece';
  if (unit === 'g' || unit === 'kg' || unit === 'ml' || unit === 'l') {
    return toCustomary(quantity, unit);
  }
  return { quantity: round2(quantity), unit };
}

const DEPT_RULES: [Department, string[]][] = [
  ['Seafood', ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'crab', 'lobster', 'squid', 'clam', 'mussel', 'scallop', 'haddock', 'tilapia', 'anchov', 'sardine', 'trout', 'sea bass', 'seafood', 'mackerel', 'octopus']],
  ['Meat', ['chicken', 'beef', 'pork', 'lamb', 'bacon', 'sausage', 'steak', 'mince', 'ground', 'turkey', 'ham', 'veal', 'rib', 'chorizo', 'prosciutto', 'duck', 'goat', 'brisket', 'thigh', 'breast', 'drumstick', 'meatball', 'salami', 'pancetta']],
  ['Bakery', ['bread', 'bun', 'tortilla', 'pita', 'naan', 'baguette', 'roll', 'brioche', 'bagel', 'croissant', 'pastry', 'puff pastry', 'filo', 'phyllo', 'flatbread', 'crumpet', 'muffin']],
  ['Spices', ['salt', 'pepper', 'cumin', 'paprika', 'cinnamon', 'turmeric', 'oregano', 'thyme', 'rosemary', 'nutmeg', 'cardamom', 'clove', 'saffron', 'bay lea', 'chilli powder', 'chili powder', 'curry powder', 'garam masala', 'spice', 'seasoning', 'cayenne', 'coriander seed', 'fennel seed', 'mustard powder', 'garlic powder', 'onion powder', 'allspice', 'vanilla']],
  ['International', ['soy sauce', 'fish sauce', 'curry paste', 'coconut milk', 'miso', 'tahini', 'hoisin', 'mirin', 'sriracha', 'gochujang', 'harissa', 'oyster sauce', 'teriyaki', 'sesame oil', 'rice vinegar', 'rice wine', 'kimchi', 'wasabi', 'nori', 'basmati', 'jasmine rice', 'panko', 'salsa verde', 'enchilada', 'chipotle']],
  ['Dairy', ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'parmesan', 'mozzarella', 'feta', 'cheddar', 'paneer', 'ghee', 'creme', 'mascarpone', 'ricotta', 'egg']],
  ['Produce', ['onion', 'garlic', 'tomato', 'pepper', 'carrot', 'potato', 'spinach', 'lettuce', 'cucumber', 'lemon', 'lime', 'parsley', 'cilantro', 'coriander', 'basil', 'mint', 'ginger', 'chilli', 'chili', 'celery', 'zucchini', 'courgette', 'mushroom', 'broccoli', 'cabbage', 'avocado', 'apple', 'lemongrass', 'scallion', 'spring onion', 'shallot', 'leek', 'kale', 'eggplant', 'aubergine', 'lime', 'orange', 'banana', 'berr', 'cauliflower', 'pea', 'bean sprout', 'herb', 'squash', 'pumpkin', 'beet', 'radish', 'fennel', 'asparagus', 'green bean', 'sweet potato', 'plantain', 'okra']],
  ['DryGoods', ['rice', 'pasta', 'flour', 'sugar', 'oil', 'vinegar', 'bean', 'lentil', 'chickpea', 'stock', 'broth', 'noodle', 'oat', 'breadcrumb', 'cornstarch', 'cornflour', 'honey', 'syrup', 'wine', 'chocolate', 'almond', 'cashew', 'walnut', 'peanut', 'raisin', 'couscous', 'quinoa', 'polenta', 'semolina', 'baking', 'yeast', 'gelatin', 'cocoa', 'coconut', 'sun-dried', 'olives', 'caper', 'passata', 'puree', 'ketchup', 'mustard', 'mayonnaise', 'worcestershire']],
];

function departmentFor(name: string): Department {
  const n = lc(name);
  // Special cases where a keyword would otherwise mislead.
  if (has(n, 'fish sauce')) return 'International';
  if (has(n, 'coconut milk', 'coconut cream')) return 'International';
  if (has(n, 'sesame') && has(n, 'oil')) return 'International';
  if (has(n, 'canned tomato', 'crushed tomato', 'chopped tomato', 'tinned tomato', 'tomato paste', 'passata', 'tomato sauce', 'tomato puree')) return 'DryGoods';
  for (const [dept, keys] of DEPT_RULES) {
    if (keys.some((k) => n.includes(k))) return dept;
  }
  return 'DryGoods';
}

function isStaple(name: string): boolean {
  const n = lc(name).trim();
  // Exact pantry basics only — never match compound produce like "bell pepper"
  // or spices like "cayenne pepper", which must stay on the shopping list.
  if (['salt', 'pepper', 'water', 'oil', 'sea salt', 'kosher salt', 'table salt', 'black pepper', 'white pepper'].includes(n)) return true;
  if (n.endsWith(' salt')) return true; // sea salt, garlic salt, etc.
  if (has(n, 'olive oil', 'vegetable oil', 'sunflower oil', 'cooking oil', 'canola oil')) return true;
  if (has(n, 'black pepper', 'white pepper', 'ground pepper')) return true;
  return false;
}

/** British → US ingredient names (M5.8 task 3), so imported recipes use
 * the words an H-E-B shopper and the curated library use — this is also what
 * the shopping list and pantry matching see. Whole-name entries first
 * (checked exactly), then phrase rules applied inside a name. Bare
 * "coriander" is the fresh herb in TheMealDB; "ground coriander" and
 * "coriander seeds" are the spice and are deliberately left alone.
 *
 * Applied only to the OUTPUT (normalize()'s ingredients, vegetables and
 * steps). Every inference — allergens, diet tags, protein, department,
 * staples, spice, provides, nutrition — still runs on the source names,
 * because its keyword lists are written in them ("eggplant" contains
 * "egg", "stock cube" is a gluten signal, "chilli" drives spice level).
 * So this rename cannot change what a recipe is, only what it's called. */
const US_NAME_EXACT: Record<string, string> = {
  coriander: 'cilantro',
  'coriander leaves': 'cilantro',
  'cilantro leaves': 'cilantro',
  chilli: 'chile pepper',
  'red chilli': 'red chile',
  'green chilli': 'green chile',
  'chilli flakes': 'red pepper flakes',
  'red chilli flakes': 'red pepper flakes',
  'red pepper': 'red bell pepper',
  'green pepper': 'green bell pepper',
  'yellow pepper': 'yellow bell pepper',
  'mixed peppers': 'mixed bell peppers',
  'sweet red peppers': 'red bell peppers',
  'roasted pepper': 'roasted red bell pepper',
  'caster sugar': 'sugar',
  'golden caster sugar': 'sugar',
  'icing sugar': 'powdered sugar',
  'muscovado sugar': 'dark brown sugar',
  'double cream': 'heavy cream',
  'single cream': 'half-and-half',
  'plain flour': 'all-purpose flour',
  'all purpose flour': 'all-purpose flour',
  'self-raising flour': 'self-rising flour',
  'strong white bread flour': 'bread flour',
  'minced beef': 'ground beef',
  'lean minced steak': 'lean ground beef',
  'minced pork': 'ground pork',
  'lamb mince': 'ground lamb',
  'turkey mince': 'ground turkey',
  prawns: 'shrimp',
  'king prawns': 'jumbo shrimp',
  'tiger prawns': 'jumbo shrimp',
  'raw king prawns': 'raw jumbo shrimp',
  'raw tiger prawns': 'raw jumbo shrimp',
  rocket: 'arugula',
  swede: 'rutabaga',
  beetroot: 'beets',
  'cooked beetroot': 'cooked beets',
  'pak choi': 'bok choy',
  'bicarbonate of soda': 'baking soda',
  'rapeseed oil': 'canola oil',
  passata: 'strained tomatoes (passata)',
  'tinned tomatos': 'canned tomatoes',
  'black treacle': 'molasses',
  'streaky bacon': 'bacon',
  'purple sprouting broccoli': 'broccolini',
  'floury potatoes': 'russet potatoes',
  'chicken stock cube': 'chicken bouillon cube',
  'vegetable stock cube': 'vegetable bouillon cube',
};
const US_NAME_PHRASES: Array<[RegExp, string]> = [
  [/\bcourgettes?\b/g, 'zucchini'],
  [/\baubergines?\b/g, 'eggplant'],
  [/\bspring onions?\b/g, 'green onions'],
  [/\b(chicken|beef|vegetable|lamb|fish) stock\b/g, '$1 broth'],
  [/\bchillies\b/g, 'chiles'],
  [/\bchilli\b/g, 'chili'],
];

/** Exported for tests (normalize.test.ts). */
export function usIngredientName(name: string): string {
  if (US_NAME_EXACT[name]) return US_NAME_EXACT[name];
  let out = name;
  for (const [re, to] of US_NAME_PHRASES) out = out.replace(re, to);
  return out;
}

/** The same renames inside step text, limited to words that are
 * unambiguous in prose (no bare "coriander", which may be the spice, or "pepper"). */
const US_STEP_PHRASES: Array<[RegExp, string]> = [
  [/\bcourgettes?\b/gi, 'zucchini'],
  [/\baubergines?\b/gi, 'eggplant'],
  [/\bspring onions?\b/gi, 'green onions'],
  [/\b(fresh coriander|coriander leaves)\b/gi, 'cilantro'],
  [/\bking prawns\b/gi, 'jumbo shrimp'],
  [/\bprawns?\b/gi, 'shrimp'],
  [/\bplain flour\b/gi, 'all-purpose flour'],
  [/\bdouble cream\b/gi, 'heavy cream'],
  [/\bcaster sugar\b/gi, 'sugar'],
  [/\bminced beef\b|\bbeef mince\b/gi, 'ground beef'],
  [/\blamb mince\b/gi, 'ground lamb'],
  [/\bbeetroots?\b/gi, 'beets'],
  [/\bpak choi\b/gi, 'bok choy'],
  [/\bbicarbonate of soda\b/gi, 'baking soda'],
  [/\b(chicken|beef|vegetable|lamb|fish) stock\b/gi, '$1 broth'],
  [/\bchilli powder\b/gi, 'chili powder'],
  [/\bchilli (flakes)\b/gi, 'red pepper flakes'],
  [/\bchilli (sauce|paste|oil)\b/gi, 'chili $1'],
  [/\bchillies\b/gi, 'chiles'],
  [/\bchilli\b/gi, 'chile'],
  [/\brocket\b/gi, 'arugula'],
];

/** Exported for tests (normalize.test.ts). */
export function usStepText(step: string): string {
  let out = step;
  for (const [re, to] of US_STEP_PHRASES) out = out.replace(re, to);
  return out;
}

function isFreshHerb(name: string): boolean {
  return /^(fresh |freshly chopped )?(parsley|coriander|coriander leaves|cilantro|cilantro leaves|basil|basil leaves|mint|dill|chives)$/.test(name);
}

function cleanIngredientName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseIngredients(pairs: { name: string; measure: string }[]): RecipeIngredient[] {
  const out: RecipeIngredient[] = [];
  for (const { name, measure } of pairs) {
    const clean = cleanIngredientName(name);
    if (!clean || clean === 'water') continue;
    let { quantity, unit } = parseMeasure(measure || '');
    // A fresh herb "to serve"/"garnish" is bought as a bunch, not a pinch.
    if (unit === 'pinch' && isFreshHerb(clean) && (!measure.trim() || /serve|garnish|taste|pinch|dash/i.test(measure))) {
      quantity = 1;
      unit = 'bunch';
    }
    out.push({
      name: clean,
      quantity,
      unit,
      department: departmentFor(clean),
      ...(isStaple(clean) ? { pantryStaple: true } : {}),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Protein / categories / techniques / spice / times / nutrition inference.
// ---------------------------------------------------------------------------
function inferProtein(category: string | undefined, ingText: string): Protein {
  const c = lc(category ?? '');
  if (c === 'chicken') return 'Chicken';
  if (c === 'beef') return 'Beef';
  if (c === 'pork') return 'Pork';
  if (c === 'lamb' || c === 'goat') return 'Lamb';
  if (c === 'seafood') {
    return has(ingText, 'shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'clam', 'scallop', 'squid', 'octopus')
      ? 'Shellfish'
      : 'Fish';
  }
  // Otherwise scan the ingredients (works for Vegetarian/Pasta/Miscellaneous).
  if (has(ingText, 'shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'clam', 'scallop', 'squid')) return 'Shellfish';
  if (has(ingText, 'salmon', 'tuna', 'cod', 'fish', 'haddock', 'tilapia', 'trout', 'anchov', 'sardine')) return 'Fish';
  if (has(ingText, 'chicken', 'turkey')) return has(ingText, 'turkey') && !has(ingText, 'chicken') ? 'Turkey' : 'Chicken';
  if (has(ingText, 'beef', 'steak', 'mince', 'ground beef', 'brisket')) return 'Beef';
  if (has(ingText, 'pork', 'bacon', 'sausage', 'ham', 'chorizo')) return 'Pork';
  if (has(ingText, 'lamb', 'mutton', 'goat')) return 'Lamb';
  if (has(ingText, 'tofu', 'tempeh')) return 'Tofu';
  if (has(ingText, 'lentil')) return 'Lentils';
  if (has(ingText, 'chickpea', 'black bean', 'kidney bean', 'cannellini', 'pinto', 'refried')) return 'Beans';
  if (has(ingText, 'egg')) return 'Eggs';
  return 'None';
}

function inferTechniques(instructions: string): string[] {
  const t = lc(instructions);
  const found = new Set<string>();
  const map: [string, string[]][] = [
    ['bake', ['bake', 'oven']],
    ['roast', ['roast']],
    ['grill', ['grill', 'barbecue', 'bbq']],
    ['fry', ['fry', 'sauté', 'saute', 'sear']],
    ['stir-fry', ['stir-fry', 'stir fry', 'wok']],
    ['simmer', ['simmer', 'boil', 'poach']],
    ['braise', ['braise', 'stew', 'slow cook', 'slow-cook']],
    ['steam', ['steam']],
    ['grill', ['broil']],
  ];
  for (const [tech, keys] of map) if (has(t, ...keys)) found.add(tech);
  if (found.size === 0) found.add('simmer');
  return [...found];
}

function inferSpice(ingText: string): SpiceLevel {
  if (has(ingText, 'scotch bonnet', 'habanero', 'vindaloo', 'ghost pepper')) return 'Hot';
  if (has(ingText, 'chilli', 'chili', 'cayenne', 'jalapeno', 'sriracha', 'harissa', 'curry paste', 'gochujang', 'chipotle')) return 'Medium';
  if (has(ingText, 'paprika', 'pepper flakes', 'mustard')) return 'Mild';
  return 'None';
}

function estimateTimes(techniques: string[]): { prep: number; cook: number } {
  if (techniques.includes('braise')) return { prep: 20, cook: 90 };
  if (techniques.includes('roast') || techniques.includes('bake')) return { prep: 15, cook: 45 };
  if (techniques.includes('stir-fry')) return { prep: 15, cook: 15 };
  if (techniques.includes('grill')) return { prep: 15, cook: 20 };
  return { prep: 15, cook: 30 };
}

/** Exported so scripts/validateRecipes.ts and the sides library can share the
 * exact same starch check used for nutrition estimation. */
export function hasStarch(ingText: string): boolean {
  return has(ingText, 'rice', 'pasta', 'noodle', 'potato', 'bread', 'tortilla', 'bun', 'couscous', 'quinoa', 'flour', 'polenta', 'gnocchi');
}

// ---------------------------------------------------------------------------
// M4.2 `provides` inference — what a dish actually puts on the plate. Used to
// derive `provides` for imported recipes here, and reused by
// scripts/validateRecipes.ts as the ground truth for a hard plausibility
// check over hand-authored `provides` on curated/side recipes: a *declared*
// entry must be backed by a real ingredient. The reverse is deliberately not
// required — not every vegetable a dish happens to contain needs to be
// declared, or this recreates the "must contain a vegetable" gate the
// product owner explicitly rejected (ADVISOR-HANDOFF #21).
// ---------------------------------------------------------------------------

/** Cheese/egg/legume ingredients that carry real protein but don't fit the
 * `Protein` enum's single "primary protein" slot (e.g. a pasta bake whose
 * primaryProtein is 'None' because cheese isn't a listed protein, but a
 * hunk of mozzarella and ricotta is obviously protein on the plate). */
const PROTEIN_BOOST_KEYWORDS = [
  'cheese', 'cheddar', 'mozzarella', 'parmesan', 'parmigiano', 'feta', 'paneer',
  'halloumi', 'ricotta', 'mascarpone', 'gruyere', 'provolone', 'cotija', 'queso',
  'gouda', 'brie', 'goat cheese', 'monterey jack', 'hummus', 'edamame',
];

function hasProteinBoost(ingText: string): boolean {
  // "eggplant" contains "egg" but isn't the allergen/protein — same strip
  // trick used in inferAllergens.
  const eggText = ingText.replace(/eggplant/g, '');
  return has(ingText, ...PROTEIN_BOOST_KEYWORDS) || has(eggText, 'egg');
}

/** Real vegetables — deliberately excludes aromatics (garlic, ginger,
 * onion, shallot), fresh herbs (parsley, cilantro, basil, mint, thyme...),
 * citrus, and fruit. This is the exact distinction the product owner's bug
 * report was about: "the steak's vegetables field is ['parsley'] — a
 * garnish," not a real vegetable serving. */
const VEGETABLE_KEYWORDS = [
  'broccoli', 'spinach', 'lettuce', 'cucumber', 'zucchini', 'courgette', 'cabbage',
  'cauliflower', 'asparagus', 'green bean', 'carrot', 'celery', 'eggplant',
  'aubergine', 'egg plant', 'kale', 'beet', 'radish', 'fennel', 'okra', 'squash', 'pumpkin',
  'bell pepper', 'poblano', 'tomato', 'brussels sprout', 'artichoke', 'leek',
  'mushroom', 'arugula', 'sprout', 'bok choy', 'coleslaw', 'marinara',
];

function hasVegetable(ingText: string): boolean {
  // "cornstarch"/"corn syrup"/"popcorn"/"corned beef" aren't corn-the-vegetable.
  const cornText = ingText.replace(/cornstarch|corn syrup|corned beef|popcorn/g, '');
  // "chickpea(s)" contains "pea" but is a legume, not a pea vegetable.
  const peaText = ingText.replace(/chick\s*peas?/g, '');
  return has(ingText, ...VEGETABLE_KEYWORDS) || has(cornText, 'corn') || has(peaText, 'peas', 'snap pea', 'snow pea');
}

/** Broader than `hasStarch` (which stays untouched — it also drives the
 * imported-recipe nutrition estimate, and widening it would ripple into
 * calories/carbs for existing imports, not just add `provides`). This list
 * adds specific pasta shapes and breads that `hasStarch`'s generic
 * 'pasta'/'bread' substrings miss (e.g. "linguine", "naan"). */
const STARCH_INGREDIENT_KEYWORDS = [
  'rice', 'pasta', 'noodle', 'potato', 'bread', 'tortilla', 'bun', 'couscous',
  'quinoa', 'flour', 'polenta', 'gnocchi', 'linguine', 'spaghetti', 'fettuccine',
  'penne', 'macaroni', 'ziti', 'rigatoni', 'fusilli', 'orzo', 'ravioli',
  'tortellini', 'vermicelli', 'udon', 'soba', 'ramen', 'lasagna', 'lasagne',
  'farfalle', 'bagel', 'baguette', 'naan', 'pita', 'biscuit',
];

function hasStarchIngredient(ingText: string): boolean {
  return has(ingText, ...STARCH_INGREDIENT_KEYWORDS);
}

export function inferProvides(protein: Protein, ingText: string): Array<'protein' | 'vegetable' | 'starch'> {
  const provides: Array<'protein' | 'vegetable' | 'starch'> = [];
  if (protein !== 'None' || hasProteinBoost(ingText)) provides.push('protein');
  if (hasVegetable(ingText)) provides.push('vegetable');
  if (hasStarchIngredient(ingText)) provides.push('starch');
  return provides;
}

/** The hard plausibility gate scripts/validateRecipes.ts runs over every
 * recipe's *declared* `provides`: returns whichever declared entries aren't
 * backed by a real ingredient, using ingredients only (never the recipe
 * name — see the name-leakage note in `normalize()`). Empty result means
 * every declared entry is plausible. Deliberately asymmetric — this never
 * flags an entry that's present in the ingredients but NOT declared. */
export function unsupportedProvides(
  provides: Array<'protein' | 'vegetable' | 'starch'> | undefined,
  protein: Protein,
  ingredientNames: string[],
): Array<'protein' | 'vegetable' | 'starch'> {
  if (!provides || provides.length === 0) return [];
  const ingText = ' ' + ingredientNames.join(' ') + ' ';
  const plausible = new Set(inferProvides(protein, ingText.toLowerCase()));
  return provides.filter((p) => !plausible.has(p));
}

function estimateNutrition(protein: Protein, ingText: string): Nutrition {
  const proteinG: Record<Protein, number> = {
    Chicken: 38, Beef: 36, Pork: 34, Fish: 34, Shellfish: 30, Turkey: 36, Lamb: 34,
    Tofu: 20, Beans: 18, Lentils: 18, Eggs: 20, None: 12,
  };
  const starch = hasStarch(ingText);
  const rich = has(ingText, 'cream', 'butter', 'cheese', 'coconut milk', 'oil', 'fried');
  return {
    calories: 420 + (starch ? 100 : 0) + (rich ? 60 : 0),
    protein: proteinG[protein],
    carbs: starch ? 48 : 18,
    fat: 18 + (rich ? 12 : 0),
  };
}

/** Whole-word (optionally plural) match — used for the keywords added after
 * the original substring list, where a bare substring would misfire
 * ("bun" inside "bunch", "roll" inside "rolled", "ham" inside "graham"). */
const hasWord = (hay: string, ...words: string[]) =>
  words.some((w) => new RegExp(`\\b${w}(e?s)?\\b`).test(hay));

/** Exported so scripts/validateRecipes.ts can reuse the same keyword rules as
 * a coverage check over hand-authored allergen lists (P1-1).
 *
 * September 2026 audit: the original substring list missed whole families of
 * everyday ingredients — named pasta shapes and breads ("spaghetti",
 * "lasagne", "baguette", "pastry"), mayonnaise (eggs), oyster sauce
 * (shellfish), Worcestershire and dashi (fish), hummus (sesame), pine nuts
 * and pesto (tree nuts), hoisin/teriyaki/tamari (soy). Because `dietTags`
 * derive from these allergens, 27 imported pasta/pastry dishes were tagged
 * gluten-free. Every addition below only ever ADDS an allergen — this list
 * must never get more permissive without a test proving the old hit was a
 * false positive (as with "butternut", which is squash, not butter). */
export function inferAllergens(ingText: string): string[] {
  const text = ingText.toLowerCase();
  const a = new Set<string>();
  // Coconut milk/cream, peanut butter, butter beans, and butternut squash are
  // dairy-free; strip them before the dairy check so e.g. Thai curries don't
  // get a false 'Dairy' hit from "milk", and peanut/bean/squash dishes don't
  // from "butter".
  const dairyText = text.replace(/coconut\s+(milk|cream)|peanut\s+butter|butter\s+beans?|butternut/g, '');
  // "eggplant" contains "egg" but isn't the allergen; strip it before the
  // eggs check so e.g. ratatouille/moussaka don't get a false 'Eggs' hit.
  const eggText = text.replace(/eggplant/g, '');
  // Rice noodles/vermicelli, corn tortillas, and (corn) tortilla chips are
  // the classic gluten-free swaps; strip them before the wheat checks so pad
  // thai, tacos, etc. don't get a false 'Gluten' hit. Everything else still
  // matches.
  const glutenText = text.replace(/(wide\s+)?rice\s+(noodles?|vermicelli|sticks?)|corn\s+tortillas?|tortilla\s+chips?/g, '');
  // "water chestnut" is a tuber and "chestnut mushrooms" (a UK name for
  // cremini) are mushrooms — neither is a tree nut.
  const nutText = text.replace(/water\s+chestnuts?|chestnut\s+mushrooms?/g, '');
  if (
    has(glutenText, 'flour', 'bread', 'pasta', 'noodle', 'soy sauce', 'breadcrumb', 'wheat', 'couscous', 'panko', 'barley', 'cracker') ||
    hasWord(glutenText, 'spaghetti', 'linguine', 'penne', 'fettuc+ine', 'tagliatelle', 'pappardelle', 'lasagn[ae]', 'macaroni',
      'rigatoni', 'fusilli', 'farfalle', 'orzo', 'ravioli', 'tortellini', 'ditalini', 'conchiglie', 'vermicelli', 'gnocchi',
      'pastry', 'pastries', 'filo', 'phyllo', 'baguette', 'bun', 'roll', 'pitt?a', 'naan', 'tortilla', 'brioche', 'croissant',
      'crumpet', 'biscuit', 'digestive', 'pizza', 'dumpling', 'wonton', 'udon', 'ramen', 'semolina', 'bulgh?ur', 'freekeh',
      'farro', 'spelt', 'rye', 'malt', 'beer', 'stout', 'seitan', 'worcestershire', 'teriyaki', 'hoisin')
  ) a.add('Gluten');
  if (
    has(dairyText, 'milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'paneer', 'ghee', 'parmesan', 'mozzarella', 'feta') ||
    hasWord(dairyText, 'cheddar', 'ricotta', 'mascarpone', 'halloumi', 'gruyere', 'provolone', 'parmigiano', 'pecorino', 'gouda',
      'brie', 'camembert', 'emmental', 'stilton', 'fromage', 'creme fraiche', 'crème fraîche', 'queso', 'cotija', 'tzatziki',
      'ranch', 'pesto', 'custard', 'whey', 'kefir', 'quark', 'raita', 'labneh')
  ) a.add('Dairy');
  if (
    has(text, 'shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'clam', 'scallop', 'squid') ||
    hasWord(text, 'oyster', 'crayfish', 'crawfish', 'langoustine', 'cockle', 'whelk', 'octopus', 'calamari', 'seafood')
  ) a.add('Shellfish');
  if (
    has(text, 'salmon', 'tuna', 'cod', 'fish', 'anchov', 'haddock', 'sardine') ||
    hasWord(text, 'worcestershire', 'dashi', 'bonito', 'mackerel', 'trout', 'tilapia', 'halibut', 'snapper', 'bass', 'bream',
      'herring', 'kipper', 'pollock', 'hake', 'plaice', 'sole', 'turbot', 'branzino', 'mahi', 'pilchard', 'whitebait', 'roe',
      'caviar', 'eel')
  ) a.add('Fish');
  if (has(eggText, 'egg') || hasWord(text, 'mayonnaise', 'mayo', 'aioli', 'meringue')) a.add('Eggs');
  if (
    has(text, 'soy sauce', 'tofu', 'edamame', 'miso', 'tempeh') ||
    hasWord(text, 'soy', 'soya', 'soybean', 'tamari', 'teriyaki', 'hoisin', 'doubanjiang', 'gochujang', 'natto', 'shoyu', 'curry roux')
  ) a.add('Soy');
  if (has(text, 'peanut') || hasWord(text, 'groundnut', 'satay')) a.add('Peanuts');
  if (
    has(nutText, 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut') ||
    hasWord(nutText, 'pine nut', 'pinenut', 'pesto', 'macadamia', 'brazil nut', 'chestnut', 'marzipan', 'praline', 'frangipane', 'nutella')
  ) a.add('Tree Nuts');
  if (has(text, 'sesame', 'tahini') || hasWord(text, 'hummus', 'houmous', 'halva', 'halvah', 'furikake', "za'atar", 'zaatar'))
    a.add('Sesame');
  return [...a];
}

/** Meat/fish words that make a dish non-vegetarian even when the inferred
 * primary protein is 'None' or a vegetarian one (a duck pie, pastry made
 * with lard, beans cooked with a stock cube of chicken). */
const NON_VEGETARIAN_WORDS = [
  'chicken', 'beef', 'pork', 'lamb', 'mutton', 'veal', 'venison', 'goat', 'duck', 'goose', 'turkey', 'ham', 'bacon',
  'lardons?', 'lard', 'suet', 'pancetta', 'prosciutto', 'chorizo', 'salami', 'pepperoni', 'sausage', 'mince', 'meatballs?',
  'liver', 'oxtail', 'gelatine?', 'fish', 'anchov(y|ies)', 'shrimp', 'prawn', 'dashi', 'bonito', 'worcestershire',
  'oyster sauce', 'fish sauce',
];

/** Exported for tests (normalize.test.ts). */
export function inferDietTags(protein: Protein, allergens: string[], ingText: string): string[] {
  // Kidney beans and goat's cheese are vegetarian; strip them before the
  // "kidney"/"goat" meat checks.
  const text = ingText
    .toLowerCase()
    .replace(/kidney\s+beans?/g, 'beans')
    .replace(/goat'?s?\s+(cheese|milk|curd)/g, 'cheese');
  const tags: string[] = [];
  const meaty = ['Chicken', 'Beef', 'Pork', 'Fish', 'Shellfish', 'Turkey', 'Lamb'].includes(protein);
  const vegetarian =
    !meaty &&
    !allergens.includes('Fish') &&
    !allergens.includes('Shellfish') &&
    !hasWord(text, ...NON_VEGETARIAN_WORDS) &&
    !has(text, 'kidney', 'gelatin');
  if (vegetarian) {
    tags.push('vegetarian');
    if (!allergens.includes('Dairy') && !allergens.includes('Eggs') && !has(text, 'honey')) tags.push('vegan');
  }
  if (!allergens.includes('Gluten')) tags.push('gluten-free');
  if (!allergens.includes('Dairy')) tags.push('dairy-free');
  return tags;
}

/** Diet tag -> allergens that contradict it. */
const DIET_TAG_CONFLICTS: Record<string, string[]> = {
  vegan: ['Dairy', 'Eggs', 'Fish', 'Shellfish'],
  vegetarian: ['Fish', 'Shellfish'],
  'dairy-free': ['Dairy'],
  'gluten-free': ['Gluten'],
};

/** A diet tag contradicted by the recipe's own ingredients (optional ones
 * included — they still reach the shopping list) or by its declared
 * allergens. Used by validateRecipes.ts on hand-authored recipes (M5.8
 * task 2). Returns one message per conflict; empty means consistent. */
export function dietTagConflicts(recipe: {
  dietTags: string[];
  allergens: string[];
  ingredients: Array<{ name: string; optional?: boolean }>;
}): string[] {
  const out: string[] = [];
  const declared = new Set(recipe.allergens.map(lc));
  for (const tag of recipe.dietTags.map(lc)) {
    for (const bad of DIET_TAG_CONFLICTS[tag] ?? []) {
      if (declared.has(lc(bad))) out.push(`tagged "${tag}" but declares allergen "${bad}"`);
      for (const ing of recipe.ingredients) {
        if (inferAllergens(' ' + lc(ing.name) + ' ').includes(bad)) {
          out.push(`tagged "${tag}" but ingredient "${ing.name}"${ing.optional ? ' (optional)' : ''} triggers "${bad}"`);
        }
      }
    }
  }
  return out;
}

function inferCategories(category: string | undefined, protein: Protein, ingText: string, name: string, dietTags: string[]): Category[] {
  const set = new Set<Category>();
  const c = lc(category ?? '');
  const n = lc(name);
  if (c === 'seafood' || protein === 'Fish' || protein === 'Shellfish') set.add('Seafood');
  if (c === 'pasta' || has(ingText, 'pasta', 'spaghetti', 'penne', 'linguine', 'lasagne', 'macaroni')) set.add('Pasta');
  if (dietTags.includes('vegetarian')) set.add('Vegetarian');
  if (has(n, 'soup') || has(ingText, 'broth') && has(n, 'soup')) set.add('Soups');
  if (has(n, 'stew', 'curry', 'chili', 'chilli', 'tagine', 'braise')) set.add('Stews');
  if (has(n, 'salad')) set.add('Salads');
  if (has(n, 'sandwich', 'burger', 'wrap', 'taco', 'sub')) set.add('Sandwiches');
  if (['Chicken', 'Beef', 'Pork', 'Fish', 'Turkey', 'Lamb'].includes(protein)) set.add('HighProtein');
  if (set.size === 0) set.add('ComfortFood');
  return [...set];
}

function splitSteps(instructions: string): string[] {
  let parts = instructions
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .map((s) => s.replace(/^step\s*\d+[:.)]?\s*/i, '').replace(/^\d+[.)]\s*/, ''))
    .filter((s) => s.length > 0);
  if (parts.length <= 1) {
    parts = instructions
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  // Keep steps reasonably sized; drop trailing "enjoy"-only fragments.
  return parts.slice(0, 14);
}

function difficultyFor(steps: number, totalMinutes: number): Difficulty {
  if (totalMinutes > 90 || steps >= 9) return 'Hard';
  if (steps <= 4 && totalMinutes <= 40) return 'Easy';
  return 'Medium';
}

/** Normalize a raw external recipe into a Recipe, or null if it isn't a usable dinner main. */
export function normalize(raw: RawRecipe, times?: { prepMinutes?: number; cookMinutes?: number }): Recipe | null {
  const cat = lc(raw.category ?? '');
  // The planner is for dinners — skip desserts, drinks, breakfasts, sides, starters.
  if (['dessert', 'breakfast', 'side', 'starter'].includes(cat)) return null;
  if (has(lc(raw.name), 'cake', 'cookie', ' pie', 'pudding', 'dessert', 'pancake', 'smoothie', 'brownie', 'ice cream', 'cheesecake', 'muffin', 'scone', 'tart')) {
    return null;
  }

  const ingredients = parseIngredients(raw.ingredients);
  if (ingredients.length < 3) return null;
  const steps = splitSteps(raw.instructions).map(usStepText);
  if (steps.length < 2) return null;

  const ingText = ' ' + ingredients.map((i) => i.name).join(' ') + ' ' + lc(raw.name) + ' ';
  // `provides` deliberately uses ingredients only, not the dish name — a
  // title can use a colloquial or regional word ("rice and peas" meaning
  // kidney beans, not garden peas) that doesn't match what's actually being
  // bought/cooked. scripts/validateRecipes.ts's plausibility check builds
  // its ground truth from ingredients the same way, so the two stay in sync.
  const ingredientOnlyText = ' ' + ingredients.map((i) => i.name).join(' ') + ' ';
  const protein = inferProtein(raw.category, ingText);
  const cuisine = mapCuisine(raw.area, ingText);
  const techniques = inferTechniques(raw.instructions);
  const estimate = estimateTimes(techniques);
  const prep = times?.prepMinutes ?? estimate.prep;
  const cook = times?.cookMinutes ?? estimate.cook;
  const allergens = inferAllergens(ingText);
  const dietTags = inferDietTags(protein, allergens, ingText);
  const categories = inferCategories(raw.category, protein, ingText, raw.name, dietTags);
  const nutrition = estimateNutrition(protein, ingText);
  const makesLeftovers =
    categories.includes('Soups') || categories.includes('Stews') || has(lc(raw.name), 'curry', 'chili', 'chilli', 'stew', 'soup');

  return {
    id: `${raw.sourceName === 'TheMealDB' ? 'mealdb' : 'web'}-${raw.sourceId}`,
    name: raw.name.trim(),
    cuisine,
    categories,
    // role omitted — normalize() only ever produces dinner mains (desserts,
    // sides, starters are filtered out above), so the 'main' default is correct.
    provides: inferProvides(protein, ingredientOnlyText),
    primaryProtein: protein,
    vegetables: ingredients.filter((i) => i.department === 'Produce').map((i) => usIngredientName(i.name)).slice(0, 6),
    techniques,
    difficulty: difficultyFor(steps.length, prep + cook),
    spiceLevel: inferSpice(ingText),
    prepMinutes: prep,
    cookMinutes: cook,
    baseServings: makesLeftovers ? 6 : 4,
    nutrition,
    ingredients: ingredients.map((i) => ({ ...i, name: usIngredientName(i.name) })),
    steps,
    makesLeftovers,
    seasons: [],
    allergens,
    dietTags,
    image: raw.image,
    origin: raw.area && lc(raw.area) !== 'unknown' ? raw.area : undefined,
    sourceName: raw.sourceName,
    sourceUrl: raw.sourceUrl,
    estimated: true,
  };
}

/** Apply a hand-reviewed triage fix (src/data/import/importOverrides.ts) to
 * a raw recipe BEFORE normalize(), so every inferred field (allergens, diet
 * tags, protein, spice, departments) is re-derived from the corrected text. */
export function applyImportFix(raw: RawRecipe, fix: ImportFix): RawRecipe {
  const base = fix.ingredients ?? raw.ingredients;
  return {
    ...raw,
    instructions: fix.instructions ?? raw.instructions,
    ingredients: [...base, ...(fix.addIngredients ?? [])],
  };
}

/** Map a raw TheMealDB meal object into a RawRecipe. */
export function fromMealDb(meal: Record<string, string | null>): RawRecipe {
  const ingredients: { name: string; measure: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] ?? '').trim();
    const measure = (meal[`strMeasure${i}`] ?? '').trim();
    if (name) ingredients.push({ name, measure });
  }
  const tags = (meal.strTags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  return {
    sourceId: meal.idMeal ?? '',
    name: meal.strMeal ?? '',
    area: meal.strArea ?? undefined,
    category: meal.strCategory ?? undefined,
    instructions: meal.strInstructions ?? '',
    ingredients,
    image: meal.strMealThumb ?? undefined,
    sourceName: 'TheMealDB',
    sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    tags,
  };
}
