import { autocompleteSuggestions, filterRecipes, searchRecipes } from './recipeSearch';
import { makeRecipe } from './testFixtures';

describe('searchRecipes', () => {
  it('an empty query returns every recipe untouched', () => {
    const recipes = [makeRecipe({ id: 'a' }), makeRecipe({ id: 'b' })];
    expect(searchRecipes(recipes, '')).toEqual(recipes);
  });

  it('matches a partial, case-insensitive name and ranks exact/prefix matches first', () => {
    const shakshuka = makeRecipe({ id: 'shak', name: 'Shakshuka' });
    const other = makeRecipe({ id: 'other', name: 'Something with shak in the middle' });
    const unrelated = makeRecipe({ id: 'unrelated', name: 'Tacos' });

    const results = searchRecipes([unrelated, other, shakshuka], 'shak');

    expect(results.map((r) => r.id)).toEqual(['shak', 'other']);
  });

  it('matches by ingredient name so "cabbage" finds every recipe using it', () => {
    const withCabbage = makeRecipe({
      id: 'with-cabbage',
      name: 'Slaw',
      ingredients: [{ name: 'cabbage', quantity: 1, unit: 'piece', department: 'Produce' }],
    });
    const without = makeRecipe({ id: 'without', name: 'Rice Bowl', ingredients: [] });

    const results = searchRecipes([without, withCabbage], 'cabbage');

    expect(results.map((r) => r.id)).toEqual(['with-cabbage']);
  });

  it('matches by cuisine and protein', () => {
    const thai = makeRecipe({ id: 'thai-dish', cuisine: 'Thai', primaryProtein: 'Beef', name: 'Green Curry', ingredients: [] });
    const chicken = makeRecipe({ id: 'chicken-dish', cuisine: 'Italian', primaryProtein: 'Chicken', name: 'Roast', ingredients: [] });
    const other = makeRecipe({ id: 'other', cuisine: 'Italian', primaryProtein: 'Beef', name: 'Ragu', ingredients: [] });

    expect(searchRecipes([thai, chicken, other], 'thai').map((r) => r.id)).toEqual(['thai-dish']);
    expect(searchRecipes([thai, chicken, other], 'chicken').map((r) => r.id)).toEqual(['chicken-dish']);
  });

  it('excludes recipes that match nothing', () => {
    const recipes = [makeRecipe({ id: 'a', name: 'Pasta', cuisine: 'Italian', primaryProtein: 'Chicken', ingredients: [] })];
    expect(searchRecipes(recipes, 'zzzznomatch')).toEqual([]);
  });
});

describe('autocompleteSuggestions', () => {
  it('an empty query returns no suggestions', () => {
    const recipes = [makeRecipe({ name: 'Shakshuka' })];
    expect(autocompleteSuggestions(recipes, '')).toEqual([]);
  });

  it('suggests matching names, cuisines, and ingredients, shortest first', () => {
    const recipes = [
      makeRecipe({ name: 'Cabbage Slaw', cuisine: 'American', ingredients: [{ name: 'cabbage', quantity: 1, unit: 'piece', department: 'Produce' }] }),
      makeRecipe({ name: 'Stuffed Cabbage Rolls', cuisine: 'American', ingredients: [] }),
    ];

    const suggestions = autocompleteSuggestions(recipes, 'cabbage');

    expect(suggestions).toContain('cabbage');
    expect(suggestions).toContain('Cabbage Slaw');
    expect(suggestions).toContain('Stuffed Cabbage Rolls');
    expect(suggestions[0]).toBe('cabbage'); // shortest match sorts first
  });

  it('deduplicates and respects the limit', () => {
    const recipes = Array.from({ length: 20 }, (_, i) => makeRecipe({ name: `Chicken Dish ${i}` }));
    const suggestions = autocompleteSuggestions(recipes, 'chicken', 5);
    expect(suggestions).toHaveLength(5);
    expect(new Set(suggestions).size).toBe(5);
  });
});

describe('filterRecipes', () => {
  it('filters by cuisine, protein, difficulty, and max total time independently', () => {
    const match = makeRecipe({
      id: 'match',
      cuisine: 'Thai',
      primaryProtein: 'Chicken',
      difficulty: 'Easy',
      prepMinutes: 10,
      cookMinutes: 10,
    });
    const wrongCuisine = makeRecipe({ id: 'wrong-cuisine', cuisine: 'Italian', primaryProtein: 'Chicken', difficulty: 'Easy' });
    const tooSlow = makeRecipe({ id: 'too-slow', cuisine: 'Thai', primaryProtein: 'Chicken', difficulty: 'Easy', prepMinutes: 60, cookMinutes: 60 });

    const results = filterRecipes([match, wrongCuisine, tooSlow], {
      cuisine: 'Thai',
      protein: 'Chicken',
      difficulty: 'Easy',
      maxTotalMinutes: 30,
    });

    expect(results.map((r) => r.id)).toEqual(['match']);
  });

  it('requires every selected category to be present (AND, not OR)', () => {
    const both = makeRecipe({ id: 'both', categories: ['Vegetarian', 'OnePot'] });
    const oneOnly = makeRecipe({ id: 'one-only', categories: ['Vegetarian'] });

    const results = filterRecipes([both, oneOnly], { categories: ['Vegetarian', 'OnePot'] });

    expect(results.map((r) => r.id)).toEqual(['both']);
  });

  it('favoritesOnly keeps only recipes whose id is in favoriteIds', () => {
    const fav = makeRecipe({ id: 'fav' });
    const notFav = makeRecipe({ id: 'not-fav' });

    const results = filterRecipes([fav, notFav], { favoritesOnly: true, favoriteIds: new Set(['fav']) });

    expect(results.map((r) => r.id)).toEqual(['fav']);
  });

  it('curatedOnly excludes mealdb- ids', () => {
    const curated = makeRecipe({ id: 'curated-recipe' });
    const imported = makeRecipe({ id: 'mealdb-imported' });

    const results = filterRecipes([curated, imported], { curatedOnly: true });

    expect(results.map((r) => r.id)).toEqual(['curated-recipe']);
  });

  it('no filters set returns every recipe untouched', () => {
    const recipes = [makeRecipe({ id: 'a' }), makeRecipe({ id: 'b' })];
    expect(filterRecipes(recipes, {})).toEqual(recipes);
  });
});
