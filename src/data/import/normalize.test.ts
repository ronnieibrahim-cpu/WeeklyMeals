import { RECIPES } from '@/data/seed/recipes';
import { inferAllergens, inferDietTags, inferProvides, parseMeasure, unsupportedProvides, usIngredientName, usStepText } from './normalize';

describe('parseMeasure — metric measures convert to customary units', () => {
  it('converts small gram amounts to ounces', () => {
    expect(parseMeasure('100g')).toEqual({ quantity: 3.5, unit: 'oz' });
    expect(parseMeasure('250 g')).toEqual({ quantity: 8.75, unit: 'oz' });
  });

  it('converts gram amounts at or above a pound to pounds', () => {
    expect(parseMeasure('500g')).toEqual({ quantity: 1, unit: 'lb' });
    expect(parseMeasure('1kg')).toEqual({ quantity: 2.25, unit: 'lb' });
  });

  it('converts small millilitre amounts to teaspoons', () => {
    expect(parseMeasure('10ml')).toEqual({ quantity: 2, unit: 'tsp' });
  });

  it('converts mid-range millilitre amounts to tablespoons', () => {
    expect(parseMeasure('30ml')).toEqual({ quantity: 2, unit: 'tbsp' });
  });

  it('converts larger millilitre/litre amounts to cups', () => {
    expect(parseMeasure('240ml')).toEqual({ quantity: 1, unit: 'cup' });
    expect(parseMeasure('1l')).toEqual({ quantity: 4.25, unit: 'cup' });
  });

  it('never leaves a converted quantity at zero', () => {
    expect(parseMeasure('1g').quantity).toBeGreaterThan(0);
    expect(parseMeasure('1ml').quantity).toBeGreaterThan(0);
  });

  it('leaves already-customary measures untouched', () => {
    expect(parseMeasure('1.5 lb')).toEqual({ quantity: 1.5, unit: 'lb' });
    expect(parseMeasure('2 tbsp')).toEqual({ quantity: 2, unit: 'tbsp' });
  });
});

describe('inferProvides — protein', () => {
  it('credits a real primaryProtein', () => {
    expect(inferProvides('Chicken', ' chicken thighs onion ')).toContain('protein');
  });

  it('does not credit protein for a "None" primaryProtein with no boost ingredient', () => {
    expect(inferProvides('None', ' zucchini tomato onion ')).not.toContain('protein');
  });

  it('credits cheese as protein even when primaryProtein is None', () => {
    // e.g. Baked Ziti: ricotta/mozzarella/parmesan, no meat.
    expect(inferProvides('None', ' ziti pasta ricotta mozzarella parmesan ')).toContain('protein');
  });

  it('credits eggs as protein, but not "eggplant"', () => {
    expect(inferProvides('None', ' eggs spinach ')).toContain('protein');
    expect(inferProvides('None', ' eggplant zucchini tomatoes ')).not.toContain('protein');
  });

  it('credits hummus and edamame as protein', () => {
    expect(inferProvides('None', ' cauliflower hummus tahini ')).toContain('protein');
    expect(inferProvides('None', ' soba noodles edamame cucumber ')).toContain('protein');
  });
});

describe('inferProvides — vegetable (garnish vs. real vegetable)', () => {
  it('does not count parsley as a vegetable — the exact bug report this was built for', () => {
    // Grilled Steak with Chimichurri: sirloin steak, parsley, garlic, red wine vinegar.
    const provides = inferProvides('Beef', ' sirloin steak parsley garlic red wine vinegar olive oil red pepper flakes ');
    expect(provides).not.toContain('vegetable');
  });

  it('does not count garlic, ginger, onion, or citrus as vegetables', () => {
    expect(inferProvides('Chicken', ' chicken garlic ginger onion lime lemon cilantro ')).not.toContain('vegetable');
  });

  it('counts a real vegetable like broccoli or bell pepper', () => {
    expect(inferProvides('Chicken', ' chicken broccoli soy sauce ')).toContain('vegetable');
    expect(inferProvides('Beef', ' beef bell pepper onion ')).toContain('vegetable');
  });

  it('does not mistake cornstarch/popcorn for corn-the-vegetable', () => {
    expect(inferProvides('Beef', ' beef cornstarch soy sauce ')).not.toContain('vegetable');
    expect(inferProvides('None', ' popcorn butter ')).not.toContain('vegetable');
  });

  it('counts real corn on the cob', () => {
    expect(inferProvides('None', ' corn on the cob mayonnaise lime ')).toContain('vegetable');
  });

  it('does not mistake chickpeas for peas-the-vegetable', () => {
    expect(inferProvides('None', ' chickpeas tahini garlic lemon ')).not.toContain('vegetable');
  });

  it('counts real peas', () => {
    expect(inferProvides('None', ' basmati rice frozen peas carrots ')).toContain('vegetable');
  });

  it('counts "egg plants" (two words, as TheMealDB spells it) the same as "eggplant"', () => {
    expect(inferProvides('None', ' egg plants peanut oil soy sauce ')).toContain('vegetable');
  });

  it('counts a marinara-sauce-based dish as containing a vegetable (tomato)', () => {
    expect(inferProvides('Chicken', ' chicken breasts marinara sauce mozzarella panko breadcrumbs ')).toContain('vegetable');
  });
});

describe('inferProvides — starch', () => {
  it('counts common staples: rice, pasta, potato, bread', () => {
    expect(inferProvides('None', ' basmati rice ')).toContain('starch');
    expect(inferProvides('None', ' russet potatoes butter milk ')).toContain('starch');
  });

  it('counts pasta shapes hasStarch misses, like linguine', () => {
    expect(inferProvides('Shellfish', ' shrimp linguine garlic ')).toContain('starch');
  });

  it('counts bread words hasStarch misses, like baguette and naan', () => {
    expect(inferProvides('None', ' onion gruyere cheese baguette butter ')).toContain('starch');
    expect(inferProvides('None', ' naan bread butter garlic ')).toContain('starch');
  });

  it('does not count a dish with no starch ingredient', () => {
    expect(inferProvides('Beef', ' sirloin steak parsley garlic ')).not.toContain('starch');
  });
});

describe('unsupportedProvides — the hard plausibility gate', () => {
  it('returns empty when every declared entry is backed by an ingredient', () => {
    expect(unsupportedProvides(['protein', 'starch'], 'Chicken', ['chicken thighs', 'rice'])).toEqual([]);
  });

  it('flags a declared entry with no supporting ingredient (the steak/parsley case)', () => {
    const result = unsupportedProvides(['protein', 'vegetable'], 'Beef', ['sirloin steak', 'parsley', 'garlic']);
    expect(result).toEqual(['vegetable']);
  });

  it('is asymmetric — does not flag an undeclared vegetable that is actually present', () => {
    // The dish has broccoli (a real vegetable) but only declares 'protein' —
    // that must NOT fail. Declaring every vegetable present is the
    // "must contain a vegetable" gate the product owner rejected.
    const result = unsupportedProvides(['protein'], 'Chicken', ['chicken thighs', 'broccoli']);
    expect(result).toEqual([]);
  });

  it('returns nothing for an undefined or empty provides', () => {
    expect(unsupportedProvides(undefined, 'Chicken', ['chicken thighs'])).toEqual([]);
    expect(unsupportedProvides([], 'Chicken', ['chicken thighs'])).toEqual([]);
  });

  it('flags multiple unsupported entries at once', () => {
    const result = unsupportedProvides(['vegetable', 'starch'], 'None', ['canned tuna', 'cannellini beans', 'parsley']);
    expect(result.sort()).toEqual(['starch', 'vegetable']);
  });
});

describe('inferAllergens — September 2026 keyword audit (only ever adds allergens)', () => {
  const allergensOf = (...names: string[]) => inferAllergens(' ' + names.join(' ') + ' ');

  it('flags gluten for named pasta shapes, breads, and pastry — not just the word "pasta"', () => {
    for (const name of ['spaghetti', 'lasagne sheets', 'fettuccine', 'orzo', 'puff pastry', 'filo pastry', 'baguette', 'burger buns', 'pitta bread', 'naan', 'flour tortillas', 'gnocchi', 'semolina', 'beer', 'hoisin sauce']) {
      expect(allergensOf(name)).toContain('Gluten');
    }
  });

  it('does not flag gluten for the classic gluten-free swaps, or for "bun" inside "bunch"', () => {
    for (const name of ['rice noodles', 'rice vermicelli', 'corn tortillas', 'tortilla chips', 'bunch of coriander', 'rolled oats']) {
      expect(allergensOf(name)).not.toContain('Gluten');
    }
  });

  it('flags sauces and spreads by what they are made from', () => {
    expect(allergensOf('mayonnaise')).toContain('Eggs');
    expect(allergensOf('oyster sauce')).toContain('Shellfish');
    expect(allergensOf('worcestershire sauce')).toContain('Fish');
    expect(allergensOf('dashi')).toContain('Fish');
    expect(allergensOf('hummus')).toContain('Sesame');
    expect(allergensOf('pesto')).toEqual(expect.arrayContaining(['Dairy', 'Tree Nuts']));
    expect(allergensOf('pine nuts')).toContain('Tree Nuts');
    expect(allergensOf('tamari')).toContain('Soy');
    expect(allergensOf('cheddar')).toContain('Dairy');
    expect(allergensOf('mackerel')).toContain('Fish');
  });

  it('does not mistake look-alike words for allergens', () => {
    expect(allergensOf('butternut squash')).not.toContain('Dairy');
    expect(allergensOf('water chestnuts')).not.toContain('Tree Nuts');
    expect(allergensOf('chestnut mushrooms')).not.toContain('Tree Nuts');
    expect(allergensOf('eggplant')).not.toContain('Eggs');
    expect(allergensOf('coconut milk')).not.toContain('Dairy');
  });
});

describe('inferDietTags — vegetarian means no meat anywhere in the dish', () => {
  const tagsOf = (protein: Parameters<typeof inferDietTags>[0], ...names: string[]) => {
    const text = ' ' + names.join(' ') + ' ';
    return inferDietTags(protein, inferAllergens(text), text);
  };

  it('rejects a protein-None dish made with duck, lard, or Worcestershire', () => {
    expect(tagsOf('None', 'duck legs', 'potatoes')).not.toContain('vegetarian');
    expect(tagsOf('Eggs', 'eggs', 'lard', 'flour')).not.toContain('vegetarian');
    expect(tagsOf('None', 'onions', 'worcestershire sauce')).not.toContain('vegetarian');
    expect(tagsOf('Beans', 'kidney beans', 'chicken stock')).not.toContain('vegetarian');
  });

  it('still tags genuinely vegetarian dishes, including kidney beans and goat cheese', () => {
    expect(tagsOf('Beans', 'kidney beans', 'onion', 'tomatoes')).toEqual(expect.arrayContaining(['vegetarian', 'vegan']));
    expect(tagsOf('None', 'goat cheese', 'beetroot')).toContain('vegetarian');
  });

  it('never tags a wheat pasta dish gluten-free', () => {
    expect(tagsOf('None', 'spaghetti', 'tomatoes', 'garlic')).not.toContain('gluten-free');
  });
});

describe('British → US names (M5.8 task 3)', () => {
  it('renames British ingredient names to what an H-E-B shopper buys', () => {
    expect(usIngredientName('courgettes')).toBe('zucchini');
    expect(usIngredientName('spring onions')).toBe('green onions');
    expect(usIngredientName('plain flour')).toBe('all-purpose flour');
    expect(usIngredientName('king prawns')).toBe('jumbo shrimp');
    expect(usIngredientName('minced beef')).toBe('ground beef');
    expect(usIngredientName('chicken stock')).toBe('chicken broth');
    expect(usIngredientName('red pepper')).toBe('red bell pepper');
  });

  it('bare coriander is the fresh herb; ground coriander and seeds stay the spice', () => {
    expect(usIngredientName('coriander')).toBe('cilantro');
    expect(usIngredientName('ground coriander')).toBe('ground coriander');
    expect(usIngredientName('coriander seeds')).toBe('coriander seeds');
  });

  it('leaves US and unrelated names alone ("minced garlic" is not mince)', () => {
    for (const n of ['minced garlic', 'mincemeat', 'black pepper', 'heavy cream', 'chicken breast']) {
      expect(usIngredientName(n)).toBe(n);
    }
  });

  it('renames in step text without touching ambiguous words', () => {
    expect(usStepText('Fry the courgettes and spring onions in the chicken stock.')).toBe(
      'Fry the zucchini and green onions in the chicken broth.',
    );
    expect(usStepText('Toast the coriander and a pinch of pepper.')).toBe('Toast the coriander and a pinch of pepper.');
  });

  it('the rename never changes inference: an eggplant import is an egg dish only if it lists eggs', () => {
    const imported = RECIPES.filter((r) => r.id.startsWith('mealdb-'));
    const eggplant = imported.filter((r) => r.ingredients.some((i) => i.name.includes('eggplant')));
    expect(eggplant.length).toBeGreaterThan(0);
    for (const r of eggplant.filter((x) => x.primaryProtein === 'Eggs')) {
      expect(r.ingredients.some((i) => /\beggs?\b/.test(i.name))).toBe(true);
    }
  });
});

describe('parseMeasure — TheMealDB unit spellings (M5.8 task 3b)', () => {
  it('reads tblsp/tbls/tsps as spoons, not pieces', () => {
    expect(parseMeasure('2 tblsp')).toEqual({ quantity: 2, unit: 'tbsp' });
    expect(parseMeasure('1 tbls')).toEqual({ quantity: 1, unit: 'tbsp' });
    expect(parseMeasure('2 tsps')).toEqual({ quantity: 2, unit: 'tsp' });
    expect(parseMeasure('1 tbsp.')).toEqual({ quantity: 1, unit: 'tbsp' });
  });

  it('gives loose amounts a customary unit', () => {
    expect(parseMeasure('splash')).toEqual({ quantity: 1, unit: 'tbsp' });
    expect(parseMeasure('knob')).toEqual({ quantity: 1, unit: 'tbsp' });
    expect(parseMeasure('2 handfuls')).toEqual({ quantity: 2, unit: 'cup' });
    expect(parseMeasure('sprinkling')).toEqual({ quantity: 1, unit: 'pinch' });
  });

  it('still counts genuinely countable things as pieces', () => {
    expect(parseMeasure('2 large')).toEqual({ quantity: 2, unit: 'piece' });
    expect(parseMeasure('1 chopped')).toEqual({ quantity: 1, unit: 'piece' });
  });

  it('a fresh herb to garnish is bought as a bunch', () => {
    const parsley = RECIPES.filter((r) => r.id.startsWith('mealdb-'))
      .flatMap((r) => r.ingredients)
      .filter((i) => i.name === 'parsley');
    expect(parsley.some((i) => i.unit === 'bunch')).toBe(true);
    expect(parsley.some((i) => i.unit === 'pinch')).toBe(false);
  });
});
