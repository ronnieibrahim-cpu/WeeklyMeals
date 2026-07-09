import { recipesById } from '@/data/seed/recipes';

import { makeIntake, makeProfile, makeRecipe } from '../testFixtures';
import { passesAllergySafety, passesHardFilters } from './filters';

describe('passesHardFilters', () => {
  it('rejects a recipe whose allergens intersect the profile allergies', () => {
    const recipe = makeRecipe({ allergens: ['Peanuts'] });
    const profile = makeProfile({ allergies: ['Peanuts'] });
    const intake = makeIntake(profile);
    expect(passesHardFilters(recipe, intake, profile)).toBe(false);
  });

  it('allows a recipe with no overlapping allergens', () => {
    const recipe = makeRecipe({ allergens: ['Gluten'] });
    const profile = makeProfile({ allergies: ['Peanuts'] });
    const intake = makeIntake(profile);
    expect(passesHardFilters(recipe, intake, profile)).toBe(true);
  });

  it('is case-insensitive when matching allergens', () => {
    const recipe = makeRecipe({ allergens: ['peanuts'] });
    const profile = makeProfile({ allergies: ['PEANUTS'] });
    const intake = makeIntake(profile);
    expect(passesHardFilters(recipe, intake, profile)).toBe(false);
  });

  it('excludes estimated (imported) recipes entirely once any allergy is set (P0-1 guard)', () => {
    // Imported recipes' allergen data is keyword-guessed, so once the
    // household has a real allergy, only hand-curated recipes are trusted.
    const recipe = makeRecipe({ allergens: [], estimated: true });
    const profile = makeProfile({ allergies: ['Peanuts'] });
    const intake = makeIntake(profile);
    expect(passesHardFilters(recipe, intake, profile)).toBe(false);
  });

  it('allows an estimated recipe through when the household has no allergies at all', () => {
    const recipe = makeRecipe({ allergens: [], estimated: true });
    const profile = makeProfile({ allergies: [] });
    const intake = makeIntake(profile);
    expect(passesHardFilters(recipe, intake, profile)).toBe(true);
  });

  it('rejects a recipe that fails a dietary restriction (vegan)', () => {
    const recipe = makeRecipe({ primaryProtein: 'Chicken', dietTags: [] });
    const profile = makeProfile();
    const intake = makeIntake(profile, { dietaryRestrictions: ['vegan'] });
    expect(passesHardFilters(recipe, intake, profile)).toBe(false);
  });

  it('allows a recipe tagged vegan under a vegan restriction', () => {
    const recipe = makeRecipe({ primaryProtein: 'Tofu', dietTags: ['vegan', 'vegetarian'] });
    const profile = makeProfile();
    const intake = makeIntake(profile, { dietaryRestrictions: ['vegan'] });
    expect(passesHardFilters(recipe, intake, profile)).toBe(true);
  });

  it('treats a vegetarian-friendly primary protein as satisfying "vegetarian" even without the tag', () => {
    const recipe = makeRecipe({ primaryProtein: 'Beans', dietTags: [] });
    const profile = makeProfile();
    const intake = makeIntake(profile, { dietaryRestrictions: ['vegetarian'] });
    expect(passesHardFilters(recipe, intake, profile)).toBe(true);
  });

  it('rejects a recipe over the prep-time limit', () => {
    const recipe = makeRecipe({ prepMinutes: 30 });
    const profile = makeProfile();
    const intake = makeIntake(profile, { maxPrepMinutes: 20, maxCookMinutes: 60 });
    expect(passesHardFilters(recipe, intake, profile)).toBe(false);
  });

  it('rejects a recipe over the cook-time limit', () => {
    const recipe = makeRecipe({ cookMinutes: 90 });
    const profile = makeProfile();
    const intake = makeIntake(profile, { maxPrepMinutes: 20, maxCookMinutes: 60 });
    expect(passesHardFilters(recipe, intake, profile)).toBe(false);
  });

  it('allows a recipe exactly at the time limits (boundary is inclusive)', () => {
    const recipe = makeRecipe({ prepMinutes: 20, cookMinutes: 60 });
    const profile = makeProfile();
    const intake = makeIntake(profile, { maxPrepMinutes: 20, maxCookMinutes: 60 });
    expect(passesHardFilters(recipe, intake, profile)).toBe(true);
  });

  it('rejects a recipe whose cuisine is disliked', () => {
    const recipe = makeRecipe({ cuisine: 'Thai' });
    const profile = makeProfile({ dislikedCuisines: ['Thai'] });
    const intake = makeIntake(profile);
    expect(passesHardFilters(recipe, intake, profile)).toBe(false);
  });

  it('rejects a recipe containing a disliked ingredient', () => {
    const recipe = makeRecipe({ ingredients: [{ name: 'Cilantro', quantity: 1, unit: 'bunch', department: 'Produce' }] });
    const profile = makeProfile({ dislikedIngredients: ['cilantro'] });
    const intake = makeIntake(profile);
    expect(passesHardFilters(recipe, intake, profile)).toBe(false);
  });

  it('allows a recipe with no disliked ingredients present', () => {
    const recipe = makeRecipe({ ingredients: [{ name: 'basil', quantity: 1, unit: 'bunch', department: 'Produce' }] });
    const profile = makeProfile({ dislikedIngredients: ['cilantro'] });
    const intake = makeIntake(profile);
    expect(passesHardFilters(recipe, intake, profile)).toBe(true);
  });

  it('rejects pork for a halal restriction', () => {
    const recipe = makeRecipe({ primaryProtein: 'Pork', dietTags: [] });
    const profile = makeProfile();
    const intake = makeIntake(profile, { dietaryRestrictions: ['halal'] });
    expect(passesHardFilters(recipe, intake, profile)).toBe(false);
  });

  it('allows non-pork proteins under a halal restriction', () => {
    const recipe = makeRecipe({ primaryProtein: 'Chicken', dietTags: [] });
    const profile = makeProfile();
    const intake = makeIntake(profile, { dietaryRestrictions: ['halal'] });
    expect(passesHardFilters(recipe, intake, profile)).toBe(true);
  });

  it('a recipe with no issues at all passes every filter', () => {
    const recipe = makeRecipe();
    const profile = makeProfile();
    const intake = makeIntake(profile);
    expect(passesHardFilters(recipe, intake, profile)).toBe(true);
  });
});

describe('passesAllergySafety (M3.1 — extracted for pin-to-week, which bypasses soft filters but not this)', () => {
  it('rejects a recipe whose allergens intersect the profile allergies', () => {
    const recipe = makeRecipe({ allergens: ['Peanuts'] });
    const profile = makeProfile({ allergies: ['Peanuts'] });
    expect(passesAllergySafety(recipe, profile)).toBe(false);
  });

  it('rejects an imported (estimated) recipe once any allergy is set, even with no listed allergens', () => {
    const recipe = makeRecipe({ allergens: [], estimated: true });
    const profile = makeProfile({ allergies: ['Peanuts'] });
    expect(passesAllergySafety(recipe, profile)).toBe(false);
  });

  it('allows an imported recipe when no allergy is set', () => {
    const recipe = makeRecipe({ allergens: [], estimated: true });
    const profile = makeProfile({ allergies: [] });
    expect(passesAllergySafety(recipe, profile)).toBe(true);
  });

  it('allows a curated recipe with no overlapping allergens even with an allergy set', () => {
    const recipe = makeRecipe({ allergens: ['Gluten'], estimated: false });
    const profile = makeProfile({ allergies: ['Peanuts'] });
    expect(passesAllergySafety(recipe, profile)).toBe(true);
  });

  it('does NOT block on soft mismatches — only passesHardFilters, not passesAllergySafety, considers them', () => {
    // A recipe that would fail passesHardFilters on time/dislikes/diet must
    // still pass the narrower allergy-only safety check (M3.1: an explicit
    // pin bypasses soft filters but never allergy safety).
    const recipe = makeRecipe({
      prepMinutes: 999,
      cookMinutes: 999,
      ingredients: [{ name: 'cilantro', quantity: 1, unit: 'bunch', department: 'Produce' }],
    });
    const profile = makeProfile({ dislikedIngredients: ['cilantro'] });
    const intake = makeIntake(profile, { maxPrepMinutes: 10, maxCookMinutes: 10 });

    expect(passesHardFilters(recipe, intake, profile)).toBe(false);
    expect(passesAllergySafety(recipe, profile)).toBe(true);
  });

  it('a Tree Nuts allergy excludes every curated tree-nut recipe, including the mislabeled one (P0-1)', () => {
    // fr-trout-amandine used to be labeled 'TreeNuts' (no space) while the
    // profile allergy is 'Tree Nuts' — the mismatch let it slip past the
    // filter. in-chicken-korma and cn-cashew-chicken were always labeled
    // correctly; all three must be excluded once allergens are normalized.
    const profile = makeProfile({ allergies: ['Tree Nuts'] });
    for (const id of ['fr-trout-amandine', 'in-chicken-korma', 'cn-cashew-chicken']) {
      const recipe = recipesById[id];
      expect(recipe).toBeDefined();
      expect(passesAllergySafety(recipe, profile)).toBe(false);
    }
  });

  it('normalizes allergen comparison across spacing/case so labels can never silently diverge again', () => {
    const recipe = makeRecipe({ allergens: ['TreeNuts'] });
    const profile = makeProfile({ allergies: ['Tree Nuts'] });
    expect(passesAllergySafety(recipe, profile)).toBe(false);
  });
});
