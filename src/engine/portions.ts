import { HouseholdMember, Profile } from '@/domain/models';

/**
 * Converts household composition into adult-equivalent servings (M4.1).
 * Pure, no I/O — every function that depends on "today" takes it as an
 * explicit `now: Date` argument rather than calling `new Date()` internally,
 * so a household right-sizes itself as a child ages, provably (see
 * portions.test.ts's "ages without edits" case) rather than only in prose.
 */

const MEMBER_BAND_FACTORS: Array<{ maxAge: number; factor: number }> = [
  { maxAge: 0, factor: 0 }, // under 1
  { maxAge: 2, factor: 0.25 }, // 1-2
  { maxAge: 5, factor: 0.5 }, // 3-5
  { maxAge: 9, factor: 0.75 }, // 6-9
];
const ADULT_FACTOR = 1.0; // 10+
/** Neither a birthdate nor an age was entered for a child row. */
const UNKNOWN_CHILD_AGE_FACTOR = 0.5;

/** Parses a plain `YYYY-MM-DD` local date string the same way
 * `parseWeekStart` in `engine/schedule.ts` does — never `new Date(str)`,
 * which treats a date-only string as UTC midnight. */
function parseLocalDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/** Calendar-aware age in whole years — a birthday later this calendar year
 * doesn't prematurely bump the bracket. */
function ageInYearsFromBirthDate(birthDateISO: string, now: Date): number | null {
  const birth = parseLocalDate(birthDateISO);
  if (!birth) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const birthdayNotYetReachedThisYear =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (birthdayNotYetReachedThisYear) age -= 1;
  return Math.max(0, age);
}

function factorForAge(age: number): number {
  const wholeYears = Math.floor(age); // bands are whole-year brackets ("3-5", "6-9", ...)
  for (const band of MEMBER_BAND_FACTORS) {
    if (wholeYears <= band.maxAge) return band.factor;
  }
  return ADULT_FACTOR;
}

/** Per-member adult-equivalent factor. `isChild` is the primary
 * discriminator (an "adult" row is always 1.0 regardless of what's in
 * `birthDateISO`/`ageYears`, so a data-entry mistake on an adult can't
 * silently shrink the household); age only refines the factor when
 * `isChild` is true. `eatsLikeAdult` always wins outright.
 *
 * Exported (unlike the rest of this module's internals) specifically so
 * tests can check the age-band table directly — `adultEquivalents` rounds
 * to the nearest 0.5, which can mask a real 0.25-vs-0.5 factor difference
 * when the rest of the household happens to sum to a whole number, so
 * testing the table only through the rounded aggregate would be lossy. */
export function memberFactor(member: HouseholdMember, now: Date): number {
  if (member.eatsLikeAdult) return ADULT_FACTOR;
  if (!member.isChild) return ADULT_FACTOR;

  const age = member.birthDateISO ? ageInYearsFromBirthDate(member.birthDateISO, now) : (member.ageYears ?? null);
  if (age === null) return UNKNOWN_CHILD_AGE_FACTOR;
  return factorForAge(age);
}

/**
 * Sum member factors, round to the nearest 0.5, floor at 2.0. Assumes
 * `members` is non-empty and meaningful — callers MUST check
 * `members.length === 0` themselves and fall back to `familySize` (see
 * `servingsPerMeal`); this function does NOT special-case emptiness, so
 * `adultEquivalents([], now)` returns 2.0 (the floor), which is
 * indistinguishable from a real floored household and must never be used as
 * an empty-check sentinel.
 */
export function adultEquivalents(members: HouseholdMember[], now: Date): number {
  const raw = members.reduce((sum, m) => sum + memberFactor(m, now), 0);
  const roundedToHalf = Math.round(raw * 2) / 2;
  return Math.max(2.0, roundedToHalf);
}

/** THE function every other module should call — centralizes the old-profile
 * fallback (no `members` populated yet) in one tested place instead of
 * repeating `members.length === 0 ? ... : ...` at every call site. */
export function servingsPerMeal(profile: Pick<Profile, 'members' | 'familySize'>, now: Date): number {
  return profile.members.length > 0 ? adultEquivalents(profile.members, now) : profile.familySize;
}

/** "4" not "4.0", "2.5" not a long float — used everywhere a fractional
 * serving count is shown. */
export function formatServings(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "2 adults + 1 child = 2.5 portions" for a real household, or the bare
 * headcount for a pre-migration profile with no `members`. Headcount
 * grouping ("2 adults + 1 child") uses `isChild` directly — it's a headcount
 * label, not a restatement of the weighted math. */
export function describeHouseholdServings(profile: Pick<Profile, 'members' | 'familySize'>, now: Date): string {
  if (profile.members.length === 0) return formatServings(profile.familySize);
  const adults = profile.members.filter((m) => !m.isChild).length;
  const children = profile.members.length - adults;
  const parts = [
    adults > 0 ? `${adults} adult${adults === 1 ? '' : 's'}` : null,
    children > 0 ? `${children} child${children === 1 ? '' : 'ren'}` : null,
  ].filter((p): p is string => p !== null);
  return `${parts.join(' + ')} = ${formatServings(servingsPerMeal(profile, now))} portions`;
}
