import { roughCostPerServing } from './cost';
import { makeRecipe } from './testFixtures';

describe('roughCostPerServing', () => {
  it('gives a pricier protein a higher base cost than a cheaper one, all else equal', () => {
    const beef = makeRecipe({ primaryProtein: 'Beef', ingredients: [] });
    const lentils = makeRecipe({ primaryProtein: 'Lentils', ingredients: [] });
    expect(roughCostPerServing(beef)).toBeGreaterThan(roughCostPerServing(lentils));
  });

  it('adds a little for each non-staple ingredient', () => {
    const bare = makeRecipe({ primaryProtein: 'Chicken', ingredients: [] });
    const loaded = makeRecipe({
      primaryProtein: 'Chicken',
      ingredients: [
        { name: 'a', quantity: 1, unit: 'piece', department: 'Produce' },
        { name: 'b', quantity: 1, unit: 'piece', department: 'Produce' },
      ],
    });
    expect(roughCostPerServing(loaded)).toBeGreaterThan(roughCostPerServing(bare));
  });

  it('does not count pantryStaple ingredients toward the extras cost', () => {
    const withStaple = makeRecipe({
      primaryProtein: 'Chicken',
      ingredients: [{ name: 'salt', quantity: 1, unit: 'tsp', department: 'Spices', pantryStaple: true }],
    });
    const bare = makeRecipe({ primaryProtein: 'Chicken', ingredients: [] });
    expect(roughCostPerServing(withStaple)).toBe(roughCostPerServing(bare));
  });
});
