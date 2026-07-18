import { inferProvides, unsupportedProvides } from './normalize';

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
