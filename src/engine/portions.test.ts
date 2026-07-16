import { HouseholdMember } from '@/domain/models';

import { adultEquivalents, describeHouseholdServings, formatServings, memberFactor, servingsPerMeal } from './portions';

function adult(overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return { id: 'm', isChild: false, ...overrides };
}

function child(ageYears: number, overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return { id: 'c', isChild: true, ageYears, ...overrides };
}

describe('memberFactor — age band boundaries', () => {
  // Tested directly against the per-member factor (not the rounded
  // `adultEquivalents` aggregate): round-to-nearest-0.5 can't always
  // distinguish a 0.25 band from a 0.5 band when the rest of the household
  // sums to a whole number, so testing the table only through the rounded
  // total would be lossy. See the separate "rounding and floor" tests below
  // for aggregate-level behavior.
  const cases: Array<[number, number]> = [
    [0, 0],
    [0.9, 0], // under 1
    [1, 0.25],
    [2, 0.25],
    [2.9, 0.25],
    [3, 0.5],
    [5, 0.5],
    [5.9, 0.5],
    [6, 0.75],
    [9, 0.75],
    [9.9, 0.75],
    [10, 1.0],
    [13, 1.0],
  ];

  it.each(cases)('a %s-year-old child has factor %s', (age, expectedFactor) => {
    expect(memberFactor(child(age))).toBe(expectedFactor);
  });

  it('a child with no age set defaults to the 0.5 middle bracket', () => {
    expect(memberFactor({ id: 'c', isChild: true })).toBe(0.5);
  });
});

describe('adultEquivalents — eatsLikeAdult override', () => {
  it('an override always counts as a full adult regardless of age', () => {
    const members = [adult(), adult(), child(2, { eatsLikeAdult: true })];
    expect(adultEquivalents(members)).toBe(3.0); // 1 + 1 + 1.0
  });

  it('isChild:false with a contradictory age is still a full adult', () => {
    const members = [adult(), { id: 'a2', isChild: false, ageYears: 3 }];
    expect(adultEquivalents(members)).toBe(2.0); // 1 + 1
  });
});

describe('adultEquivalents — rounding and floor', () => {
  it('the spec worked example: 2 adults + a 3-year-old rounds to 2.5 portions', () => {
    const members = [adult(), adult(), child(3)];
    expect(adultEquivalents(members)).toBe(2.5);
  });

  it('rounds to the nearest 0.5', () => {
    // 1 adult + 1 child(age 7, 0.75 band) = 1.75 -> rounds to 2.0
    const members = [adult(), child(7)];
    expect(adultEquivalents(members)).toBe(2.0);
  });

  it('an all-under-1 household floors at 2.0', () => {
    const members = [child(0), child(0)];
    expect(adultEquivalents(members)).toBe(2.0);
  });

  it('a single-adult household reads as exactly 1.0 — the floor only guards 2+ people', () => {
    expect(adultEquivalents([adult()])).toBe(1.0);
  });

  it('a single-child household is not floored either, for the same reason', () => {
    expect(adultEquivalents([child(3)])).toBe(0.5);
  });

  it('the floor still applies once a second person joins, even a small child', () => {
    // 1 adult + 1 under-1 = 1.0 raw, which would round to itself with no
    // floor — the floor is what pushes a real 2-person household up to 2.0.
    expect(adultEquivalents([adult(), child(0)])).toBe(2.0);
  });
});

describe('servingsPerMeal — old-profile fallback', () => {
  it('falls back to familySize when members is empty', () => {
    expect(servingsPerMeal({ members: [], familySize: 4 })).toBe(4);
  });

  it('uses adultEquivalents when members is populated', () => {
    const members = [adult(), adult(), child(3)];
    expect(servingsPerMeal({ members, familySize: 99 })).toBe(2.5);
  });
});

describe('formatServings', () => {
  it('formats whole numbers without a decimal', () => {
    expect(formatServings(4)).toBe('4');
  });

  it('formats half-steps with one decimal', () => {
    expect(formatServings(2.5)).toBe('2.5');
  });
});

describe('describeHouseholdServings', () => {
  it('pluralizes correctly for 1 adult + 1 child', () => {
    const members = [adult(), child(3)];
    expect(describeHouseholdServings({ members, familySize: 4 })).toBe('1 adult + 1 child = 2 portions');
  });

  it('pluralizes correctly for 2 adults + 2 children', () => {
    const members = [adult(), adult(), child(3), child(6)];
    // 1 + 1 + 0.5 + 0.75 = 3.25 -> rounds to 3.5
    expect(describeHouseholdServings({ members, familySize: 4 })).toBe('2 adults + 2 children = 3.5 portions');
  });

  it('falls back to the bare familySize for a pre-migration profile with no members', () => {
    expect(describeHouseholdServings({ members: [], familySize: 4 })).toBe('4');
  });
});
