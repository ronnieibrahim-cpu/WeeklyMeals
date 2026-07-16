import { HouseholdMember } from '@/domain/models';

import { adultEquivalents, describeHouseholdServings, formatServings, memberFactor, servingsPerMeal } from './portions';

const NOW = new Date(2026, 6, 16); // 2026-07-16, local

function adult(overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return { id: 'm', isChild: false, ...overrides };
}

function child(ageYears: number, overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return { id: 'c', isChild: true, ageYears, ...overrides };
}

/** Birthdate that makes someone exactly `age` years old as of NOW (birthday already happened this year, Jan 1). */
function birthDateForAge(age: number): string {
  return `${2026 - age}-01-01`;
}

describe('memberFactor — age band boundaries (via ageYears fallback)', () => {
  // Tested directly against the per-member factor (not the rounded
  // `adultEquivalents` aggregate): round-to-nearest-0.5 can't always
  // distinguish a 0.25 band from a 0.5 band when the rest of the household
  // sums to a whole number, so testing the table only through the rounded
  // total would be lossy. See the separate "rounding and floor" /
  // "birthday not yet reached" tests below for aggregate-level behavior.
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
    expect(memberFactor(child(age), NOW)).toBe(expectedFactor);
  });
});

describe('adultEquivalents — birthdate vs ageYears fallback', () => {
  it('prefers birthDateISO over ageYears when both are present', () => {
    // birthDateISO says 10 (adult factor 1.0), ageYears says 2 (0.25) — birthdate should win.
    const members = [adult(), adult(), child(2, { birthDateISO: birthDateForAge(10) })];
    expect(adultEquivalents(members, NOW)).toBe(3.0); // 1 + 1 + 1.0
  });

  it('falls back to ageYears when birthDateISO is absent', () => {
    const members = [adult(), adult(), child(6)]; // ageYears 6 -> 0.75 band
    // 1 + 1 + 0.75 = 2.75 -> rounds to the nearest 0.5 -> 3.0
    expect(adultEquivalents(members, NOW)).toBe(3.0);
  });

  it('a child with neither birthdate nor age defaults to the 0.5 middle bracket', () => {
    const members = [adult(), adult(), { id: 'c', isChild: true }];
    expect(adultEquivalents(members, NOW)).toBe(2.5); // 1 + 1 + 0.5
  });

  it('a birthday not yet reached this calendar year is not prematurely counted', () => {
    // NOW is 2026-07-16. Baseline is non-integer (1.75) specifically so the
    // 0.25-vs-0.5 factor difference below doesn't collapse under
    // round-to-nearest-0.5 (a whole-number baseline would make both cases
    // round to the same total, since X.25 and X.50 both round up to X.50).
    const baseline = [adult(), child(7)]; // 1 + 0.75 = 1.75
    // Turns 3 on 2026-08-01 -> not yet as of NOW -> still reads as age 2 (0.25 band).
    const notYetBirthday = [...baseline, child(0, { birthDateISO: '2023-08-01' })];
    // Turned 3 on 2026-07-01, already passed -> reads as age 3 (0.5 band).
    const alreadyHadBirthday = [...baseline, child(0, { birthDateISO: '2023-07-01' })];

    expect(adultEquivalents(notYetBirthday, NOW)).toBe(2.0); // 1.75 + 0.25 = 2.0
    expect(adultEquivalents(alreadyHadBirthday, NOW)).toBe(2.5); // 1.75 + 0.5 = 2.25 -> 2.5
  });
});

describe('adultEquivalents — eatsLikeAdult override', () => {
  it('an override always counts as a full adult regardless of age', () => {
    const members = [adult(), adult(), child(2, { eatsLikeAdult: true })];
    expect(adultEquivalents(members, NOW)).toBe(3.0); // 1 + 1 + 1.0
  });

  it('isChild:false with a contradictory age is still a full adult', () => {
    const members = [adult(), { id: 'a2', isChild: false, ageYears: 3 }];
    expect(adultEquivalents(members, NOW)).toBe(2.0); // 1 + 1
  });
});

describe('adultEquivalents — rounding and floor', () => {
  it('the spec worked example: 2 adults + a 3-year-old rounds to 2.5 portions', () => {
    const members = [adult(), adult(), child(3)];
    expect(adultEquivalents(members, NOW)).toBe(2.5);
  });

  it('rounds to the nearest 0.5', () => {
    // 1 adult + 1 child(age 7, 0.75 band) = 1.75 -> rounds to 2.0
    const members = [adult(), child(7)];
    expect(adultEquivalents(members, NOW)).toBe(2.0);
  });

  it('an all-under-1 household floors at 2.0', () => {
    const members = [child(0), child(0)];
    expect(adultEquivalents(members, NOW)).toBe(2.0);
  });

  it('a single-adult household reads as exactly 1.0 — the floor only guards 2+ people', () => {
    expect(adultEquivalents([adult()], NOW)).toBe(1.0);
  });

  it('a single-child household is not floored either, for the same reason', () => {
    expect(adultEquivalents([child(3)], NOW)).toBe(0.5);
  });

  it('the floor still applies once a second person joins, even a small child', () => {
    // 1 adult + 1 under-1 = 1.0 raw, which would round to itself with no
    // floor — the floor is what pushes a real 2-person household up to 2.0.
    expect(adultEquivalents([adult(), child(0)], NOW)).toBe(2.0);
  });
});

describe('servingsPerMeal — old-profile fallback', () => {
  it('falls back to familySize when members is empty', () => {
    expect(servingsPerMeal({ members: [], familySize: 4 }, NOW)).toBe(4);
  });

  it('uses adultEquivalents when members is populated', () => {
    const members = [adult(), adult(), child(3)];
    expect(servingsPerMeal({ members, familySize: 99 }, NOW)).toBe(2.5);
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
    expect(describeHouseholdServings({ members, familySize: 4 }, NOW)).toBe('1 adult + 1 child = 2 portions');
  });

  it('pluralizes correctly for 2 adults + 2 children', () => {
    const members = [adult(), adult(), child(3), child(6)];
    // 1 + 1 + 0.5 + 0.75 = 3.25 -> rounds to 3.5
    expect(describeHouseholdServings({ members, familySize: 4 }, NOW)).toBe('2 adults + 2 children = 3.5 portions');
  });

  it('falls back to the bare familySize for a pre-migration profile with no members', () => {
    expect(describeHouseholdServings({ members: [], familySize: 4 }, NOW)).toBe('4');
  });
});

describe('the load-bearing feature test: a household ages into a bigger portion count with zero data edits', () => {
  it('the same profile evaluated three years later yields a strictly larger servingsPerMeal', () => {
    // 2 adults + a child who is exactly 3 today (birthday already passed this year).
    const members = [adult(), adult(), child(0, { birthDateISO: birthDateForAge(3) })];
    const today = servingsPerMeal({ members, familySize: 3 }, NOW);
    expect(today).toBe(2.5); // 1 + 1 + 0.5 (age 3, the 3-5 band)

    const threeYearsLater = new Date(NOW.getFullYear() + 3, NOW.getMonth(), NOW.getDate());
    const later = servingsPerMeal({ members, familySize: 3 }, threeYearsLater);

    // Same `members`, zero edits — the child is now 6 (0.75 band instead of
    // 0.5, i.e. the 6-9 band), so the household reads larger automatically.
    expect(later).toBe(3.0); // 1 + 1 + 0.75 = 2.75 -> rounds to 3.0
    expect(later).toBeGreaterThan(today);
  });
});
