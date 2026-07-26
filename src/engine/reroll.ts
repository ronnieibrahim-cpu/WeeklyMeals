import { isMain, Recipe, ShoppingList, WeeklyPlan } from '@/domain/models';

import { canonicalIngredientName } from './ingredientKey';
import { composeSides, fitsCombinedTime, saucePairsWithMain } from './mealComposition';
import { passesHardFilters, scoreRecipe, WEIGHTS } from './recommendation';
import { GenerateContext } from './recommendation/types';
import { todayOffset } from './schedule';

/**
 * M3.0/M4.7: exact canonical-name match first (folds a trailing plural, so
 * "carrots" on the list satisfies a recipe needing "carrot" symmetrically,
 * whichever side is singular); substring only as a fallback, and only in the
 * safe direction (an available name that's as long or longer than the
 * required name, containing it in full) — a shorter available name can never
 * satisfy a longer required one. Without this guard, having "cream" on hand
 * would wrongly satisfy a recipe that needs "coconut cream". Both sides are
 * folded through the same `canonicalIngredientName` used by the shopping
 * list's dedup, so "available" and "required" agree on what counts as the
 * same ingredient.
 */
function loosely(name: string, available: Set<string>): boolean {
  const n = canonicalIngredientName(name);
  if (available.has(n)) return true;
  for (const a of available) {
    if (a.length >= n.length && a.includes(n)) return true;
  }
  return false;
}

/**
 * Normalized set of ingredient names considered "available" for a strict
 * mid-week re-roll (M2.2): pantry items + everything already on this week's
 * shopping list (assume purchased) + the outgoing PLATE's own ingredients —
 * the main and its sides (M4.2 part 2) — so a plate can always re-qualify as
 * its own replacement. Recipe-flagged pantry staples (salt/oil/etc.) aren't
 * included here — they're treated as always on hand, checked separately in
 * `missingIngredients`, same as `buildShoppingList` already excludes them
 * from the list entirely.
 */
export function availableIngredients(
  pantry: string[],
  shoppingList: ShoppingList | null,
  outgoingRecipe: Recipe | undefined,
  outgoingSides: Recipe[] = [],
): Set<string> {
  const set = new Set<string>();
  for (const p of pantry) set.add(canonicalIngredientName(p));
  if (shoppingList) for (const item of shoppingList.items) set.add(canonicalIngredientName(item.ingredientName));
  if (outgoingRecipe) for (const ing of outgoingRecipe.ingredients) set.add(canonicalIngredientName(ing.name));
  for (const side of outgoingSides) for (const ing of side.ingredients) set.add(canonicalIngredientName(ing.name));
  return set;
}

/** Which of a recipe's own non-staple ingredients aren't in `available`. */
export function missingIngredients(recipe: Recipe, available: Set<string>): string[] {
  return recipe.ingredients
    .filter((ing) => !ing.pantryStaple && !loosely(ing.name, available))
    .map((ing) => ing.name);
}

/** Union of missing ingredients across a whole plate — main + its composed
 * sides (M4.2 part 2) — deduped. Strict re-roll evaluates the plate as a
 * whole, not just the main: a candidate whose composed sides need something
 * not on hand is no more offerable than a main that does. */
export function missingIngredientsForPlate(main: Recipe, sides: Recipe[], available: Set<string>): string[] {
  const names = new Set<string>();
  for (const name of missingIngredients(main, available)) names.add(name);
  for (const side of sides) for (const name of missingIngredients(side, available)) names.add(name);
  return Array.from(names);
}

/** A candidate main plus the sides `composeSides` picked for it — carried
 * together so a commit (`rerollMeal`) attaches EXACTLY the plate that was
 * evaluated as coverable, never recomputes sides after the fact (which
 * could silently pick something not actually on hand). */
export interface RerollCandidate {
  recipe: Recipe;
  sideRecipeIds: string[];
}

export interface RerollNearMiss extends RerollCandidate {
  missing: string[]; // 1-2 ingredient names, across the whole plate
}

export interface RerollOutcome {
  /** Fully coverable candidates, ranked best-first and diversified by cuisine
   * (up to `MAX_CANDIDATES`). Empty if none qualify. */
  candidates: RerollCandidate[];
  /**
   * Up to `MAX_NEAR_MISSES` plates each missing 1-2 ingredients across the
   * whole plate. Populated whenever the strict pool is thin
   * (`< NEAR_MISS_THRESHOLD` candidates), not only when it's empty — so a
   * sparse week offers real alternatives instead of a choice of three.
   * The caller must present them as a clearly separate, labeled section
   * BELOW the coverable candidates, never mixed in: Law #2's substance is
   * that a re-roll never implies a surprise store trip, and these are only
   * honest as "here's exactly what you'd need to grab."
   */
  nearMisses: RerollNearMiss[];
}

/**
 * How many coverable plates a re-roll offers, and when it also surfaces
 * near-misses.
 *
 * The old cap was 5 with near-misses shown ONLY when nothing qualified. In
 * practice the offered pool was routinely three: mid-week, `available` is
 * pantry + this week's list, so few OTHER plates are fully coverable — and
 * the biggest, most invisible shrinker was side composition. `composeSides`
 * picks the best-scoring sides with no notion of what's on hand, so a
 * perfectly coverable main was thrown out whenever its winning side happened
 * to need something you didn't have (see `coverableSides`).
 */
const MAX_CANDIDATES = 8;
/**
 * 3 -> 5. `scripts/checkRerollPool.ts` measures the fully-cookable pool at
 * well under one plate per scenario with an empty pantry: mid-week,
 * `available` is essentially this week's own shopping list, and few of 230
 * other mains are entirely covered by it. Widening the strict pool helps but
 * cannot fix that on its own, so the labeled "needs a couple of things" list
 * is what actually turns a re-roll into a choice. Each entry still spells out
 * exactly what's missing and still never touches the list on its own.
 */
const MAX_NEAR_MISSES = 5;
const NEAR_TIE_THRESHOLD = 5;
/** Below this many coverable plates, near-misses are offered alongside. At or
 * above it the strict list is already a real choice and near-misses stay
 * hidden — no store-trip pressure in a week that doesn't need it. */
const NEAR_MISS_THRESHOLD = NEAR_TIE_THRESHOLD;

/**
 * Sides that are themselves fully coverable from `available`. Composing a
 * candidate plate from only these makes the sides half of every plate
 * coverable BY CONSTRUCTION, so a main's eligibility comes down to the main's
 * own ingredients instead of an unlucky side pick. This strictly grows the
 * offered pool without loosening Law #2 one inch — the best side is still the
 * best side whenever it's actually on hand; only sides you can't make are
 * removed from consideration. A plate may end up with fewer sides as a
 * result, which `composeSides` already handles as its documented best-effort
 * behavior.
 */
function coverableSides(sidesPool: Recipe[], available: Set<string>): Recipe[] {
  return sidesPool.filter((s) => missingIngredients(s, available).length === 0);
}

/**
 * At most one plate per cuisine first, then backfill with the next-best
 * remaining — the same shape `rankReplacements` uses for draft swaps, and for
 * the same reason: without it "try another" can walk through several
 * near-identical dishes whenever one cuisine dominates the ranking, which is
 * a choice that isn't a choice. Input must already be ranked best-first;
 * this only reorders and caps, never re-scores.
 */
function diversifyByCuisine(ranked: RerollCandidate[], count: number): RerollCandidate[] {
  const picks: RerollCandidate[] = [];
  const usedCuisines = new Set<Recipe['cuisine']>();
  for (const candidate of ranked) {
    if (picks.length >= count) break;
    if (usedCuisines.has(candidate.recipe.cuisine)) continue;
    picks.push(candidate);
    usedCuisines.add(candidate.recipe.cuisine);
  }
  const pickedIds = new Set(picks.map((c) => c.recipe.id));
  for (const candidate of ranked) {
    if (picks.length >= count) break;
    if (pickedIds.has(candidate.recipe.id)) continue;
    picks.push(candidate);
    pickedIds.add(candidate.recipe.id);
  }
  return picks;
}

/** Assemble the final outcome: cuisine-diversified coverable plates, plus
 * near-misses when (and only when) the strict pool is thin. */
function outcomeFrom(candidates: RerollCandidate[], nearMisses: RerollNearMiss[]): RerollOutcome {
  return {
    candidates,
    nearMisses: candidates.length < NEAR_MISS_THRESHOLD ? nearMisses.slice(0, MAX_NEAR_MISSES) : [],
  };
}

/**
 * M4.5: which plate part(s) the user locked before re-rolling. Absent, or
 * `{ keepMain: false, keptSideIds: [] }`, means "no keep" — the ordinary
 * whole-plate re-roll (M2.2/M4.2 part 2), unchanged.
 */
export interface RerollKeepOptions {
  /** true = keep the outgoing plate's main, re-roll its sides. */
  keepMain: boolean;
  /** Side/sauce ids from the outgoing plate to carry over verbatim. Only
   * meaningful when `keepMain` is false (keep sides, re-roll the main) or
   * when it's true and the user pinned a subset of the current sides too;
   * defensively ignored below if a given id isn't actually on the outgoing
   * meal's `sideRecipeIds` — a stale/tampered id can never smuggle a side
   * onto a candidate plate that wasn't really there. */
  keptSideIds: string[];
}

type Provides = 'protein' | 'vegetable' | 'starch';

/** Mirrors `mealComposition.ts`'s private `hardMinimumMet` (protein +
 * vegetable-or-starch). Duplicated rather than imported — M4.5's scope
 * explicitly limits the change to that module to exporting
 * `fitsCombinedTime`. Keep in sync if the composition rule ever changes. */
function hardMinimumMet(provides: Set<Provides>): boolean {
  return provides.has('protein') && (provides.has('vegetable') || provides.has('starch'));
}

/**
 * Pure candidate selection for a mid-week re-roll. STRICT mode (✅ decided):
 * only PLATES — main + composed sides (M4.2 part 2) — fully coverable by
 * `available` qualify, evaluated as a whole; a re-roll must never imply a
 * new store trip, for the main or for whatever sides get composed onto it.
 * Excludes mains already used elsewhere in the week and anything failing the
 * existing hard filters (allergies, diet, time limits, dislikes) or blocked
 * by learning. Ranked with the same scoring function used elsewhere,
 * against the rest of the week's picks, so variety/preference still apply;
 * ties break by stable-sort array order (deterministic — not
 * shuffled/randomized). `recipes` is the FULL pool (mains + sides +
 * imported), split once here via `isMain()`.
 *
 * M4.5 adds an optional `keep` param for component re-roll ("keep the
 * chimichurri, change the meal"): keep the sides/sauce and re-roll only the
 * main, or keep the main and re-roll only the sides. Every candidate this
 * function emits — in every mode — still passes the identical hard filters
 * (allergy/diet/dislikes/blocked/time) a normal re-roll does; the allergy
 * re-check at commit time is the store's job (LAW #5), not a reason to relax
 * anything generated here.
 */
export function rerollCandidates(
  plan: WeeklyPlan,
  dayIndex: number,
  recipes: Recipe[],
  getRecipe: (id: string) => Recipe | undefined,
  available: Set<string>,
  ctx: GenerateContext,
  keep?: RerollKeepOptions,
): RerollOutcome {
  const outgoingMeal = plan.meals.find((m) => m.dayIndex === dayIndex);
  if (!outgoingMeal || outgoingMeal.cooked) return { candidates: [], nearMisses: [] };

  // Exclude every recipe already in this week's plan, including the
  // outgoing one itself — offering to "swap" a meal for itself isn't a
  // re-roll. Its ingredients still feed `available` (passed in by the
  // caller), which is the point: overlap with it makes real alternatives
  // easier to find.
  const usedIds = new Set(plan.meals.map((m) => m.recipeId));
  const selectedRecipes = plan.meals
    .filter((m) => m.dayIndex !== dayIndex)
    .map((m) => getRecipe(m.recipeId))
    .filter((r): r is Recipe => !!r);

  const mains = recipes.filter(isMain);
  const sidesPool = recipes.filter((r) => !isMain(r));
  const sidesById = new Map(sidesPool.map((s) => [s.id, s]));

  const blocked = new Set(ctx.preferences?.blockedRecipeIds ?? []);

  // Defensive (M4.5): a "kept" id only counts if it's really on the
  // outgoing plate right now.
  const outgoingSideIds = new Set(outgoingMeal.sideRecipeIds ?? []);
  const keptSideIds = (keep?.keptSideIds ?? []).filter((id) => outgoingSideIds.has(id));

  if (keep?.keepMain) {
    const outgoingMain = getRecipe(outgoingMeal.recipeId);
    if (!outgoingMain) return { candidates: [], nearMisses: [] };
    return rerollKeepMain(
      outgoingMain,
      outgoingSideIds,
      keptSideIds,
      sidesPool,
      sidesById,
      available,
      ctx,
      selectedRecipes,
      blocked,
    );
  }

  const pool = mains.filter(
    (r) => !usedIds.has(r.id) && !blocked.has(r.id) && passesHardFilters(r, ctx.intake, ctx.profile),
  );

  if (keptSideIds.length > 0) {
    return rerollKeepSides(pool, sidesPool, sidesById, keptSideIds, available, ctx, selectedRecipes);
  }

  // No-keep (default): the M2.2/M4.2 part 2 whole-plate re-roll.
  const onHandSides = coverableSides(sidesPool, available);
  const coverable: RerollCandidate[] = [];
  const shortfalls: RerollNearMiss[] = [];
  for (const r of pool) {
    // M4.3: score this candidate's sides for waste-fit against the rest of
    // the week's already-fixed mains (`selectedRecipes` — everything except
    // the outgoing day being re-rolled). Composed from the on-hand sides
    // only, so a coverable main is never disqualified by its side pick.
    const sideRecipeIds = composeSides(r, onHandSides, { ...ctx, weekRecipes: selectedRecipes });
    const sides = sideRecipeIds.map((id) => sidesById.get(id)).filter((s): s is Recipe => !!s);
    const missing = missingIngredientsForPlate(r, sides, available);
    if (missing.length === 0) coverable.push({ recipe: r, sideRecipeIds });
    else if (missing.length <= 2) shortfalls.push({ recipe: r, sideRecipeIds, missing });
  }

  return outcomeFrom(
    diversifyByCuisine(rankCandidates(coverable, ctx, selectedRecipes), MAX_CANDIDATES),
    rankNearMisses(shortfalls, ctx, selectedRecipes),
  );
}

/** Coverable plates, best-first. Deterministic: ties break by the stable
 * sort's input order, never shuffled (unlike draft generation). */
function rankCandidates(
  coverable: RerollCandidate[],
  ctx: GenerateContext,
  selectedRecipes: Recipe[],
): RerollCandidate[] {
  return [...coverable].sort(
    (a, b) => scoreRecipe(b.recipe, ctx, selectedRecipes) - scoreRecipe(a.recipe, ctx, selectedRecipes),
  );
}

/** Near-misses, fewest missing ingredients first, then best-scoring. */
function rankNearMisses(
  shortfalls: RerollNearMiss[],
  ctx: GenerateContext,
  selectedRecipes: Recipe[],
): RerollNearMiss[] {
  return [...shortfalls].sort(
    (a, b) =>
      a.missing.length - b.missing.length ||
      scoreRecipe(b.recipe, ctx, selectedRecipes) - scoreRecipe(a.recipe, ctx, selectedRecipes),
  );
}

/**
 * M4.5 mode "keep sides, re-roll the main": candidates are mains that pair
 * with the kept side/sauce — passing every hard filter a main normally does
 * — with the whole resulting plate still strictly coverable. `pool` is the
 * same candidate-main pool the no-keep path uses (unused-this-week, not
 * blocked, `passesHardFilters`).
 */
function rerollKeepSides(
  pool: Recipe[],
  sidesPool: Recipe[],
  sidesById: Map<string, Recipe>,
  keptSideIds: string[],
  available: Set<string>,
  ctx: GenerateContext,
  selectedRecipes: Recipe[],
): RerollOutcome {
  const keptSides = keptSideIds.map((id) => sidesById.get(id)).filter((s): s is Recipe => !!s);
  const keptSideIdSet = new Set(keptSideIds);
  const onHandSides = coverableSides(sidesPool, available);

  const coverable: RerollCandidate[] = [];
  const shortfalls: RerollNearMiss[] = [];

  for (const main of pool) {
    // Pairing gate (a): every kept side/sauce must still fit the combined
    // time budget with this candidate main.
    if (!keptSides.every((side) => fitsCombinedTime(main, side, ctx.intake))) continue;

    // Pairing gate (b): a kept side with real `provides` must still
    // contribute something this main doesn't already cover on its own.
    const mainProvides = new Set<Provides>((main.provides ?? []) as Provides[]);
    const clashes = keptSides.some(
      (side) =>
        side.provides && side.provides.length > 0 && side.provides.every((p) => mainProvides.has(p as Provides)),
    );
    if (clashes) continue;

    // Pairing gate (c) — M5.6. A kept SAUCE used to pass unconditionally
    // ("it has nothing to clash with"), which was true of `provides` and
    // false of the plate: keeping the gremolata and re-rolling the main
    // could land it on a Thai curry through a door `composeSides` had just
    // been taught to close. Product law #5 — the invariant belongs to the
    // pairing, not to the code path that first enforced it.
    const sauceMismatch = keptSides.some(
      (side) => (!side.provides || side.provides.length === 0) && !saucePairsWithMain(side, main),
    );
    if (sauceMismatch) continue;

    // Plate assembly: kept sides first, verbatim; top up only if the plate
    // is short of 2 sides AND the hard minimum still isn't met.
    let sideRecipeIds = [...keptSideIds];
    const plateProvides = new Set<Provides>(mainProvides);
    for (const side of keptSides) for (const p of side.provides ?? []) plateProvides.add(p as Provides);

    if (sideRecipeIds.length < 2 && !hardMinimumMet(plateProvides)) {
      // Top up from on-hand sides only, same reason as the no-keep path: a
      // main that pairs with the kept part shouldn't be lost to a side pick
      // that isn't cookable this week.
      const remainingPool = onHandSides.filter((s) => !keptSideIdSet.has(s.id));
      const additions = composeSides(main, remainingPool, { ...ctx, weekRecipes: selectedRecipes });
      sideRecipeIds = [...sideRecipeIds, ...additions.slice(0, 2 - sideRecipeIds.length)];
    }

    const sides = sideRecipeIds.map((id) => sidesById.get(id)).filter((s): s is Recipe => !!s);
    const missing = missingIngredientsForPlate(main, sides, available);
    if (missing.length === 0) coverable.push({ recipe: main, sideRecipeIds });
    else if (missing.length <= 2) shortfalls.push({ recipe: main, sideRecipeIds, missing });
  }

  const keptCuisines = new Set(keptSides.map((s) => s.cuisine));
  // M4.5: nudge a candidate main toward the front of the ranking when its
  // cuisine matches a kept side/sauce's — "candidates are mains that pair
  // with the kept part (cuisine fit)" (MILESTONE-4.md §M4.5). Reuses
  // `WEIGHTS.sideCuisineFit`'s magnitude — the existing side-vs-main
  // cuisine nudge in scoring.ts — because it's the same kind of
  // tie-breaking signal one level up the plate. Deliberately a local
  // sort-key adjustment rather than a change to `scoreRecipe`, which has
  // no notion of "kept parts" and shouldn't grow one just for this screen.
  const sortKey = (c: RerollCandidate) =>
    scoreRecipe(c.recipe, ctx, selectedRecipes) + (keptCuisines.has(c.recipe.cuisine) ? WEIGHTS.sideCuisineFit : 0);
  const ranked = [...coverable].sort((a, b) => sortKey(b) - sortKey(a));

  // Cuisine diversification is deliberately NOT applied here: this mode's
  // whole point is mains that pair with the kept part, and the sort key above
  // already rewards exactly that cuisine. Spreading candidates across cuisines
  // would fight it.
  return outcomeFrom(ranked.slice(0, MAX_CANDIDATES), rankNearMisses(shortfalls, ctx, selectedRecipes));
}

/**
 * M4.5 mode "keep the main, re-roll the sides": up to 3 distinct alternative
 * plates for the SAME outgoing main. Each alternative carries the kept
 * subset verbatim, first, plus newly composed sides that avoid every id
 * already on the outgoing plate — a re-roll must offer something different,
 * not just recompute the plate you already have.
 */
function rerollKeepMain(
  outgoingMain: Recipe,
  outgoingSideIds: Set<string>,
  keptSideIds: string[],
  sidesPool: Recipe[],
  sidesById: Map<string, Recipe>,
  available: Set<string>,
  ctx: GenerateContext,
  selectedRecipes: Recipe[],
  blocked: Set<string>,
): RerollOutcome {
  // The plate model caps at 2 sides total (`PlannedMeal.sideRecipeIds`). If
  // both slots are already pinned there's no room for anything new, and
  // nothing can be dropped either (the kept subset must stay verbatim) — so
  // there's no possible alternative plate to offer.
  const room = 2 - keptSideIds.length;
  if (room <= 0) return { candidates: [], nearMisses: [] };

  const excludeIds = new Set(outgoingSideIds); // never re-offer anything already on the plate
  const alternatives: RerollCandidate[] = [];

  while (alternatives.length < 3) {
    const eligiblePool = sidesPool.filter(
      (s) =>
        !blocked.has(s.id) &&
        passesHardFilters(s, ctx.intake, ctx.profile) &&
        fitsCombinedTime(outgoingMain, s, ctx.intake) &&
        // On-hand only, same rule as the other two modes — composing an
        // alternative plate out of sides you can't cook this week just burns
        // one of the three offers.
        missingIngredients(s, available).length === 0 &&
        !excludeIds.has(s.id),
    );
    const rawAdditions = composeSides(outgoingMain, eligiblePool, { ...ctx, weekRecipes: selectedRecipes });

    if (rawAdditions.length === 0) {
      // Nothing left to compose — the only remaining "alternative" is
      // dropping the unkept sides outright. That's a real, distinct plate
      // only if it actually differs from the current one, and it's only
      // offered once we've already found at least one composed alternative
      // — never as the very first offer (MILESTONE-4.md §M4.5).
      if (alternatives.length > 0) {
        const isSameAsCurrent =
          keptSideIds.length === outgoingSideIds.size && keptSideIds.every((id) => outgoingSideIds.has(id));
        if (!isSameAsCurrent) alternatives.push({ recipe: outgoingMain, sideRecipeIds: [...keptSideIds] });
      }
      break;
    }

    const additions = rawAdditions.slice(0, room);
    alternatives.push({ recipe: outgoingMain, sideRecipeIds: [...keptSideIds, ...additions] });
    // Force distinctness on the next pass: exclude everything this round
    // touched — including anything trimmed off by the cap — so the loop
    // always makes forward progress instead of re-composing the same set.
    for (const id of rawAdditions) excludeIds.add(id);
  }

  const coverable: RerollCandidate[] = [];
  const shortfalls: RerollNearMiss[] = [];
  for (const alt of alternatives) {
    const sides = alt.sideRecipeIds.map((id) => sidesById.get(id)).filter((s): s is Recipe => !!s);
    const missing = missingIngredientsForPlate(outgoingMain, sides, available);
    if (missing.length === 0) coverable.push(alt);
    else if (missing.length <= 2) shortfalls.push({ ...alt, missing });
  }

  // Keep-main keeps the original empty-only fallback rather than the
  // alongside rule the other two modes use: this mode offers at most 3
  // alternative plates for a FIXED main by design, so "fewer than
  // NEAR_MISS_THRESHOLD coverable" is always true here and the rule would
  // degenerate into "always show near-misses".
  if (coverable.length > 0) return { candidates: coverable, nearMisses: [] };
  return { candidates: [], nearMisses: shortfalls.slice(0, MAX_NEAR_MISSES) };
}

/**
 * M3.1: which day indices in `plan` are valid pin-to-week targets for
 * `recipeId` — today-or-future, not-yet-cooked days (the same rule reroll's
 * "↻ Re-roll" link already uses on This Week), and only if the recipe isn't
 * already sitting on some OTHER day of the same week (mirrors reroll's
 * duplicate exclusion — a recipe can't occupy two days at once). An empty
 * result means "can't be pinned right now" (already in the plan, or every
 * remaining day is cooked) and the caller should show why rather than a
 * silently-empty day picker.
 */
export function pinnableDays(plan: WeeklyPlan, recipeId: string, today: Date = new Date()): number[] {
  if (plan.meals.some((m) => m.recipeId === recipeId)) return [];
  const todayIndex = todayOffset(plan.weekStartISO, today);
  return plan.meals.filter((m) => m.dayIndex >= todayIndex && !m.cooked).map((m) => m.dayIndex);
}

/**
 * WHY a pin has no eligible day, as distinct causes rather than one empty
 * array. `pinnableDays` collapses three unrelated situations into `[]`, and
 * the pin screen used to print "already in this week's plan" for all of
 * them — so a week whose days have simply run out (the active plan is a few
 * days past its `weekStartISO`, e.g. while reviewing next week's draft)
 * wrongly told the user the recipe was already pinned. Order matters:
 * "already in the plan" is checked first because it's true regardless of
 * dates, then the two date/progress cases.
 *
 * - `already-in-plan`: it's on some day of this week already.
 * - `week-elapsed`: no day of the plan is today-or-later — the week has run
 *   past its end (the "Pick up from today" re-anchor, or a new week, is the
 *   real fix, and the copy should say so).
 * - `remaining-days-cooked`: there ARE upcoming days, but every one of them
 *   is already marked cooked — a cooked day is history and never a pin target.
 * - `null`: at least one day is pinnable.
 */
export type PinBlockReason = 'already-in-plan' | 'week-elapsed' | 'remaining-days-cooked';

export function pinBlockReason(
  plan: WeeklyPlan,
  recipeId: string,
  today: Date = new Date(),
): PinBlockReason | null {
  if (plan.meals.some((m) => m.recipeId === recipeId)) return 'already-in-plan';
  const todayIndex = todayOffset(plan.weekStartISO, today);
  const upcoming = plan.meals.filter((m) => m.dayIndex >= todayIndex);
  if (upcoming.length === 0) return 'week-elapsed';
  if (upcoming.every((m) => m.cooked)) return 'remaining-days-cooked';
  return null;
}
