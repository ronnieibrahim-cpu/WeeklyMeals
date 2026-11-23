import { isMain } from '@/domain/models';

import { DISH_TWINS } from './dishTwins';
import { RECIPES, recipesById } from './recipes';

describe('DISH_TWINS', () => {
  it('every twin and every original is a live main', () => {
    const live = new Set(RECIPES.filter(isMain).map((r) => r.id));
    for (const [twin, original] of Object.entries(DISH_TWINS)) {
      expect([twin, live.has(twin)]).toEqual([twin, true]);
      expect([original, live.has(original)]).toEqual([original, true]);
    }
  });
  it('originals are canonical (never twins themselves)', () => {
    for (const original of Object.values(DISH_TWINS)) expect(DISH_TWINS[original]).toBeUndefined();
  });
  it('is stamped onto the library as sameDishAs', () => {
    for (const [twin, original] of Object.entries(DISH_TWINS)) expect(recipesById[twin].sameDishAs).toBe(original);
  });
});
