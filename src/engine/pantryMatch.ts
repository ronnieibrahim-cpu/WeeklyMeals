import { canonicalIngredientName } from './ingredientKey';

/**
 * M5.8: the ONE rule for "does having X on hand cover a recipe that needs Y?"
 * — used by the shopping list (pantry items stay off the list), the
 * servings-change prompt, strict re-roll's "what's available", and the
 * weekly pantry-overlap score. Before this, three different rules existed:
 * the shopping list's two-way substring ("Onions" on hand dropped green
 * onions, "Rice" dropped rice vinegar, "Chicken" dropped chicken broth) and
 * re-roll's one-way substring ("sausage" on hand counted as sage, "eggplant"
 * as egg).
 *
 * Deliberately an ALLOW-list, not an exclusion list. The two ways this can be
 * wrong are not equal: a false "you have it" is a missing ingredient
 * discovered at the stove; a false "you don't" is one extra line to tick off.
 * So anything not explicitly listed here is treated as a different item.
 *
 * X covers Y when, after folding plurals and stripping descriptors that
 * don't change what you'd buy, they are the same item — or one is the
 * generic form of the other (Ronnie, Sept 2026: "chicken" on hand covers
 * chicken thighs, and chicken thighs on hand cover a recipe asking for
 * "chicken"; varieties like feta vs "cheese" or black beans vs "beans" do
 * NOT count). Symmetric by construction.
 */

/** Descriptors that never change what you'd buy, for any ingredient. The
 * whole descriptor must precede the name ("fresh basil", "minced garlic"). */
const ANY_PREFIX = ['fresh', 'freshly chopped', 'minced', 'large', 'medium', 'small', 'boneless', 'skinless', 'bone-in', 'cooked'];
// Not "chopped": British "chopped tomatoes" are canned, not fresh.


/** Per-item same-thing varieties: `base` → descriptors that may precede it. */
const SAME_ITEM_PREFIXES: Record<string, string[]> = {
  onion: ['yellow', 'white', 'sweet', 'red'],
  rice: ['white', 'jasmine', 'long-grain', 'long grain'],
  potato: ['russet', 'yukon gold', 'baby', 'new', 'baby new', 'red', 'gold'],
  tomato: ['roma', 'plum', 'vine'],
  egg: ['whole'],
  cream: ['heavy', 'whipping'],
  yogurt: ['plain', 'full fat'],
  oregano: ['dried'],
  thyme: ['dried'],
  bread: ['white', 'sandwich', 'sourdough', 'crusty', 'day-old', 'stale'],
  spinach: ['baby'],
  cumin: ['ground'],
  cinnamon: ['ground'],
  turmeric: ['ground'],
  nutmeg: ['ground'],
  ketchup: ['tomato'],
  butter: ['unsalted', 'salted'],
};

/** Per-item trailing words that name the same purchase ("garlic cloves",
 * "basil leaves", "feta cheese"). Per item, never global: a global "leaves"
 * would turn "lime leaves" into lime, and "cloves" would turn ground cloves
 * into "ground". */
const SAME_ITEM_SUFFIXES: Record<string, string[]> = {
  garlic: ['clove', 'bulb'],
  basil: ['leave'],
  cilantro: ['leave'],
  mint: ['leave'],
  lemongrass: ['stalk'],
  celery: ['stalk'],
  salmon: ['fillet'],
  cod: ['fillet'],
  tilapia: ['fillet'],
  feta: ['cheese'],
  parmesan: ['cheese'],
  cheddar: ['cheese'],
  mozzarella: ['cheese'],
  gruyere: ['cheese'],
  provolone: ['cheese'],
  cotija: ['cheese'],
  ricotta: ['cheese'],
  halloumi: ['cheese'],
};

/** Generic name → the specific items it stands for (both directions count,
 * but two DIFFERENT specifics never cover each other). */
const GENERIC_COVERS: Record<string, string[]> = {
  chicken: ['chicken thigh', 'chicken breast', 'chicken drumstick', 'chicken wing', 'chicken leg', 'chicken tender'],
  'canned tomato': ['crushed tomato', 'diced tomato', 'chopped tomato', 'fire-roasted tomato', 'tinned tomato'],
};

/** Plural fold via the shopping list's own rule, plus the -oes plurals it
 * deliberately leaves alone (matching only — never changes list identity). */
function fold(name: string): string {
  return canonicalIngredientName(name.replace(/,/g, ' '))
    .replace(/\btomatoe?s?\b/g, 'tomato')
    .replace(/\bpotatoe?s?\b/g, 'potato');
}

/** Strip same-item descriptors until nothing more comes off. */
function core(name: string): string {
  let n = fold(name);
  for (let changed = true; changed; ) {
    changed = false;
    for (const [base, suffixes] of Object.entries(SAME_ITEM_SUFFIXES)) {
      for (const s of suffixes) {
        if (n === `${base} ${s}`) {
          n = base;
          changed = true;
        }
      }
    }
    for (const p of ANY_PREFIX) {
      if (n.startsWith(p + ' ')) {
        n = n.slice(p.length + 1);
        changed = true;
      }
    }
    for (const [base, prefixes] of Object.entries(SAME_ITEM_PREFIXES)) {
      for (const p of prefixes) {
        if (n === `${p} ${base}`) {
          n = base;
          changed = true;
        }
      }
    }
  }
  return n;
}

/** True when having `have` on hand means a recipe needing `need` needs
 * nothing more bought for that line. */
export function covers(have: string, need: string): boolean {
  const h = core(have);
  const n = core(need);
  if (h === n) return true;
  return (GENERIC_COVERS[h]?.includes(n) ?? false) || (GENERIC_COVERS[n]?.includes(h) ?? false);
}

/** True when any item in `onHand` covers `need`. */
export function coveredByAny(onHand: Iterable<string>, need: string): boolean {
  for (const have of onHand) if (covers(have, need)) return true;
  return false;
}
