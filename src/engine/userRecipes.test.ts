import { Recipe, RecipeIngredient, UserRecipeSyncMap } from '@/domain/models';

import {
  buildUserRecipe,
  difficultyFromMinutes,
  estimateNutritionFromIngredients,
  inferAllergensFromIngredients,
  inferDietTagsFromIngredients,
  isUserRecipe,
  LEGACY_USER_RECIPE_TIMESTAMP,
  migrateUserRecipesMap,
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

describe('migrateUserRecipesMap (M5.4 backward-compatible load-time migration)', () => {
  const soup = buildUserRecipe(baseInput, 'user-soup');
  const pasta = buildUserRecipe({ ...baseInput, name: 'Weeknight Pasta' }, 'user-pasta');

  it('wraps the pre-M5.4 plain Record<id, Recipe> shape into live entries', () => {
    const legacyPersisted: Record<string, Recipe> = { 'user-soup': soup, 'user-pasta': pasta };

    const migrated = migrateUserRecipesMap(legacyPersisted);

    expect(migrated['user-soup']).toEqual({
      recipe: soup,
      updatedAtISO: LEGACY_USER_RECIPE_TIMESTAMP,
      deleted: false,
      deletedAtISO: null,
    });
    expect(migrated['user-pasta'].recipe.name).toBe('Weeknight Pasta');
  });

  it('the public view derived from a migrated map (live entries, unwrapped) shows every pre-existing recipe untouched', () => {
    const legacyPersisted: Record<string, Recipe> = { 'user-soup': soup };
    const migrated = migrateUserRecipesMap(legacyPersisted);

    // Mirrors userRecipesStore's own derivation (filter !deleted, unwrap .recipe).
    const publicRecipesMap = Object.fromEntries(
      Object.entries(migrated).filter(([, e]) => !e.deleted).map(([id, e]) => [id, e.recipe]),
    );
    expect(publicRecipesMap['user-soup']).toEqual(soup);
  });

  it('tolerates the current (post-M5.4) enveloped shape without re-wrapping it', () => {
    const alreadyEnveloped: UserRecipeSyncMap = {
      'user-soup': { recipe: soup, updatedAtISO: '2026-07-01T00:00:00.000Z', deleted: false, deletedAtISO: null },
    };
    const migrated = migrateUserRecipesMap(alreadyEnveloped);
    expect(migrated).toEqual(alreadyEnveloped);
  });

  it('is idempotent: migrating an already-migrated map returns it unchanged', () => {
    const legacyPersisted: Record<string, Recipe> = { 'user-soup': soup };
    const once = migrateUserRecipesMap(legacyPersisted);
    const twice = migrateUserRecipesMap(once);
    expect(twice).toEqual(once);
  });

  it('tolerates null/undefined/malformed input without throwing', () => {
    expect(migrateUserRecipesMap(null)).toEqual({});
    expect(migrateUserRecipesMap(undefined)).toEqual({});
    expect(migrateUserRecipesMap('not an object')).toEqual({});
    expect(migrateUserRecipesMap({ garbage: 'not a recipe' })).toEqual({});
  });

  it('tolerates a mix of legacy and enveloped entries in the same map', () => {
    const mixed = {
      'user-soup': soup, // legacy: plain Recipe
      'user-pasta': { recipe: pasta, updatedAtISO: '2026-07-01T00:00:00.000Z', deleted: true, deletedAtISO: '2026-07-01T00:00:00.000Z' }, // enveloped
    };
    const migrated = migrateUserRecipesMap(mixed);
    expect(migrated['user-soup'].deleted).toBe(false);
    expect(migrated['user-pasta'].deleted).toBe(true);
  });
});
