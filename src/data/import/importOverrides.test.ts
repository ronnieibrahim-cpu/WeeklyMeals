import raw from './themealdb-raw.json';
import { IMPORT_DROPS, IMPORT_FIXES } from './importOverrides';
import { applyImportFix, fromMealDb, normalize } from './normalize';
import { getRecipe, RECIPES } from '@/data/seed/recipes';
import { recipeImported, recipeImportedRetired } from '@/data/seed/recipeImported';
import { buildShoppingList } from '@/engine/shoppingList';
import { makeMeal } from '@/engine/testFixtures';

const meals = raw as unknown as Record<string, string>[];
const rawById = new Map(meals.map((m) => [`mealdb-${m.idMeal}`, m]));

describe('applyImportFix — fixes go in before inference', () => {
  const base = { sourceId: '1', name: 'Test Stew', category: 'Beef', sourceName: 'TheMealDB',
    instructions: 'Brown the beef.\nSimmer until tender.',
    ingredients: [{ name: 'Beef', measure: '1 lb' }, { name: 'Onion', measure: '1' }, { name: 'Carrots', measure: '2' }] };

  it('re-infers allergens from an added ingredient', () => {
    const fixed = normalize(applyImportFix(base, { note: 'x', addIngredients: [{ name: 'Butter', measure: '2 tbs' }] }))!;
    expect(normalize(base)!.allergens).not.toContain('Dairy');
    expect(fixed.allergens).toContain('Dairy');
  });

  it('replaces steps and overrides the time guess', () => {
    const fix = { note: 'x', instructions: 'One.\nTwo.\nThree.', prepMinutes: 10, cookMinutes: 25 };
    const r = normalize(applyImportFix(base, fix), fix)!;
    expect(r.steps).toEqual(['One.', 'Two.', 'Three.']);
    expect([r.prepMinutes, r.cookMinutes]).toEqual([10, 25]);
  });
});

describe('importOverrides — every entry matches the generated corpus', () => {
  const liveIds = new Set(recipeImported.map((r) => r.id));
  const poolIds = new Set(RECIPES.map((r) => r.id));

  it('every drop is retired, out of the pool, and still resolves by id', () => {
    for (const id of Object.keys(IMPORT_DROPS)) {
      expect(IMPORT_DROPS[id].trim().length).toBeGreaterThan(0);
      expect(liveIds.has(id)).toBe(false);
      expect(poolIds.has(id)).toBe(false);
      expect(getRecipe(id)?.id).toBe(id);
    }
    expect(recipeImportedRetired.map((r) => r.id).sort()).toEqual(Object.keys(IMPORT_DROPS).sort());
  });

  it('every fix targets a live import and has a reason', () => {
    for (const [id, fix] of Object.entries(IMPORT_FIXES)) {
      expect(liveIds.has(id)).toBe(true);
      expect(fix.note.trim().length).toBeGreaterThan(0);
    }
  });

  it('a fix never loses an allergen unless it replaces the whole ingredient list', () => {
    for (const [id, fix] of Object.entries(IMPORT_FIXES)) {
      if (fix.ingredients) continue; // explicit rewrite — reviewed by hand in the batch report
      const before = normalize(fromMealDb(rawById.get(id)!))!.allergens;
      const after = recipeImported.find((r) => r.id === id)!.allergens;
      for (const a of before) expect([id, after.includes(a)]).toEqual([id, true]);
    }
  });
});

describe('a saved plan pointing at a recipe id that no longer exists', () => {
  it('builds the shopping list without it instead of crashing', () => {
    const live = recipeImported[0];
    const grocery = { name: 't', priceFor: () => ({ price: 1, productName: 'x' }) } as never;
    const list = buildShoppingList(
      'p', [makeMeal({ recipeId: 'mealdb-does-not-exist', dayIndex: 0 }), makeMeal({ recipeId: live.id, dayIndex: 1 })],
      getRecipe, [], grocery,
    );
    expect(list.items.length).toBeGreaterThan(0);
  });
});
