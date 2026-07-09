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
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
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

function parseMeasure(measure: string): { quantity: number; unit: Unit } {
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
  const unitWord = tokens[i];
  const unit = (unitWord && UNIT_WORDS[unitWord]) || 'piece';
  return { quantity: Math.round(quantity * 100) / 100, unit };
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

function cleanIngredientName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseIngredients(pairs: { name: string; measure: string }[]): RecipeIngredient[] {
  const out: RecipeIngredient[] = [];
  for (const { name, measure } of pairs) {
    const clean = cleanIngredientName(name);
    if (!clean || clean === 'water') continue;
    const { quantity, unit } = parseMeasure(measure || '');
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

function hasStarch(ingText: string): boolean {
  return has(ingText, 'rice', 'pasta', 'noodle', 'potato', 'bread', 'tortilla', 'bun', 'couscous', 'quinoa', 'flour', 'polenta', 'gnocchi');
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

/** Exported so scripts/validateRecipes.ts can reuse the same keyword rules as
 * a coverage check over hand-authored allergen lists (P1-1). */
export function inferAllergens(ingText: string): string[] {
  const a = new Set<string>();
  // Coconut milk/cream, peanut butter, and butter beans are dairy-free;
  // strip them before the dairy check so e.g. Thai curries don't get a false
  // 'Dairy' hit from "milk", and peanut/bean dishes don't from "butter".
  const dairyText = ingText.replace(/coconut\s+(milk|cream)|peanut\s+butter|butter\s+beans?/g, '');
  // "eggplant" contains "egg" but isn't the allergen; strip it before the
  // eggs check so e.g. ratatouille/moussaka don't get a false 'Eggs' hit.
  const eggText = ingText.replace(/eggplant/g, '');
  // Rice noodles are the classic gluten-free noodle (100% rice, no wheat);
  // strip them before the "noodle" check so pad thai etc. don't get a false
  // 'Gluten' hit. Other noodle types (egg/udon/ramen/wheat/soba) still match.
  const glutenText = ingText.replace(/(wide\s+)?rice\s+noodles?/g, '');
  if (has(glutenText, 'flour', 'bread', 'pasta', 'noodle', 'soy sauce', 'breadcrumb', 'wheat', 'couscous', 'panko', 'barley', 'cracker')) a.add('Gluten');
  if (has(dairyText, 'milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'paneer', 'ghee', 'parmesan', 'mozzarella', 'feta')) a.add('Dairy');
  if (has(ingText, 'shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'clam', 'scallop', 'squid')) a.add('Shellfish');
  if (has(ingText, 'salmon', 'tuna', 'cod', 'fish', 'anchov', 'haddock', 'sardine')) a.add('Fish');
  if (has(eggText, 'egg')) a.add('Eggs');
  if (has(ingText, 'soy sauce', 'tofu', 'edamame', 'miso', 'tempeh')) a.add('Soy');
  if (has(ingText, 'peanut')) a.add('Peanuts');
  if (has(ingText, 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut')) a.add('Tree Nuts');
  if (has(ingText, 'sesame', 'tahini')) a.add('Sesame');
  return [...a];
}

function inferDietTags(protein: Protein, allergens: string[], ingText: string): string[] {
  const tags: string[] = [];
  const meaty = ['Chicken', 'Beef', 'Pork', 'Fish', 'Shellfish', 'Turkey', 'Lamb'].includes(protein);
  const vegetarian = !meaty && !has(ingText, 'chicken', 'beef', 'pork', 'lamb', 'fish', 'bacon', 'sausage', 'anchov', 'gelatin', 'shrimp');
  if (vegetarian) {
    tags.push('vegetarian');
    if (!allergens.includes('Dairy') && !allergens.includes('Eggs') && !has(ingText, 'honey')) tags.push('vegan');
  }
  if (!allergens.includes('Gluten')) tags.push('gluten-free');
  if (!allergens.includes('Dairy')) tags.push('dairy-free');
  return tags;
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
export function normalize(raw: RawRecipe): Recipe | null {
  const cat = lc(raw.category ?? '');
  // The planner is for dinners — skip desserts, drinks, breakfasts, sides, starters.
  if (['dessert', 'breakfast', 'side', 'starter'].includes(cat)) return null;
  if (has(lc(raw.name), 'cake', 'cookie', ' pie', 'pudding', 'dessert', 'pancake', 'smoothie', 'brownie', 'ice cream', 'cheesecake', 'muffin', 'scone', 'tart')) {
    return null;
  }

  const ingredients = parseIngredients(raw.ingredients);
  if (ingredients.length < 3) return null;
  const steps = splitSteps(raw.instructions);
  if (steps.length < 2) return null;

  const ingText = ' ' + ingredients.map((i) => i.name).join(' ') + ' ' + lc(raw.name) + ' ';
  const protein = inferProtein(raw.category, ingText);
  const cuisine = mapCuisine(raw.area, ingText);
  const techniques = inferTechniques(raw.instructions);
  const { prep, cook } = estimateTimes(techniques);
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
    primaryProtein: protein,
    vegetables: ingredients.filter((i) => i.department === 'Produce').map((i) => i.name).slice(0, 6),
    techniques,
    difficulty: difficultyFor(steps.length, prep + cook),
    spiceLevel: inferSpice(ingText),
    prepMinutes: prep,
    cookMinutes: cook,
    baseServings: makesLeftovers ? 6 : 4,
    nutrition,
    ingredients,
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
