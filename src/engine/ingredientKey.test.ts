import { canonicalIngredientName, convertQuantity, ingredientDedupKey, mergeQuantities, unitFamily } from './ingredientKey';

describe('canonicalIngredientName', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(canonicalIngredientName('  Chicken   Thighs  ')).toBe('chicken thigh');
  });

  it('folds a simple trailing plural s', () => {
    expect(canonicalIngredientName('carrots')).toBe('carrot');
    expect(canonicalIngredientName('Carrot')).toBe('carrot');
    expect(canonicalIngredientName('eggs')).toBe('egg');
  });

  it('leaves words ending in "ss" untouched', () => {
    expect(canonicalIngredientName('swiss cheese')).toBe('swiss cheese');
  });

  it('leaves short (<=3 char) words untouched', () => {
    expect(canonicalIngredientName('gas')).toBe('gas');
    expect(canonicalIngredientName('yes')).toBe('yes');
  });

  it('does not attempt irregular plurals (documented gap)', () => {
    expect(canonicalIngredientName('tomatoes')).not.toBe(canonicalIngredientName('tomato'));
  });
});

describe('unitFamily', () => {
  it('groups every mass unit into "mass"', () => {
    expect(unitFamily('g')).toBe('mass');
    expect(unitFamily('kg')).toBe('mass');
    expect(unitFamily('oz')).toBe('mass');
    expect(unitFamily('lb')).toBe('mass');
  });

  it('groups every volume unit into "volume"', () => {
    expect(unitFamily('ml')).toBe('volume');
    expect(unitFamily('l')).toBe('volume');
    expect(unitFamily('tsp')).toBe('volume');
    expect(unitFamily('tbsp')).toBe('volume');
    expect(unitFamily('cup')).toBe('volume');
  });

  it('treats non-convertible units as their own standalone family', () => {
    expect(unitFamily('piece')).toBe('piece');
    expect(unitFamily('clove')).toBe('clove');
    expect(unitFamily('can')).toBe('can');
    expect(unitFamily('bunch')).toBe('bunch');
    expect(unitFamily('pinch')).toBe('pinch');
  });
});

describe('ingredientDedupKey', () => {
  it('merges plural/singular spellings under the same unit family', () => {
    expect(ingredientDedupKey('carrots', 'lb')).toBe(ingredientDedupKey('carrot', 'lb'));
  });

  it('keeps different unit families apart even for the same ingredient name', () => {
    expect(ingredientDedupKey('cotija cheese', 'oz')).not.toBe(ingredientDedupKey('cotija cheese', 'cup'));
  });

  it('keeps two different non-convertible units apart (piece vs clove)', () => {
    expect(ingredientDedupKey('garlic', 'piece')).not.toBe(ingredientDedupKey('garlic', 'clove'));
  });
});

describe('convertQuantity', () => {
  it('is a no-op when units match', () => {
    expect(convertQuantity(3, 'lb', 'lb')).toBe(3);
  });

  it('converts within the mass family', () => {
    expect(convertQuantity(1, 'lb', 'g')).toBeCloseTo(453.59, 2);
    expect(convertQuantity(453.59, 'g', 'lb')).toBeCloseTo(1, 5);
  });

  it('converts within the volume family', () => {
    expect(convertQuantity(1, 'cup', 'tbsp')).toBeCloseTo(16, 5);
    expect(convertQuantity(3, 'tsp', 'tbsp')).toBeCloseTo(1, 5);
  });
});

describe('mergeQuantities', () => {
  it('same-unit merge is exact addition (no conversion roundoff)', () => {
    expect(mergeQuantities(1, 'lb', 2, 'lb')).toEqual({ quantity: 3, unit: 'lb' });
  });

  it('700 g + 1 lb merges to ~2.54 lb (the larger of the two present units wins display)', () => {
    const merged = mergeQuantities(700, 'g', 1, 'lb');
    expect(merged.unit).toBe('lb');
    expect(merged.quantity).toBeCloseTo(2.54, 2);
  });

  it('is order-independent (700g+1lb === 1lb+700g)', () => {
    const a = mergeQuantities(700, 'g', 1, 'lb');
    const b = mergeQuantities(1, 'lb', 700, 'g');
    expect(a).toEqual(b);
  });

  it('2 tbsp + 0.5 cup merges to cup (the larger present unit), even though the result is under 1 cup', () => {
    const merged = mergeQuantities(2, 'tbsp', 0.5, 'cup');
    expect(merged.unit).toBe('cup');
    expect(merged.quantity).toBeCloseTo(0.63, 2); // 150ml / 240ml
  });

  it('a three-way pairwise fold (g, then oz, then lb) converges to the same total as merging all at once', () => {
    // 100g + 4oz(=113.4g) then +0.5lb(=226.795g) folded in pairwise, one at a time.
    const step1 = mergeQuantities(100, 'g', 4, 'oz');
    const step2 = mergeQuantities(step1.quantity, step1.unit, 0.5, 'lb');
    expect(step2.unit).toBe('lb'); // lb has the largest base factor seen so far
    const expectedGrams = 100 + 4 * 28.35 + 0.5 * 453.59;
    expect(step2.quantity).toBeCloseTo(expectedGrams / 453.59, 1);
  });
});
