import { HouseholdMember, Profile } from '@/domain/models';

/**
 * Converts household composition into adult-equivalent servings (M4.1).
 * Pure, no I/O.
 */

const MEMBER_BAND_FACTORS: Array<{ maxAge: number; factor: number }> = [
  { maxAge: 0, factor: 0 }, // under 1
  { maxAge: 2, factor: 0.25 }, // 1-2
  { maxAge: 5, factor: 0.5 }, // 3-5
  { maxAge: 9, factor: 0.75 }, // 6-9
];
const ADULT_FACTOR = 1.0; // 10+
/** No age was entered for a child row. */
const UNKNOWN_CHILD_AGE_FACTOR = 0.5;

function factorForAge(age: number): number {
  const wholeYears = Math.floor(age); // bands are whole-year brackets ("3-5", "6-9", ...)
  for (const band of MEMBER_BAND_FACTORS) {
    if (wholeYears <= band.maxAge) return band.factor;
  }
  return ADULT_FACTOR;
}

/** Per-member adult-equivalent factor. `isChild` is the primary
 * discriminator (an "adult" row is always 1.0 regardless of what's in
 * `ageYears`, so a data-entry mistake on an adult can't silently shrink the
 * household); age only refines the factor when `isChild` is true.
 * `eatsLikeAdult` always wins outright.
 *
 * Exported (unlike the rest of this module's internals) specifically so
 * tests can check the age-band table directly — `adultEquivalents` rounds
 * to the nearest 0.5, which can mask a real 0.25-vs-0.5 factor difference
 * when the rest of the household happens to sum to a whole number, so
 * testing the table only through the rounded aggregate would be lossy. */
export function memberFactor(member: HouseholdMember): number {
  if (member.eatsLikeAdult) return ADULT_FACTOR;
  if (!member.isChild) return ADULT_FACTOR;

  if (member.ageYears === undefined) return UNKNOWN_CHILD_AGE_FACTOR;
  return factorForAge(member.ageYears);
}

/**
 * Sum member factors and round to the nearest 0.5. A 2.0 floor applies only
 * once there are 2+ people in the household — its job is to stop a genuine
 * couple/family from rounding down to less than 2 servings (e.g. two people
 * who'd otherwise compute to 1.75), not to inflate a household that's
 * actually just one person. A single adult reads as 1.0, not 2.0; a single
 * child reads as their own (possibly small) factor, unfloored.
 *
 * Assumes `members` is non-empty and meaningful — callers MUST check
 * `members.length === 0` themselves and fall back to `familySize` (see
 * `servingsPerMeal`); this function does NOT special-case emptiness, so
 * `adultEquivalents([])` returns 0 (no members to sum, and the floor
 * doesn't apply below 2 people) — a value that must never reach a shopping
 * list, which is exactly why callers go through `servingsPerMeal` instead.
 */
export function adultEquivalents(members: HouseholdMember[]): number {
  const raw = members.reduce((sum, m) => sum + memberFactor(m), 0);
  const roundedToHalf = Math.round(raw * 2) / 2;
  return members.length >= 2 ? Math.max(2.0, roundedToHalf) : roundedToHalf;
}

/** THE function every other module should call — centralizes the old-profile
 * fallback (no `members` populated yet) in one tested place instead of
 * repeating `members.length === 0 ? ... : ...` at every call site. Once a
 * household has any members, `familySize` is never read again — the members
 * list is the single source of truth. */
export function servingsPerMeal(profile: Pick<Profile, 'members' | 'familySize'>): number {
  return profile.members.length > 0 ? adultEquivalents(profile.members) : profile.familySize;
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
export function describeHouseholdServings(profile: Pick<Profile, 'members' | 'familySize'>): string {
  if (profile.members.length === 0) return formatServings(profile.familySize);
  const adults = profile.members.filter((m) => !m.isChild).length;
  const children = profile.members.length - adults;
  const parts = [
    adults > 0 ? `${adults} adult${adults === 1 ? '' : 's'}` : null,
    children > 0 ? `${children} child${children === 1 ? '' : 'ren'}` : null,
  ].filter((p): p is string => p !== null);
  return `${parts.join(' + ')} = ${formatServings(servingsPerMeal(profile))} portions`;
}
