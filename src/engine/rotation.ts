import { WeeklyPlan } from '@/domain/models';

import { localDateString } from './schedule';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Cross-week rotation memory: recipe id -> how many whole weeks ago that
 * recipe was last on a plan. `0` means "on a plan for the current week",
 * `1` means "last week", and an id that's absent has no recent history at
 * all (either never planned, or older than whatever plans were passed in).
 *
 * Why this exists: the engine had no memory beyond the week it was building,
 * so a favorited recipe carried a flat, permanent scoring bonus and came
 * back every single week — three hearted dishes meant three dishes returning
 * to the next menu. (`WEIGHTS.favorite`'s own comment called itself
 * "periodic reintroduction"; the periodicity was never implemented.) This is
 * the missing input, and it also revives AUDIT.md's P1.2 "cross-week
 * variety" recommendation, which was accepted and never scheduled.
 *
 * MAINS ONLY, deliberately. `meal.sideRecipeIds` is not folded in: a rice
 * pilaf or a simple green salad appearing most weeks is normal, not a defect,
 * and penalizing side repeats would repeat the M4.2 part 2 mistake of
 * applying a week-scoped signal at plate scope (ADVISOR-HANDOFF decision 23 —
 * `varietyBonus` had to be dropped from side scoring for exactly this
 * reason). `scoreSide` therefore consults the same map but finds no entry for
 * a side, which is the intended no-op.
 */
export type RecencyMap = Record<string, number>;

/**
 * Whole weeks between two week-start dates, floored at 0. A plan dated in
 * the future relative to `referenceISO` (a week planned ahead) counts as the
 * current week rather than a negative distance — it is emphatically not
 * "rested".
 */
function weeksBetween(referenceISO: string, weekStartISO: string): number {
  const reference = Date.parse(`${referenceISO}T00:00:00`);
  const start = Date.parse(`${weekStartISO}T00:00:00`);
  if (Number.isNaN(reference) || Number.isNaN(start)) return 0;
  const days = (reference - start) / MS_PER_DAY;
  return Math.max(0, Math.floor(days / 7));
}

/**
 * Fold `plans` (the active plan plus the rolling per-device archive) into a
 * `RecencyMap` against `referenceISO` (default: today — the week being built
 * starts today, and re-roll/pin decisions are also being made today). Pure:
 * no React, no I/O, no store imports.
 *
 * The smallest distance wins when a recipe appears in several plans, so a
 * dish cooked both 4 weeks ago and last week reads as "last week".
 *
 * Duplicate plan ids are harmless (they'd yield the same distance), and the
 * result is independent of the order `plans` arrives in — worth stating
 * because the archive is per-device and sorts newest-first, while the active
 * plan is prepended by the caller.
 */
export function recencyByRecipe(plans: WeeklyPlan[], referenceISO: string = localDateString()): RecencyMap {
  const map: RecencyMap = {};
  for (const plan of plans) {
    const weeksAgo = weeksBetween(referenceISO, plan.weekStartISO);
    for (const meal of plan.meals) {
      const existing = map[meal.recipeId];
      if (existing === undefined || weeksAgo < existing) map[meal.recipeId] = weeksAgo;
    }
  }
  return map;
}

/**
 * Weeks of rest before a favorited recipe is "due" again. Below this it earns
 * a fraction of `WEIGHTS.favorite`, ramping linearly: on a plan this week 0,
 * last week 1/3, two weeks ago 2/3, three or more weeks ago the full bonus.
 * A favorite with no recent history is fully due.
 */
export const FAVORITE_REST_WEEKS = 3;

/** 0…1 multiplier on the favorite bonus, by how long since it was planned. */
export function favoriteRestFactor(weeksAgo: number | undefined): number {
  if (weeksAgo === undefined) return 1;
  return Math.max(0, Math.min(1, weeksAgo / FAVORITE_REST_WEEKS));
}

/**
 * How many weeks a repeat stays discouraged. The penalty fades linearly to
 * nothing: on a plan this week 1, last week 0.75, four weeks ago 0. Chosen so
 * a dish is gently steered away from for about a month and then treated as
 * new again — long enough that a week doesn't echo the last one, short enough
 * that the library never feels artificially small.
 */
export const REPEAT_FADE_WEEKS = 4;

/** 0…1 repeat penalty factor for a recipe, by how long since it was planned. */
export function repeatPenaltyFactor(weeksAgo: number | undefined): number {
  if (weeksAgo === undefined) return 0;
  return Math.max(0, Math.min(1, 1 - weeksAgo / REPEAT_FADE_WEEKS));
}

/**
 * How many favorites can carry a full-strength bonus in one generated week.
 * Beyond this the bonus tapers to zero (1 favorite already picked -> half
 * strength, 2 -> none), so a household with a dozen well-rested favorites
 * gets a couple of them back per week rather than a menu made entirely of
 * re-runs. Favorites are never hard-excluded — a tapered favorite can still
 * win on its own merits, which is exactly what should happen when it's also
 * the best pantry match.
 */
export const FAVORITES_PER_WEEK = 2;

/** 0…1 multiplier on the favorite bonus, by how many favorites are already
 * on the week being built. */
export function favoriteCrowdingFactor(favoritesAlreadyChosen: number): number {
  return Math.max(0, 1 - favoritesAlreadyChosen / FAVORITES_PER_WEEK);
}

/**
 * Ratings needed before learned preferences (cuisine/protein/technique
 * affinity and the spice/complexity/budget/leftover/vegetable dials) count at
 * full strength. Below it they're damped proportionally, so a single week of
 * cooking nudges the next week instead of steering it: after 4 rated meals
 * the learner speaks at a third of its eventual volume.
 *
 * Deliberately asymmetric — this damps POSITIVE learned drift only.
 * `ratingsPenalty` and `blockedRecipeIds` are left at full strength on
 * purpose: a family that disliked a dish should be believed immediately,
 * while "you love Thai food" needs more than one good Tuesday to earn a
 * standing thumb on the scale.
 */
export const CONFIDENCE_FULL_AT_RATINGS = 12;

/** 0…1 confidence in learned positive preferences, from how much has been rated. */
export function learningConfidence(mealsRated: number | undefined): number {
  if (!mealsRated || mealsRated <= 0) return 0;
  return Math.max(0, Math.min(1, mealsRated / CONFIDENCE_FULL_AT_RATINGS));
}
