import { RecipeIngredient } from '@/domain/models';

import {
  buildUserRecipe,
  difficultyFromMinutes,
  estimateNutritionFromIngredients,
  inferAllergensFromIngredients,
  inferDietTagsFromIngredients,
  isUserRecipe,
  UserRecipeInput,
  validateUserRecipeInput,
} from './userRecipes';

const ing = (name: string, department: RecipeIngredient['department'] = 'Produce'): RecipeIngredient => ({
  name,
  quantity: 1,
  unit: 'piece',
  department,
});

const baseInput: UserRecipeInput = {
  name: 'Grandma\'s Chicken Soup',
  cuisine: 'American',
  primaryProtein: 'Chicken',
  baseServings: 4,
  prepMinutes: 10,
  cookMinutes: 20,
  ingredients: [ing('chicken thighs', 'Meat'), ing('carrots'), ing('celery')],
  steps: ['Simmer the chicken.', 'Add vegetables.', 'Season and serve.'],
  allergens: [],
};

describe('validateUserRecipeInput', () => {
  it('accepts a well-formed input', () => {
    expect(validateUserRecipeInput(baseInput)).toEqual([]);
  });

  it('rejects fewer than the minimum ingredients', () => {
    const errors = validateUserRecipeInput({ ...baseInput, ingredients: [] });
    expect(errors.some((e) => e.includes('ingredient'))).toBe(true);
  });

  it('rejects fewer than the minimum steps', () => {
    const errors = validateUserRecipeInput({ ...baseInput, steps: ['Only one step.'] });
    expect(errors.some((e) => e.includes('steps'))).toBe(true);
  });

  it('rejects a blank name', () => {
    const errors = validateUserRecipeInput({ ...baseInput, name: '   ' });
    expect(errors.some((e) => e.toLowerCase().includes('name'))).toBe(true);
  });
});

describe('inferAllergensFromIngredients', () => {
  it('detects dairy, gluten, and tree nuts with the profile-matching "Tree Nuts" label', () => {
    const ingredients = [ing('milk'), ing('flour'), ing('almonds')];
    const allergens = inferAllergensFromIngredients(ingredients);
    expect(allergens).toEqual(expect.arrayContaining(['Dairy', 'Gluten', 'Tree Nuts']));
    // Guards against re-introducing the importer's known 'TreeNuts' (no space) bug.
    expect(allergens).not.toContain('TreeNuts');
  });

  it('detects shellfish and peanuts', () => {
    const allergens = inferAllergensFromIngredients([ing('shrimp'), ing('peanut butter')]);
    expect(allergens).toEqual(expect.arrayContaining(['Shellfish', 'Peanuts']));
  });

  it('finds nothing in plain produce', () => {
    expect(inferAllergensFromIngredients([ing('carrots'), ing('celery')])).toEqual([]);
  });
});

describe('inferDietTagsFromIngredients', () => {
  it('tags a meatless, dairy-free, egg-free dish as vegan and vegetarian', () => {
    const ingredients = [ing('chickpeas'), ing('rice'), ing('olive oil')];
    const allergens = inferAllergensFromIngredients(ingredients);
    const tags = inferDietTagsFromIngredients('Beans', ingredients, allergens);
    expect(tags).toEqual(expect.arrayContaining(['vegetarian', 'vegan']));
  });

  it('does not tag a chicken dish as vegetarian', () => {
    const ingredients = [ing('chicken thighs', 'Meat')];
    const allergens = inferAllergensFromIngredients(ingredients);
    const tags = inferDietTagsFromIngredients('Chicken', ingredients, allergens);
    expect(tags).not.toContain('vegetarian');
  });

  it('omits gluten-free/dairy-free when those allergens are present', () => {
    const ingredients = [ing('flour'), ing('milk')];
    const allergens = inferAllergensFromIngredients(ingredients);
    const tags = inferDietTagsFromIngredients('None', ingredients, allergens);
    expect(tags).not.toContain('gluten-free');
    expect(tags).not.toContain('dairy-free');
  });
});

describe('estimateNutritionFromIngredients', () => {
  it('does not default to a value that trivially satisfies keto/low-carb for a starchy dish', () => {
    const nutrition = estimateNutritionFromIngredients([ing('pasta'), ing('tomato sauce')], 'None');
    // keto threshold is <=15g, low-carb <=35g (see filters.ts satisfiesDiet) —
    // a pasta dish must not slip under either by defaulting to 0.
    expect(nutrition.carbs).toBeGreaterThan(35);
  });

  it('gives a lighter carb estimate for a non-starchy dish', () => {
    const nutrition = estimateNutritionFromIngredients([ing('chicken breast', 'Meat'), ing('broccoli')], 'Chicken');
    expect(nutrition.carbs).toBeLessThanOrEqual(35);
  });
});

describe('difficultyFromMinutes', () => {
  it('rates a quick recipe Easy and a long one Hard', () => {
    expect(difficultyFromMinutes(10, 15)).toBe('Easy');
    expect(difficultyFromMinutes(30, 60)).toBe('Hard');
  });
});

describe('buildUserRecipe', () => {
  it('assembles a full Recipe with a user- prefixed id, not marked estimated', () => {
    const recipe = buildUserRecipe(baseInput);
    expect(isUserRecipe(recipe.id)).toBe(true);
    expect(recipe.estimated).toBeUndefined();
    expect(recipe.name).toBe(baseInput.name);
    expect(recipe.steps.length).toBe(3);
  });

  it('reuses the given id when editing', () => {
    const recipe = buildUserRecipe(baseInput, 'user-abc123');
    expect(recipe.id).toBe('user-abc123');
  });

  it('drops blank step rows', () => {
    const recipe = buildUserRecipe({ ...baseInput, steps: [...baseInput.steps, '   '] });
    expect(recipe.steps.length).toBe(3);
  });
});
