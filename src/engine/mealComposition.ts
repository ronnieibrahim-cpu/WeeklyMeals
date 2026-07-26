import { IntakeAnswers, Recipe } from '@/domain/models';

import { passesHardFilters } from './recommendation/filters';
import { scoreSide } from './recommendation/scoring';
import { GenerateContext } from './recommendation/types';

const MAX_SIDES = 2;
type Provides = 'protein' | 'vegetable' | 'starch';

/** A side's own prep/cook time passes `passesHardFilters` on its own, but a
 * plate is cooked together — the intake's time limit is a promise about the
 * whole dinner, not just the entrée. Checked as two independent budgets
 * (prep, cook), same convention `passesHardFilters` already uses rather than
 * a single summed total. Exported (M4.5) so `reroll.ts`'s component re-roll
 * can re-apply the exact same pairing gate instead of duplicating it.
 *
 * M5.6: PREP is summed, COOK is the maximum of the two — hands are serial
 * (you chop the broccoli after the chicken, not during), but the oven and
 * the stovetop are not. Summing cook time modelled a kitchen where the
 * broccoli only goes in once the brisket comes out, and the effect was
 * severe: a 45-minute main against a 45-minute budget rejected every side
 * with any cook time at all, leaving only zero-cook sauces eligible. That's
 * why 274 plates were composed of two sauces and no real side. */
export function fitsCombinedTime(main: Recipe, side: Recipe, intake: IntakeAnswers): boolean {
  return (
    main.prepMinutes + side.prepMinutes <= intake.maxPrepMinutes &&
    Math.max(main.cookMinutes, side.cookMinutes) <= intake.maxCookMinutes
  );
}

/** Techniques whose dishes arrive at the table already carrying a sauce —
 * a pan sauce, a braising liquid, a glaze, a curry, a simmered stew. Drawn
 * from the technique vocabulary the library actually uses (`simmer` alone
 * covers 70 curated mains: tikka masala, chana masala, chili, the curries).
 * Deliberately excludes `stir-fry`: a stir-fry's sauce is in the technique
 * name's shadow, but the category check below plus each sauce's own
 * `pairsWith` list already handle those, and over-claiming here would strip
 * legitimately good pairings. */
const SAUCED_TECHNIQUES = new Set(['pan-sauce', 'braise', 'simmer', 'glaze', 'slow-cook', 'pressure-cook', 'poach']);

/** Categories whose dishes are sauce-bearing by definition. `RiceBowls` and
 * `OnePot` are deliberately NOT here even though many members are saucy:
 * they also contain the dishes that most want a sauce (falafel bowls want
 * tahini, Greek chicken bowls want tzatziki), and blocking those would trade
 * one wrong answer for another. */
const SAUCED_CATEGORIES = new Set(['Soups', 'Stews', 'Pasta']);

/** Is this main already sauced on its own? Derived from the main's existing
 * `techniques`/`categories` rather than a new hand-authored flag — 601 mains
 * is a content project, and the signal is already in the data. */
export function mainIsAlreadySauced(main: Recipe): boolean {
  return (
    main.techniques.some((t) => SAUCED_TECHNIQUES.has(t)) ||
    main.categories.some((c) => SAUCED_CATEGORIES.has(c))
  );
}

/**
 * M5.6: may this sauce go on this main? A hard gate, not a preference —
 * before it existed, the second plate slot fell through to "any sauce that
 * scores well," which put Salsa Roja on 286 plates and Tahini Sauce on 241,
 * including Thai curries and stir-fries. Two independent reasons to refuse:
 *
 * 1. The main already has a sauce of its own (`mainIsAlreadySauced`) — the
 *    chicken-piccata-plus-gremolata case that started this. Adding a second
 *    sauce to a dish that arrives sauced is wrong however well it scores.
 * 2. The main's cuisine isn't on the sauce's `pairsWith` allowlist.
 *
 * A sauce with no `pairsWith` authored fails closed (`?? []` — no cuisine
 * matches, so it never pairs). Failing closed is the right default for a
 * gate whose whole job is to say no: a new sauce added without its list is
 * invisible rather than universal, and `validateRecipes.ts` catches it
 * before it ships either way.
 *
 * Exported so `reroll.ts` can apply the identical gate to a KEPT sauce when
 * the main is re-rolled out from under it — the invariant belongs to the
 * pairing, not to the code path that happened to create it (product law #5).
 */
export function saucePairsWithMain(sauce: Recipe, main: Recipe): boolean {
  if (mainIsAlreadySauced(main)) return false;
  return (sauce.pairsWith ?? []).includes(main.cuisine);
}

/** Does adding `candidate` move the plate meaningfully forward? A sauce
 * (undefined/empty `provides`) never "duplicates" anything — it has nothing
 * to duplicate — so it's never excluded here; a real side/starch/vegetable
 * only qualifies if at least one of its `provides` entries isn't already on
 * the plate. Rejects a side that would only repeat what's already there. */
function providesGain(candidate: Recipe, plateProvides: Set<Provides>): boolean {
  if (!candidate.provides || candidate.provides.length === 0) return true;
  return candidate.provides.some((p) => !plateProvides.has(p));
}

function hardMinimumMet(plateProvides: Set<Provides>): boolean {
  return plateProvides.has('protein') && (plateProvides.has('vegetable') || plateProvides.has('starch'));
}

/**
 * Compose 0-2 sides for a given main (M4.2 part 2). Pure, no I/O, best-effort
 * — never throws, never guarantees the target, just returns whatever plate
 * is actually achievable from `sidesPool` under the hard filters. Some
 * curated mains (the frozen protein-less allowlist in
 * scripts/validateRecipes.ts) simply can't reach "protein + veg/starch" on
 * their own; if no protein-capable side clears every hard filter that week,
 * the plate stays short — no error, no placeholder, no nagging copy.
 *
 * Safety (non-negotiable): every candidate passes the exact same
 * `passesHardFilters` a main does — allergies, diet, dislikes, blocked ids,
 * time. A side is food; it can hurt someone just as badly as a main can.
 *
 * Priority, in order:
 * 1. Sides/starches that make genuine progress toward "protein +
 *    vegetable/starch" (the hard minimum), ranked by `scoreSide`.
 * 2. Once the hard minimum is met, further progress toward the full target
 *    (protein + vegetable + starch) — still ranked by `scoreSide`.
 * 3. Only once the hard minimum is already met and no more real gap-filling
 *    is possible does a sauce become eligible (flavor, not a plate
 *    component) — never at the cost of a genuine gap-filling pick, and never
 *    if the hard minimum still isn't met (a sauce can't make a plate safe).
 *    M5.6: eligibility is no longer automatic even then — the sauce must
 *    also pass `saucePairsWithMain`. If none does, the slot goes empty
 *    rather than to a sauce that doesn't belong on the dish.
 * Capped at `MAX_SIDES`. Never adds a side that duplicates what's already on
 * the plate (`providesGain`) — a vegetable is a preference, not a gate
 * (ADVISOR-HANDOFF #21), so this never blocks generation, only shapes it.
 */
export function composeSides(main: Recipe, sidesPool: Recipe[], ctx: GenerateContext): string[] {
  const blocked = new Set(ctx.preferences?.blockedRecipeIds ?? []);

  let remaining = sidesPool.filter(
    (s) =>
      !blocked.has(s.id) &&
      passesHardFilters(s, ctx.intake, ctx.profile) &&
      fitsCombinedTime(main, s, ctx.intake),
  );

  const chosen: Recipe[] = [];
  const plateProvides = new Set<Provides>((main.provides ?? []) as Provides[]);

  while (chosen.length < MAX_SIDES && remaining.length > 0) {
    const gapFillers = remaining.filter((c) => providesGain(c, plateProvides) && c.provides && c.provides.length > 0);

    let pick: Recipe | undefined;
    if (gapFillers.length > 0) {
      pick = gapFillers.reduce((best, c) => (scoreSide(c, main, ctx) > scoreSide(best, main, ctx) ? c : best));
    } else if (hardMinimumMet(plateProvides)) {
      // M5.6: a sauce must EARN the slot (`saucePairsWithMain`). It used to
      // be a consolation prize — the slot was free, so the best-scoring sauce
      // took it regardless of whether it belonged on the dish. When nothing
      // pairs, the plate stops short: one right side beats two wrong ones.
      const sauces = remaining.filter(
        (c) => (!c.provides || c.provides.length === 0) && saucePairsWithMain(c, main),
      );
      if (sauces.length === 0) break;
      pick = sauces.reduce((best, c) => (scoreSide(c, main, ctx) > scoreSide(best, main, ctx) ? c : best));
    } else {
      break; // best-effort: nothing left can move the plate toward safety
    }

    chosen.push(pick);
    for (const p of pick.provides ?? []) plateProvides.add(p as Provides);
    remaining = remaining.filter((c) => c.id !== pick!.id);
  }

  return chosen.map((r) => r.id);
}
