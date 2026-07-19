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
 * can re-apply the exact same pairing gate instead of duplicating it. */
export function fitsCombinedTime(main: Recipe, side: Recipe, intake: IntakeAnswers): boolean {
  return (
    main.prepMinutes + side.prepMinutes <= intake.maxPrepMinutes &&
    main.cookMinutes + side.cookMinutes <= intake.maxCookMinutes
  );
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
      const sauces = remaining.filter((c) => !c.provides || c.provides.length === 0);
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
