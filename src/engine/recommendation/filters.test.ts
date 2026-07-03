import { makeIntake, makeProfile, makeRecipe } from '../testFixtures';
import { passesHardFilters } from './filters';

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
