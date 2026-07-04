import { buildDepartmentGuessMap, guessDepartment, normalizeItemName } from './manualItems';
import { makeRecipe } from './testFixtures';

describe('normalizeItemName', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizeItemName('  Milk  ')).toBe('milk');
    expect(normalizeItemName('Dish   Soap')).toBe('dish soap');
  });

  it('treats different casing/spacing of the same name as the same key', () => {
    expect(normalizeItemName('Bananas')).toBe(normalizeItemName(' bananas '));
  });
});

describe('guessDepartment', () => {
  it('guesses the most common department an ingredient name appears under in the recipe library', () => {
    const recipes = [
      makeRecipe({ ingredients: [{ name: 'cabbage', quantity: 1, unit: 'piece', department: 'Produce' }] }),
      makeRecipe({ ingredients: [{ name: 'cabbage', quantity: 1, unit: 'piece', department: 'Produce' }] }),
      makeRecipe({ ingredients: [{ name: 'cabbage', quantity: 1, unit: 'piece', department: 'International' }] }),
    ];
    const map = buildDepartmentGuessMap(recipes);
    expect(guessDepartment('Cabbage', map)).toBe('Produce'); // 2-1 majority, case-insensitive lookup
  });

  it('falls back to Dry Goods for a name the recipe library has never seen', () => {
    const map = buildDepartmentGuessMap([makeRecipe()]);
    expect(guessDepartment('dish soap', map)).toBe('DryGoods');
  });
});
