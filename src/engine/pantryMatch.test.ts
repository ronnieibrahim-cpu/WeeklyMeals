import { coveredByAny, covers } from './pantryMatch';

/** Assert both directions: `a` on hand vs recipe needing `b`, and vice versa. */
function bothWays(a: string, b: string, expected: boolean) {
  expect(covers(a, b)).toBe(expected);
  expect(covers(b, a)).toBe(expected);
}

describe('covers — the shared pantry/available matching rule (M5.8)', () => {
  it('matches the same item regardless of case, spacing or a trailing plural', () => {
    bothWays('Onions', 'onion', true);
    bothWays('  Rice ', 'rice', true);
    bothWays('Eggs', 'egg', true);
    bothWays('Tortillas', 'tortilla', true);
    bothWays('Potatoes', 'potato', true);
    bothWays('tomatoes', 'tomato', true);
  });

  describe('every mismatch the old two-way substring rule made, now kept apart in both directions', () => {
    it.each([
      ['Onions', 'green onions'],
      ['Onions', 'pearl onions'],
      ['Onions', 'spring onions'],
      ['Beans', 'green beans'],
      ['Beans', 'bean sprouts'],
      ['Rice', 'rice vinegar'],
      ['Rice', 'rice noodles'],
      ['Rice', 'rice wine'],
      ['Potatoes', 'sweet potatoes'],
      ['Garlic', 'garlic powder'],
      ['Garlic', 'garlic sauce'],
      ['Chicken', 'chicken broth'],
      ['Chicken', 'chicken stock'],
      ['Canned tomatoes', 'tomatoes'],
      ['Canned tomatoes', 'tomato'],
      ['Tortillas', 'tortilla chips'],
    ])('%s ≠ %s', (a, b) => bothWays(a, b, false));
  });

  describe("the old re-roll rule's one-way substring false matches are gone", () => {
    it.each([
      ['sausage', 'sage'],
      ['eggplant', 'egg'],
      ['egg noodles', 'eggs'],
      ['peanuts', 'peas'],
      ['pineapple', 'apple'],
      ['coconut cream', 'cream'],
      ['smoked paprika', 'paprika'],
      ['lime leaves', 'limes'],
      ['ground cloves', 'ground beef'],
      ['cream cheese', 'cream'],
      ['brown rice', 'rice'],
    ])('%s does not cover %s', (a, b) => bothWays(a, b, false));
  });

  it('same-item descriptors cover in both directions (decision 2)', () => {
    bothWays('Onions', 'yellow onion', true);
    bothWays('Onions', 'red onion', true);
    bothWays('Rice', 'jasmine rice', true);
    bothWays('Rice', 'long-grain rice', true);
    bothWays('Rice', 'cooked rice', true);
    bothWays('Potatoes', 'russet potatoes', true);
    bothWays('Potatoes', 'Yukon Gold potatoes', true);
    bothWays('Garlic', 'garlic cloves', true);
    bothWays('Garlic', 'minced garlic', true);
    bothWays('basil', 'fresh basil', true);
    bothWays('oregano', 'dried oregano', true);
    bothWays('salmon', 'salmon fillets', true);
    bothWays('feta', 'feta cheese', true);
    bothWays('cumin', 'ground cumin', true);
    bothWays('spinach', 'baby spinach', true);
    bothWays('basil', 'basil leaves', true);
    bothWays('ketchup', 'tomato ketchup', true);
    bothWays('butter', 'unsalted butter', true);
    bothWays('chicken thighs', 'boneless skinless chicken thighs', true);
    bothWays('chicken thighs', 'bone-in chicken thighs', true);
  });

  it('generic chicken covers each cut and each cut covers generic chicken, but cuts never cover each other', () => {
    for (const cut of ['chicken thighs', 'chicken breasts', 'chicken drumsticks', 'chicken wings', 'bone-in chicken thighs']) {
      bothWays('Chicken', cut, true);
    }
    bothWays('chicken thighs', 'chicken breasts', false);
    bothWays('Chicken', 'whole chicken', false);
    bothWays('Chicken', 'ground chicken', false);
  });

  it('"Canned tomatoes" covers the canned forms recipes actually name (decision 3), but not fresh or other tomato products', () => {
    for (const canned of ['crushed tomatoes', 'diced tomatoes', 'fire-roasted tomatoes']) bothWays('Canned tomatoes', canned, true);
    for (const other of ['cherry tomatoes', 'tomato paste', 'tomato sauce', 'sun-dried tomatoes']) bothWays('Canned tomatoes', other, false);
    bothWays('crushed tomatoes', 'diced tomatoes', false);
  });

  it('a general word does not cover a variety (decision 1)', () => {
    for (const cheese of ['feta cheese', 'blue cheese', 'cotija cheese', 'cheddar cheese', 'goat cheese']) bothWays('Cheese', cheese, false);
    for (const bean of ['black beans', 'pinto beans', 'kidney beans', 'refried beans', 'baked beans']) bothWays('Beans', bean, false);
    for (const rice of ['arborio rice', 'bomba rice', 'basmati rice']) bothWays('Rice', rice, false);
    bothWays('Tortillas', 'corn tortillas', false);
    bothWays('Pasta', 'penne pasta', false);
    bothWays('Ground beef', 'beef', false);
  });

  it('coveredByAny checks every item on hand', () => {
    expect(coveredByAny(['Rice', 'Onions'], 'yellow onion')).toBe(true);
    expect(coveredByAny(['Rice', 'Onions'], 'green onions')).toBe(false);
    expect(coveredByAny([], 'onion')).toBe(false);
  });
});
