import { GenerateContext } from './recommendation/types';
import { composeSides } from './mealComposition';
import { makeIntake, makePreferences, makeProfile, makeRecipe } from './testFixtures';

function ctxFor(overrides: Partial<GenerateContext> = {}): GenerateContext {
  const profile = overrides.profile ?? makeProfile();
  const intake = overrides.intake ?? makeIntake(profile);
  return { profile, intake, pantry: [], season: 'summer', ...overrides };
}

const proteinOnlyMain = () =>
  makeRecipe({ id: 'main-steak', name: 'Steak', primaryProtein: 'Beef', provides: ['protein'], prepMinutes: 10, cookMinutes: 10 });

const vegSide = (overrides: Partial<Parameters<typeof makeRecipe>[0]> = {}) =>
  makeRecipe({
    id: 'side-veg',
    name: 'Green Beans',
    role: 'side',
    provides: ['vegetable'],
    primaryProtein: 'None',
    prepMinutes: 5,
    cookMinutes: 8,
    ...overrides,
  });

const starchSide = (overrides: Partial<Parameters<typeof makeRecipe>[0]> = {}) =>
  makeRecipe({
    id: 'side-starch',
    name: 'Rice',
    role: 'side',
    provides: ['starch'],
    primaryProtein: 'None',
    prepMinutes: 2,
    cookMinutes: 15,
    ...overrides,
  });

const sauce = (overrides: Partial<Parameters<typeof makeRecipe>[0]> = {}) =>
  makeRecipe({
    id: 'side-sauce',
    name: 'Chimichurri',
    role: 'sauce',
    provides: undefined,
    primaryProtein: 'None',
    prepMinutes: 10,
    cookMinutes: 0,
    ...overrides,
  });

const proteinSide = (overrides: Partial<Parameters<typeof makeRecipe>[0]> = {}) =>
  makeRecipe({
    id: 'side-protein',
    name: 'Fried Egg',
    role: 'side',
    provides: ['protein'],
    primaryProtein: 'Eggs',
    prepMinutes: 1,
    cookMinutes: 4,
    ...overrides,
  });

describe('composeSides — basic gap-filling', () => {
  it('adds a vegetable and a starch to a protein-only main', () => {
    const main = proteinOnlyMain();
    const ids = composeSides(main, [vegSide(), starchSide()], ctxFor());
    expect(ids.sort()).toEqual(['side-starch', 'side-veg']);
  });

  it('caps at 2 sides even with more gap-filling candidates available', () => {
    const main = makeRecipe({ id: 'main-none', primaryProtein: 'None', provides: [] });
    const pool = [
      proteinSide({ id: 'p1' }),
      vegSide({ id: 'v1' }),
      starchSide({ id: 's1' }),
    ];
    const ids = composeSides(main, pool, ctxFor());
    expect(ids.length).toBe(2);
  });

  it('is best-effort: returns whatever is achievable, never throws, when nothing can complete the plate', () => {
    const main = proteinOnlyMain();
    expect(() => composeSides(main, [], ctxFor())).not.toThrow();
    expect(composeSides(main, [], ctxFor())).toEqual([]);
  });

  it('never adds a side that duplicates what the main already provides', () => {
    // Main already has protein + starch; a second starch side contributes nothing.
    const main = makeRecipe({ id: 'main-ps', primaryProtein: 'Chicken', provides: ['protein', 'starch'] });
    const redundantStarch = starchSide({ id: 'redundant-starch' });
    const ids = composeSides(main, [redundantStarch], ctxFor());
    expect(ids).toEqual([]);
  });
});

describe('composeSides — safety (allergies, diet, dislikes, blocked)', () => {
  it('never selects a side containing a profile allergen', () => {
    const main = proteinOnlyMain();
    const unsafeVeg = vegSide({ id: 'unsafe', allergens: ['Peanuts'] });
    const safeStarch = starchSide();
    const profile = makeProfile({ allergies: ['Peanuts'] });
    const ids = composeSides(main, [unsafeVeg, safeStarch], ctxFor({ profile, intake: makeIntake(profile) }));
    expect(ids).not.toContain('unsafe');
  });

  it('excludes imported (estimated) sides entirely once any allergy is set, even if the estimated side itself has no matching allergen', () => {
    const main = proteinOnlyMain();
    // Synthetic estimated:true side — proves the guard actually fires, not
    // just vacuously passes because no imported sides exist yet.
    const estimatedVeg = vegSide({ id: 'imported-veg', estimated: true, allergens: [] });
    const curatedStarch = starchSide();
    const profile = makeProfile({ allergies: ['Tree Nuts'] }); // unrelated allergy — still excluded
    const ids = composeSides(main, [estimatedVeg, curatedStarch], ctxFor({ profile, intake: makeIntake(profile) }));
    expect(ids).not.toContain('imported-veg');
    expect(ids).toContain('side-starch');
  });

  it('excludes a disliked cuisine', () => {
    const main = proteinOnlyMain();
    const dislikedVeg = vegSide({ id: 'disliked', cuisine: 'Thai' });
    const okStarch = starchSide({ cuisine: 'American' });
    const profile = makeProfile({ dislikedCuisines: ['Thai'] });
    const ids = composeSides(main, [dislikedVeg, okStarch], ctxFor({ profile, intake: makeIntake(profile) }));
    expect(ids).not.toContain('disliked');
  });

  it('excludes a blocked recipe id', () => {
    const main = proteinOnlyMain();
    const ids = composeSides(
      main,
      [vegSide(), starchSide()],
      ctxFor({ preferences: makePreferences({ blockedRecipeIds: ['side-veg'] }) }),
    );
    expect(ids).not.toContain('side-veg');
  });

  it('excludes a side whose own diet fails the week\'s dietary restriction', () => {
    const main = proteinOnlyMain();
    const meatyVeg = vegSide({ dietTags: [] }); // not vegetarian-tagged, primaryProtein None though counts as vegetarian per satisfiesDiet
    const nonVegStarch = starchSide({ primaryProtein: 'Chicken', dietTags: [] });
    const profile = makeProfile();
    const intake = makeIntake(profile, { dietaryRestrictions: ['vegetarian'] });
    const ids = composeSides(main, [meatyVeg, nonVegStarch], ctxFor({ profile, intake }));
    expect(ids).not.toContain('side-starch');
  });
});

describe('composeSides — combined time budget', () => {
  it('excludes a side that would push the combined prep time over the intake limit', () => {
    const main = makeRecipe({ id: 'main-timed', primaryProtein: 'Beef', provides: ['protein'], prepMinutes: 25, cookMinutes: 10 });
    const intake = makeIntake(makeProfile(), { maxPrepMinutes: 30, maxCookMinutes: 60 });
    const tooSlowVeg = vegSide({ prepMinutes: 10 }); // 25 + 10 = 35 > 30
    const quickStarch = starchSide({ prepMinutes: 2 }); // 25 + 2 = 27 <= 30
    const ids = composeSides(main, [tooSlowVeg, quickStarch], ctxFor({ intake }));
    expect(ids).not.toContain('side-veg');
    expect(ids).toContain('side-starch');
  });

  it('excludes a side that would push the combined cook time over the intake limit', () => {
    const main = makeRecipe({ id: 'main-timed2', primaryProtein: 'Beef', provides: ['protein'], prepMinutes: 5, cookMinutes: 40 });
    const intake = makeIntake(makeProfile(), { maxPrepMinutes: 60, maxCookMinutes: 45 });
    const tooSlowStarch = starchSide({ cookMinutes: 20 }); // 40 + 20 = 60 > 45
    const quickVeg = vegSide({ cookMinutes: 5 }); // 40 + 5 = 45 <= 45
    const ids = composeSides(main, [tooSlowStarch, quickVeg], ctxFor({ intake }));
    expect(ids).not.toContain('side-starch');
    expect(ids).toContain('side-veg');
  });
});

describe('composeSides — priority order (hard minimum, then target, then sauce)', () => {
  it('prioritizes a gap-filling side over a sauce even when the sauce would score higher', () => {
    const main = proteinOnlyMain(); // hard minimum NOT yet met
    const highScoringSauce = sauce({ cuisine: main.cuisine }); // cuisine-fit bonus, high score
    const modestVeg = vegSide({ cuisine: 'Thai' }); // no cuisine-fit bonus
    const ids = composeSides(main, [highScoringSauce, modestVeg], ctxFor());
    // The sauce alone can't satisfy the hard minimum, so the vegetable (real
    // progress) must be picked before the sauce is ever eligible.
    expect(ids).toContain('side-veg');
  });

  it('only makes a sauce eligible once the hard minimum is met, filling both slots in priority order', () => {
    const main = proteinOnlyMain();
    const pool = [sauce(), vegSide()]; // no starch candidate available at all
    const ids = composeSides(main, pool, ctxFor());
    // Hard minimum (protein + vegetable) is met after the vegetable; only
    // then does the sauce become eligible for the second slot.
    expect(ids).toEqual(['side-veg', 'side-sauce']);
  });

  it('never picks a sauce at all if the hard minimum can never be met from the pool', () => {
    const main = proteinOnlyMain();
    const ids = composeSides(main, [sauce()], ctxFor());
    expect(ids).toEqual([]);
  });
});
