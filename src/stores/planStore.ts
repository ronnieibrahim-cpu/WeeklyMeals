import { create } from 'zustand';

import { hebProvider } from '@/data/grocery/heb/HebProvider';
import { localDraftPlanRepository } from '@/data/repositories/local/LocalDraftPlanRepository';
import { localPlanRepository } from '@/data/repositories/local/LocalPlanRepository';
import { localShoppingListRepository } from '@/data/repositories/local/LocalShoppingListRepository';
import { createDefaultProfile } from '@/domain/defaults';
import { IntakeAnswers, isMain, PlannedMeal, Profile, RatingEvent, Recipe, ShoppingList, ShoppingListDelta, WeeklyPlan } from '@/domain/models';
import { composeSides } from '@/engine/mealComposition';
import { servingsPerMeal as computeServingsPerMeal } from '@/engine/portions';
import { moveMeal as moveMealInPlan } from '@/engine/rearrange';
import { GenerateContext, localRecommendationEngine, passesAllergySafety, passesHardFilters, rankReplacements } from '@/engine/recommendation';
import { availableIngredients, missingIngredients, missingIngredientsForPlate, pinBlockReason, PinBlockReason, pinnableDays, RerollKeepOptions, RerollOutcome, rerollCandidates } from '@/engine/reroll';
import { localDateString, localMidnight } from '@/engine/schedule';
import { seasonForDate } from '@/engine/season';
import { addIngredientsToShoppingList, applyShoppingListDelta, buildShoppingList, computeServingsDelta, reconcileDeltaWithList } from '@/engine/shoppingList';
import { createId } from '@/utils/id';

import { useCookModeStore } from './cookModeStore';
import { useLearningStore } from './learningStore';
import { useManualItemsStore } from './manualItemsStore';
import { usePantryStore } from './pantryStore';
import { usePlanHistoryStore } from './planHistoryStore';
import { useProfileStore } from './profileStore';
import { allRecipesList, getAnyRecipe, mainRecipesList } from './userRecipesStore';

/** The non-main slice of `allRecipesList()` — the candidate pool
 * `composeSides` picks from. Small helper so every call site that composes
 * sides derives it the same way. */
function sidesPool(): Recipe[] {
  return allRecipesList().filter((r) => !isMain(r));
}

function resolveRecipes(ids: string[]): Recipe[] {
  return ids.map(getAnyRecipe).filter((r): r is Recipe => !!r);
}

/** M4.3: the resolved recipes (each other meal's main plus its already-known
 * sides) of every day EXCEPT `excludeDayIndex` — the waste-fit comparison
 * pool passed as `weekRecipes` when composing sides for the day being
 * swapped/pinned/completed. Kept simple: reads whatever `sideRecipeIds` the
 * other meals already carry rather than recomposing them. */
function otherWeekRecipes(meals: PlannedMeal[], excludeDayIndex: number): Recipe[] {
  return meals
    .filter((m) => m.dayIndex !== excludeDayIndex)
    .flatMap((m) => resolveRecipes([m.recipeId, ...(m.sideRecipeIds ?? [])]));
}

function context(intake: IntakeAnswers, profile: Profile, lockedRecipeIds: string[]): GenerateContext {
  const learning = useLearningStore.getState();
  return {
    intake,
    profile,
    preferences: learning.preferences,
    favoriteRecipeIds: learning.favorites,
    kidApprovedRecipeIds: learning.kidApproved,
    pantry: intake.ingredientsAtHome,
    season: seasonForDate(new Date()),
    lockedRecipeIds,
  };
}

interface PlanState {
  intake: IntakeAnswers | null;
  /** The current active plan — last approved, with cooked progress. Only
   * ever replaced by `approve()`, never by generating a new week. */
  plan: WeeklyPlan | null;
  /** A freshly generated plan pending review. Lives here (not in `plan`)
   * until approved, so closing review without approving can never destroy
   * an already-approved week (P0-3). */
  draftPlan: WeeklyPlan | null;
  shoppingList: ShoppingList | null;
  hydrated: boolean;
  init: () => Promise<void>;
  setIntake: (intake: IntakeAnswers) => void;
  /** Build a fresh draft plan from the current intake (into `draftPlan`). */
  generate: () => void;
  /** Re-pick every unlocked meal in the draft, keeping locked ones. */
  regenerate: () => void;
  toggleLock: (recipeId: string) => void;
  /** Up to 3 alternative recipes for a single draft day, ranked and
   * diversified by cuisine (never a whole-list-of-near-duplicates) — a pure
   * query, doesn't mutate the draft. */
  swapCandidates: (dayIndex: number) => Recipe[];
  /** Commit a specific recipe (from `swapCandidates`, or anywhere else) onto
   * a single draft day. Composes fresh sides for it (M4.2 part 2) — a
   * manually swapped day gets a plate the same way `generate()` does, not a
   * bare main. */
  swapMealTo: (dayIndex: number, recipeId: string) => void;
  /** Mark a meal cooked / not cooked (week progress, on the active plan). */
  toggleCooked: (dayIndex: number) => void;
  /**
   * M4.6 part 1: rearrange the approved week — swap `fromDay`'s and
   * `toDay`'s ENTIRE meal bodies (recipe, sides, servings, rating, cooked
   * flag, locked — everything except `dayIndex` itself). No-ops (via
   * `moveMeal`'s own guards) on a same-day swap, a day with no meal, or
   * either day already cooked — "a cooked day is history." Stamps
   * `recipeChangedAtISO` with `new Date().toISOString()` on BOTH resulting
   * meals (see `src/engine/rearrange.ts`'s doc comment for why that's what
   * makes a remote device adopt both whole bodies together instead of
   * mixing halves of two different swaps). NEVER touches the shopping list
   * — same food, different night (Law #1) — this action does not import or
   * call `applyShoppingListDelta`/`addIngredientsToShoppingList`/`buildShoppingList`/
   * `listFor`. On success, also swaps this device's cook-mode progress for
   * the two days via `useCookModeStore.swapProgress` (see that store's own
   * doc comment for the known per-device sync limitation).
   */
  moveMeal: (fromDay: number, toDay: number) => void;
  /**
   * "Stale week" fix: re-anchor the active plan so the first not-yet-cooked
   * meal lands on today, instead of the calendar just running past a week
   * that was generated ahead of schedule and never finished. Approved-plan
   * only; no-op if there's no plan, it isn't approved, or every meal is
   * already cooked (nothing to pick up). Only `weekStartISO` changes — every
   * meal keeps its own `dayIndex`, `cooked`/`rating`/`servings`/
   * `sideRecipeIds` — so this is purely a re-date, never a silent edit to
   * what's being cooked or to the shopping list (Product Law #1). See
   * `mergePlanMeals`'s weekStartISO rule in syncMerge.ts (Law #6): a
   * re-anchor only ever moves the start forward (to today), so the later of
   * two synced dates is always the convergent winner.
   */
  pickUpFromToday: () => void;
  /**
   * M4.1: set one draft meal's servings (−/+ in 0.5 steps, floored at 1).
   * Draft-only — the shopping list doesn't exist yet at this stage, it's
   * built fresh at approval as it always was, so there's nothing to
   * silently touch (Product Law #1 doesn't apply here — see
   * `previewShoppingList`, which already recomputes live from the draft's
   * meals on every call).
   */
  setDraftMealServings: (dayIndex: number, servings: number) => void;
  /**
   * M4.1: set one meal's servings on the ACTIVE (approved) plan. Stamps
   * `servingsChangedAtISO` for sync. Updates the meal immediately (so the
   * stepper, cook mode, and recipe detail all reflect it right away) but
   * does NOT touch `cooked`/`rating` (unlike `rerollMeal` — changing the
   * portion size doesn't invalidate whether it was cooked or how it was
   * rated) and — critically — does NOT touch `shoppingList` (Product Law
   * #1). Pair with `previewServingsDelta`/`applyServingsDeltaToShoppingList`
   * for the explicit, separate shopping-list update.
   */
  setApprovedMealServings: (dayIndex: number, servings: number) => void;
  /**
   * M4.1: read-only preview of what `applyServingsDeltaToShoppingList`
   * would do for one meal, given its servings BEFORE the most recent
   * `setApprovedMealServings` call (the caller — the screen — is
   * responsible for remembering `oldServings` locally at the moment of the
   * tap; see planStore's own doc comment on why this isn't a second
   * persisted field). Returns `null` when there's nothing to show (no
   * plan/recipe, or every affected ingredient is a pantry staple/already on
   * hand) — callers should render no confirmation UI in that case.
   */
  previewServingsDelta: (dayIndex: number, oldServings: number) => ShoppingListDelta | null;
  /**
   * M4.1: THE one action behind both "Update shopping list" (increase) and
   * "Reduce shopping list" (decrease) — direction is always recomputed from
   * real data (`oldServings` vs. the meal's current live `servings`), never
   * trusted from UI state, so the UI can never show the wrong button for
   * what's actually about to happen. Edits the existing `ShoppingList` in
   * place (via `applyShoppingListDelta`) — never a full rebuild, which
   * would silently un-check every item. Never called automatically; wired
   * only to the explicit "Update"/"Reduce shopping list" button.
   */
  applyServingsDeltaToShoppingList: (dayIndex: number, oldServings: number) => void;
  /**
   * M4.2 part 2: read-only preview of what removing `sideId` from
   * `dayIndex`'s meal would do to the shopping list — same pattern as
   * `previewServingsDelta`, computed as a full removal (that side's
   * contribution going to zero), so subtracting it can never strip an
   * ingredient the main or another side on the same plate still needs.
   */
  previewRemoveSideDelta: (dayIndex: number, sideId: string) => ShoppingListDelta | null;
  /**
   * M4.2 part 2: remove `sideId` from `dayIndex`'s plate immediately — "no
   * sides tonight" is a real, explicit choice, not silently missing data.
   * Stamps `sidesChangedAtISO`. Never touches the shopping list on its own;
   * pair with `applyRemoveSideDeltaToShoppingList` for the explicit,
   * separate list update (Law #1, same two-step pattern as servings).
   */
  removeSideFromMeal: (dayIndex: number, sideId: string) => void;
  /** Apply a previously-previewed side removal to the shopping list, with
   * per-source attribution (`removesSource: true`) so the removed side's id
   * comes off `fromRecipeIds` too, not just its quantity. Never called
   * automatically — wired only to an explicit "Remove from shopping list"
   * button. */
  applyRemoveSideDeltaToShoppingList: (dayIndex: number, sideId: string) => void;
  /**
   * Set/edit the star rating for one meal on the active plan (M2.1) — any
   * meal, any time, not gated on `cooked`. Persists the rating on the plan
   * (so it displays on the cards) and records the corresponding
   * `RatingEvent` in the learning store, which recomputes the whole
   * `PreferenceProfile` from the full rating history. `extra` carries the
   * richer optional signals (cookAgain, tooSpicy, ...) the catch-up wizard
   * collects that a quick star tap doesn't.
   */
  rateMeal: (
    dayIndex: number,
    rating: 1 | 2 | 3 | 4 | 5,
    extra?: Partial<
      Pick<
        RatingEvent,
        'cooked' | 'cookAgain' | 'familyAgain' | 'tooMuchPrep' | 'tooExpensive' | 'tooSpicy' | 'tooBland' | 'tooManyLeftovers'
      >
    >,
  ) => void;
  /**
   * Mid-week re-roll (M2.2), STRICT mode: candidates for replacing one
   * meal, restricted to WHOLE PLATES — main + composed sides (M4.2 part 2)
   * — fully coverable by pantry + this week's shopping list + the outgoing
   * plate's own ingredients (main and its sides) — a re-roll never implies
   * a store trip, for the main or for whatever sides get composed onto it.
   * Read-only; call `rerollMeal` to actually commit one of the returned
   * candidates (or a near-miss), passing its `sideRecipeIds` through
   * unchanged — never recompose at commit time (the plate that was
   * evaluated as coverable must be exactly the plate that gets attached).
   */
  previewReroll: (dayIndex: number) => RerollOutcome;
  /**
   * M4.5 ("keep the chimichurri, change the meal"): identical plumbing to
   * `previewReroll` (same `availableIngredients` construction from pantry +
   * this week's list + the outgoing plate's own main and sides) but passes
   * `keep` through to `rerollCandidates`, restricting candidates to
   * whichever plate part the screen hasn't locked. Read-only; commit via
   * `rerollSidesOnly` (kept the main — only the sides are changing) or
   * `commitComponentReroll` (kept the sides/sauce, or no keep at all — the
   * main is changing).
   */
  previewComponentReroll: (dayIndex: number, keep: RerollKeepOptions) => RerollOutcome;
  /**
   * Commit a re-roll: replace one meal's recipe (and its sides, M4.2 part 2
   * — pass whatever `previewReroll`'s candidate carried, never recomputed
   * here) on the active plan. Clears `cooked`/`rating` on that day (a
   * different recipe means any prior progress/rating no longer describes
   * it) and stamps `recipeChangedAtISO`/`sidesChangedAtISO` so sync knows
   * this meal's whole body — not just individual fields — changed (see
   * `mergePlanMeals`). Never touches the shopping list. M4.5: also the
   * shared tail end of `commitComponentReroll`, once that action's own
   * allergy re-check has passed.
   */
  rerollMeal: (dayIndex: number, recipeId: string, sideRecipeIds?: string[]) => void;
  /**
   * M4.5 commit path for "keep the main, re-roll the sides": sets
   * `sideRecipeIds` and stamps `sidesChangedAtISO` ONLY. The main didn't
   * change, so `recipeId`/`recipeChangedAtISO` are left untouched, and so
   * are `cooked`/`rating` — the dish being cooked tonight is the same dish,
   * its rating (if any) still describes it. Never touches the shopping
   * list. LAW #5: before applying, re-checks `passesAllergySafety` and
   * `!isMain` on every id in `sideRecipeIds` (resolved via `getAnyRecipe`);
   * any failing or unresolvable id is dropped rather than trusted from the
   * screen — a main can never be smuggled onto the plate as a "side" this
   * way, mirroring `pinRecipeToWeek`'s defense-in-depth comment.
   */
  rerollSidesOnly: (dayIndex: number, sideRecipeIds: string[], expectedRecipeId?: string) => void;
  /**
   * M4.5 commit path for "keep the sides/sauce, re-roll the main" — and,
   * routed here for uniformity, the ordinary no-keep whole-plate re-roll
   * too, since both replace the main and therefore need the identical
   * guard. LAW #5: pinning taught us a reused path silently reuses its
   * caller's already-skipped checks, so this re-applies the guard itself
   * rather than trusting that `previewReroll`/`previewComponentReroll`'s
   * filtering is still valid by the time the user taps — re-checks
   * `passesAllergySafety` + `isMain` on `candidate.recipeId` and
   * `passesAllergySafety` + `!isMain` on every one of `candidate.sideRecipeIds`.
   * If every check passes, calls `rerollMeal` with those ids VERBATIM —
   * never recomposed, so the plate committed is exactly the plate the
   * screen showed. If anything fails, the whole commit is rejected (a
   * no-op) rather than silently substituting a different-shaped plate than
   * what the user saw.
   */
  commitComponentReroll: (dayIndex: number, candidate: { recipeId: string; sideRecipeIds: string[] }, expectedRecipeId?: string) => void;
  /**
   * M3.1: today-or-future, not-yet-cooked days `recipeId` could be pinned
   * into on the active plan — empty means "can't be pinned right now"
   * (already used elsewhere this week, or every remaining day is cooked).
   */
  pinnableDaysFor: (recipeId: string) => number[];
  /** Why `pinnableDaysFor` came back empty, so the pin screen can say the
   * true reason instead of assuming "already in the plan" (which was wrong
   * for a week whose days have simply elapsed). `null` = not blocked. */
  pinBlockReasonFor: (recipeId: string) => PinBlockReason | null;
  /** Which of `recipeId`'s (and, M4.2 part 2, its freshly-composed sides')
   * non-staple ingredients aren't covered by pantry + this week's shopping
   * list + the day's outgoing plate (same "available" set reroll uses) —
   * for the "You'll need: X, Y" confirm before pinning. */
  missingIngredientsForPin: (dayIndex: number, recipeId: string) => string[];
  /**
   * Pin `recipeId` into `dayIndex` of the active plan — reuses `rerollMeal`
   * exactly (same recipeChangedAtISO stamp, cooked/rating clear, sync
   * behavior) so pinning and re-rolling are indistinguishable to every
   * other part of the app once committed. Never touches the shopping list
   * on its own — see `addMissingIngredients` for the explicit opt-in.
   * No-ops if the recipe fails `isMain` (Law #5: a side/sauce is never
   * independently pinnable as a whole dinner — this is a store-level
   * invariant, not just an absent UI button) or the allergy safety guard,
   * or if `dayIndex` isn't in `pinnableDaysFor` (defense in depth: the UI is
   * expected to have already checked all of this before offering the
   * action, including for the card-level quick-pin, which must not skip the
   * missing-ingredients confirm just because it's a shortcut). M4.2 part 2:
   * composes sides for the pinned main the same way `generate()` does, then
   * re-checks `passesAllergySafety` on every composed side explicitly —
   * defense in depth, exactly mirroring the main's own re-check, never
   * trusting that `composeSides`' internal filtering alone was enough.
   */
  pinRecipeToWeek: (dayIndex: number, recipeId: string) => void;
  /** Draft equivalent of `pinnableDaysFor` — a draft has no "today" or
   * "cooked" concept yet, so every day is eligible except one already
   * holding `recipeId`. */
  pinnableDraftDaysFor: (recipeId: string) => number[];
  /** Draft equivalent of `pinRecipeToWeek` (same `isMain`/allergy-safety
   * guards, same composed-sides re-check). */
  pinRecipeToDraft: (dayIndex: number, recipeId: string) => void;
  /**
   * Explicit-only: append `recipeId`'s ingredients missing from pantry +
   * this week's list (recomputed fresh, not trusting a possibly-stale UI
   * snapshot) onto the active shopping list. Never called automatically —
   * this is the "Add these to shopping list" button and nothing else. If a
   * later re-roll/re-pin of the same day replaces `recipeId` again, these
   * added items are NOT removed (M3.1 addition 6): silently deleting them
   * would violate the same "never silently edit the shopping list" law as
   * silently adding them would have.
   */
  addMissingIngredients: (dayIndex: number, recipeId: string) => void;
  /**
   * Promote the draft to the active plan and build its shopping list. M5.0:
   * if there's a currently active plan (there might not be, on a first-ever
   * approval), it's about to be replaced — archive it into the rolling
   * per-device plan history (`usePlanHistoryStore`) first, so its cooked
   * progress/ratings are preserved for the read-only "Past weeks" view
   * before this call overwrites `plan`.
   */
  approve: () => void;
  /** Discard the pending draft without approving it (e.g. closing review). */
  discardDraft: () => void;
  /** (Re)build the H-E-B shopping list from the current plan. */
  buildList: () => void;
  toggleShoppingItem: (ingredientName: string, unit: string) => void;
  /**
   * Replace plan + shopping list from a remote sync payload. M5.0: archives
   * the OUTGOING active plan into the rolling per-device history ONLY when
   * the incoming plan is non-null and carries a DIFFERENT `id` than the
   * current one — that's a genuine week replacement adopted from the other
   * phone (the same event `approve()` archives on the device that actually
   * approved), so both devices end up with equivalent archives over time.
   * A same-id incoming plan is progress on the SAME week (a cooked toggle,
   * a rating, a re-roll merging in from the other phone) — not a rollover
   * — and must NOT archive, or every ordinary sync tick would spuriously
   * duplicate the current week into history. An incoming `null` plan (a
   * sync clear/reset) also does not archive — there is no new plan being
   * "adopted" for it to be a replacement of.
   */
  hydrateFromSync: (plan: WeeklyPlan | null, shoppingList: ShoppingList | null) => void;
  clear: () => void;
  recipeFor: (meal: PlannedMeal) => Recipe | undefined;
  /**
   * Compute what the shopping list (and its totals) would be for a plan without
   * persisting anything — the single source of truth for "what will this cost"
   * shown before approval, so it always matches the real list built on approve.
   */
  previewShoppingList: (plan: WeeklyPlan) => ShoppingList;
}

function persist(plan: WeeklyPlan) {
  void localPlanRepository.save(plan);
}

function persistDraft(draft: WeeklyPlan) {
  void localDraftPlanRepository.save(draft);
}

function persistList(list: ShoppingList) {
  void localShoppingListRepository.save(list);
}

function listFor(plan: WeeklyPlan): ShoppingList {
  const pantry = usePantryStore.getState().items;
  return buildShoppingList(plan.id, plan.meals, getAnyRecipe, pantry, hebProvider);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** −/+ in 0.5 steps, floored at 1 (a meal can't be planned for less than one portion). */
function clampServings(n: number): number {
  return Math.max(1, Math.round(n * 2) / 2);
}

export const usePlanStore = create<PlanState>((set, get) => ({
  intake: null,
  plan: null,
  draftPlan: null,
  shoppingList: null,
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const [loadedPlan, loadedDraft, shoppingList] = await Promise.all([
      localPlanRepository.load(),
      localDraftPlanRepository.load(),
      localShoppingListRepository.load(),
    ]);
    // Migrate pre-M1.8 data: an unapproved plan used to live in the same
    // slot as the active plan. Move it into draftPlan so it can never be
    // mistaken for (or overwrite) an approved week.
    let plan = loadedPlan;
    let draftPlan = loadedDraft;
    if (plan && plan.status !== 'approved' && !draftPlan) {
      draftPlan = plan;
      plan = null;
      void localPlanRepository.clear();
      void localDraftPlanRepository.save(draftPlan);
    }

    // Migrate pre-M2.1 data: a plan reviewed through the old end-of-week
    // wizard has no per-meal `rating` (that field didn't exist yet), which
    // would make it look unrated again under the new "Week rated ✓" check.
    // Backfill each meal's rating from its preserved RatingEvent so an
    // already-reviewed week doesn't start re-prompting.
    const legacyReviewedAtISO = (plan as { reviewedAtISO?: string } | null)?.reviewedAtISO;
    if (plan && legacyReviewedAtISO && plan.meals.some((m) => m.rating === undefined)) {
      await useLearningStore.getState().init();
      const ratings = useLearningStore.getState().ratings;
      const migratedPlan = plan;
      const meals = migratedPlan.meals.map((m) => {
        if (m.rating !== undefined) return m;
        const event = ratings.find((r) => r.planId === migratedPlan.id && r.recipeId === m.recipeId);
        if (event && event.cooked && typeof event.enjoyment === 'number') {
          return { ...m, rating: event.enjoyment as 1 | 2 | 3 | 4 | 5, ratedAtISO: event.ratedAtISO };
        }
        return m;
      });
      plan = { ...migratedPlan, meals };
      void localPlanRepository.save(plan);
    }

    set({
      plan: plan ?? null,
      draftPlan: draftPlan ?? null,
      intake: draftPlan?.intake ?? plan?.intake ?? null,
      shoppingList: shoppingList ?? null,
      hydrated: true,
    });
  },

  setIntake: (intake) => set({ intake }),

  generate: () => {
    const intake = get().intake;
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!intake) return;
    // Re-read the live household composition right before generating,
    // rather than trusting whatever `servingsPerMeal` happened to be seeded
    // into wizard state — a household change made mid-session (or a stale
    // "same as last week" recap) must never silently drive stale
    // shopping-list math (M4.1). This is what makes "a baby will join
    // later" actually work: no wizard re-visit required, just an edit on
    // the Profile screen.
    const liveIntake: IntakeAnswers = { ...intake, servingsPerMeal: computeServingsPerMeal(profile) };
    const meals = localRecommendationEngine.generate(context(liveIntake, profile, []), allRecipesList());
    const draftPlan: WeeklyPlan = {
      id: createId(),
      weekStartISO: localDateString(),
      intake: liveIntake,
      meals,
      status: 'draft',
      createdAtISO: new Date().toISOString(),
    };
    set({ draftPlan, intake: liveIntake });
    persistDraft(draftPlan);
  },

  regenerate: () => {
    const { draftPlan, intake } = get();
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!draftPlan || !intake) return;
    const lockedIds = draftPlan.meals.filter((m) => m.locked).map((m) => m.recipeId);
    // Two bugs this shape fixes, both reported as "regenerate just reorders
    // the week instead of changing it":
    //  1. `generate()` assigns `dayIndex` by ARRAY POSITION and returns
    //     locked recipes first, so feeding its output back in wholesale
    //     moved locked meals onto different days (and recomposed their
    //     sides) — a locked meal must stay exactly where it is, plate and
    //     all. So locked slots are now carried over verbatim and only
    //     unlocked slots are refilled, each keeping its own dayIndex.
    //  2. Scoring is near-deterministic, so re-picking from the same pool
    //     re-chose the same dishes. `avoidRecipeIds` asks the engine to skip
    //     the outgoing unlocked picks (it falls back to the full pool if
    //     that would leave too few candidates — see types.ts).
    const outgoingUnlockedIds = draftPlan.meals.filter((m) => !m.locked).map((m) => m.recipeId);
    const generated = localRecommendationEngine.generate(
      { ...context(intake, profile, lockedIds), avoidRecipeIds: outgoingUnlockedIds },
      allRecipesList(),
    );
    const lockedIdSet = new Set(lockedIds);
    const replacements = generated.filter((m) => !lockedIdSet.has(m.recipeId));
    let cursor = 0;
    const meals = draftPlan.meals.map((m) => {
      if (m.locked) return m;
      const replacement = replacements[cursor];
      if (!replacement) return m; // pool exhausted — keep what's there rather than emptying a day
      cursor += 1;
      return {
        ...m,
        recipeId: replacement.recipeId,
        sideRecipeIds: replacement.sideRecipeIds,
        locked: false,
      };
    });
    const next: WeeklyPlan = { ...draftPlan, meals };
    set({ draftPlan: next });
    persistDraft(next);
  },

  toggleLock: (recipeId) => {
    const draftPlan = get().draftPlan;
    if (!draftPlan) return;
    const meals = draftPlan.meals.map((m) =>
      m.recipeId === recipeId ? { ...m, locked: !m.locked } : m,
    );
    const next = { ...draftPlan, meals };
    set({ draftPlan: next });
    persistDraft(next);
  },

  swapCandidates: (dayIndex) => {
    const { draftPlan, intake } = get();
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!draftPlan || !intake) return [];
    const used = new Set(draftPlan.meals.map((m) => m.recipeId));
    const selected = draftPlan.meals
      .filter((m) => m.dayIndex !== dayIndex)
      .map((m) => getAnyRecipe(m.recipeId))
      .filter((r): r is Recipe => !!r);
    const ctx = context(intake, profile, []);
    // Mains only (M4.2 part 2) — a swap picks a whole dinner's main; its
    // sides get composed at commit time in `swapMealTo`.
    const candidates = mainRecipesList().filter(
      (r) => !used.has(r.id) && passesHardFilters(r, intake, profile),
    );
    return rankReplacements(candidates, ctx, selected, 3);
  },

  swapMealTo: (dayIndex, recipeId) => {
    const draftPlan = get().draftPlan;
    if (!draftPlan) return;
    const recipe = getAnyRecipe(recipeId);
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    const ctx = context(draftPlan.intake, profile, []);
    const sideRecipeIds = recipe
      ? composeSides(recipe, sidesPool(), { ...ctx, weekRecipes: otherWeekRecipes(draftPlan.meals, dayIndex) })
      : [];
    const meals = draftPlan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, recipeId, sideRecipeIds, locked: false } : m,
    );
    const next = { ...draftPlan, meals };
    set({ draftPlan: next });
    persistDraft(next);
  },

  toggleCooked: (dayIndex) => {
    const plan = get().plan;
    if (!plan) return;
    const now = new Date().toISOString();
    const meals = plan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, cooked: !m.cooked, cookedAtISO: now } : m,
    );
    const next = { ...plan, meals };
    set({ plan: next });
    persist(next);
  },

  moveMeal: (fromDay, toDay) => {
    const plan = get().plan;
    if (!plan || plan.status !== 'approved') return;
    const next = moveMealInPlan(plan, fromDay, toDay, new Date().toISOString());
    if (!next) return;
    set({ plan: next });
    persist(next);
    // Cook-mode progress travels on this device, same swap, same two days.
    useCookModeStore.getState().swapProgress(plan.id, fromDay, toDay);
  },

  pickUpFromToday: () => {
    const plan = get().plan;
    if (!plan || plan.status !== 'approved') return;
    const firstUncooked = plan.meals
      .filter((m) => !m.cooked)
      .reduce<number | null>((min, m) => (min === null || m.dayIndex < min ? m.dayIndex : min), null);
    if (firstUncooked === null) return; // everything's cooked — nothing to pick up
    const anchor = localMidnight(new Date());
    anchor.setDate(anchor.getDate() - firstUncooked);
    const weekStartISO = localDateString(anchor);
    const next = { ...plan, weekStartISO };
    set({ plan: next });
    persist(next);
  },

  setDraftMealServings: (dayIndex, servings) => {
    const draftPlan = get().draftPlan;
    if (!draftPlan) return;
    const clamped = clampServings(servings);
    const meals = draftPlan.meals.map((m) => (m.dayIndex === dayIndex ? { ...m, servings: clamped } : m));
    const next = { ...draftPlan, meals };
    set({ draftPlan: next });
    persistDraft(next);
  },

  setApprovedMealServings: (dayIndex, servings) => {
    const plan = get().plan;
    if (!plan) return;
    const clamped = clampServings(servings);
    const now = new Date().toISOString();
    const meals = plan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, servings: clamped, servingsChangedAtISO: now } : m,
    );
    const next = { ...plan, meals };
    set({ plan: next });
    persist(next);
  },

  previewServingsDelta: (dayIndex, oldServings) => {
    const plan = get().plan;
    const list = get().shoppingList;
    if (!plan || !list) return null;
    const meal = plan.meals.find((m) => m.dayIndex === dayIndex);
    if (!meal) return null;
    // M4.2 part 2: a servings change scales the WHOLE plate — main and every
    // side — not just the main. F1: matched/merged against the live list via
    // `reconcileDeltaWithList` (M4.7 dedup key), so the confirm copy speaks
    // in the list's own first-seen name/elected unit, not each recipe's own
    // — and "will be removed" is judged against the list's real quantity.
    const recipes = resolveRecipes([meal.recipeId, ...(meal.sideRecipeIds ?? [])]);
    if (recipes.length === 0) return null;
    const pantry = usePantryStore.getState().items;
    const deltas = recipes.map((r) => computeServingsDelta(r, oldServings, meal.servings, pantry));
    const direction = deltas[0].direction; // identical for every recipe: same oldServings -> meal.servings
    const allLines = deltas.flatMap((d) => d.lines);
    if (allLines.length === 0) return null;
    const lines = reconcileDeltaWithList(allLines, list.items, direction);
    if (lines.length === 0) return null;
    return { direction, lines };
  },

  applyServingsDeltaToShoppingList: (dayIndex, oldServings) => {
    const plan = get().plan;
    const list = get().shoppingList;
    if (!plan || !list) return;
    const meal = plan.meals.find((m) => m.dayIndex === dayIndex);
    if (!meal) return;
    // Applied per-recipe (not merged, unlike the preview above) so each
    // recipe's own id stays correctly attributed in `fromRecipeIds`.
    const recipes = resolveRecipes([meal.recipeId, ...(meal.sideRecipeIds ?? [])]);
    if (recipes.length === 0) return;
    const pantry = usePantryStore.getState().items;
    let updatedList = list;
    for (const r of recipes) {
      const delta = computeServingsDelta(r, oldServings, meal.servings, pantry);
      if (delta.lines.length === 0) continue;
      updatedList = applyShoppingListDelta(updatedList, delta, r.id, hebProvider);
    }
    if (updatedList === list) return;
    const totalServings = plan.meals.reduce((s, m) => s + m.servings, 0);
    const costPerServing = totalServings ? round2(updatedList.estimatedTotal / totalServings) : 0;
    const next = { ...updatedList, costPerServing };
    set({ shoppingList: next });
    persistList(next);
  },

  previewRemoveSideDelta: (dayIndex, sideId) => {
    const plan = get().plan;
    const list = get().shoppingList;
    if (!plan || !list) return null;
    const meal = plan.meals.find((m) => m.dayIndex === dayIndex);
    const side = getAnyRecipe(sideId);
    if (!meal || !side) return null;
    const pantry = usePantryStore.getState().items;
    // A removal is a full delta: this side's servings going to zero. F1:
    // reconciled against the live list the same way previewServingsDelta is.
    const delta = computeServingsDelta(side, meal.servings, 0, pantry);
    if (delta.lines.length === 0) return null;
    const lines = reconcileDeltaWithList(delta.lines, list.items, delta.direction);
    return { ...delta, lines };
  },

  removeSideFromMeal: (dayIndex, sideId) => {
    const plan = get().plan;
    if (!plan) return;
    const meal = plan.meals.find((m) => m.dayIndex === dayIndex);
    if (!meal || !(meal.sideRecipeIds ?? []).includes(sideId)) return;
    const now = new Date().toISOString();
    const sideRecipeIds = (meal.sideRecipeIds ?? []).filter((id) => id !== sideId);
    const meals = plan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, sideRecipeIds, sidesChangedAtISO: now } : m,
    );
    const next = { ...plan, meals };
    set({ plan: next });
    persist(next);
  },

  applyRemoveSideDeltaToShoppingList: (dayIndex, sideId) => {
    const plan = get().plan;
    const list = get().shoppingList;
    if (!plan || !list) return;
    const meal = plan.meals.find((m) => m.dayIndex === dayIndex);
    const side = getAnyRecipe(sideId);
    if (!meal || !side) return;
    const pantry = usePantryStore.getState().items;
    const delta = computeServingsDelta(side, meal.servings, 0, pantry);
    if (delta.lines.length === 0) return;
    const updatedList = applyShoppingListDelta(list, delta, sideId, hebProvider, /* removesSource */ true);
    const totalServings = plan.meals.reduce((s, m) => s + m.servings, 0);
    const costPerServing = totalServings ? round2(updatedList.estimatedTotal / totalServings) : 0;
    const next = { ...updatedList, costPerServing };
    set({ shoppingList: next });
    persistList(next);
  },

  rateMeal: (dayIndex, rating, extra) => {
    const plan = get().plan;
    if (!plan) return;
    const meal = plan.meals.find((m) => m.dayIndex === dayIndex);
    if (!meal) return;
    const now = new Date().toISOString();
    const meals = plan.meals.map((m) => (m.dayIndex === dayIndex ? { ...m, rating, ratedAtISO: now } : m));
    const next = { ...plan, meals };
    set({ plan: next });
    persist(next);
    useLearningStore.getState().rateRecipe({
      ...extra,
      planId: plan.id,
      recipeId: meal.recipeId,
      cooked: extra?.cooked ?? true,
      enjoyment: rating,
      ratedAtISO: now,
    });
  },

  previewReroll: (dayIndex) => {
    const plan = get().plan;
    if (!plan) return { candidates: [], nearMisses: [] };
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    const pantry = usePantryStore.getState().items;
    const outgoingMeal = plan.meals.find((m) => m.dayIndex === dayIndex);
    const outgoingRecipe = outgoingMeal ? getAnyRecipe(outgoingMeal.recipeId) : undefined;
    const outgoingSides = resolveRecipes(outgoingMeal?.sideRecipeIds ?? []);
    const available = availableIngredients(pantry, get().shoppingList, outgoingRecipe, outgoingSides);
    const ctx = context(plan.intake, profile, []);
    return rerollCandidates(plan, dayIndex, allRecipesList(), getAnyRecipe, available, ctx);
  },

  previewComponentReroll: (dayIndex, keep) => {
    const plan = get().plan;
    if (!plan) return { candidates: [], nearMisses: [] };
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    const pantry = usePantryStore.getState().items;
    const outgoingMeal = plan.meals.find((m) => m.dayIndex === dayIndex);
    const outgoingRecipe = outgoingMeal ? getAnyRecipe(outgoingMeal.recipeId) : undefined;
    const outgoingSides = resolveRecipes(outgoingMeal?.sideRecipeIds ?? []);
    const available = availableIngredients(pantry, get().shoppingList, outgoingRecipe, outgoingSides);
    const ctx = context(plan.intake, profile, []);
    return rerollCandidates(plan, dayIndex, allRecipesList(), getAnyRecipe, available, ctx, keep);
  },

  rerollMeal: (dayIndex, recipeId, sideRecipeIds = []) => {
    const plan = get().plan;
    if (!plan) return;
    // F5 (July 2026 sweep): refuse to replace a cooked day, mirroring
    // moveMeal's commit-time guard. rerollCandidates already excludes cooked
    // days at preview time, but a partner's cook could sync in between the
    // final render and the tap; a cooked day is history and must never have
    // its recipe/rating/cooked flag wiped. Pinning is unaffected — its
    // pinnableDays guard already excludes cooked days upstream.
    const target = plan.meals.find((m) => m.dayIndex === dayIndex);
    if (target?.cooked) return;
    const now = new Date().toISOString();
    const meals = plan.meals.map((m) =>
      m.dayIndex === dayIndex
        ? {
            ...m,
            recipeId,
            sideRecipeIds,
            recipeChangedAtISO: now,
            sidesChangedAtISO: now,
            locked: false,
            cooked: false,
            cookedAtISO: null,
            rating: undefined,
            ratedAtISO: null,
          }
        : m,
    );
    const next = { ...plan, meals };
    set({ plan: next });
    persist(next);
  },

  rerollSidesOnly: (dayIndex, sideRecipeIds, expectedRecipeId) => {
    const plan = get().plan;
    if (!plan) return;
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    const meal = plan.meals.find((m) => m.dayIndex === dayIndex);
    if (!meal) return;
    // F5 (July 2026 sweep): a cooked day is history; and if a partner's
    // swap/re-roll synced a different main onto this day since the preview,
    // these sides were composed against a dish that's no longer here — no-op
    // rather than attach them to the wrong plate (the screen passes the main
    // id it previewed against as expectedRecipeId).
    if (meal.cooked) return;
    if (expectedRecipeId !== undefined && meal.recipeId !== expectedRecipeId) return;
    // LAW #5 defense in depth — never trust the screen's ids as-is: drop
    // anything unresolvable, anything failing the allergy guard, and
    // anything that's actually a main (a main can never be smuggled onto
    // the plate as a "side").
    const safeSideIds = sideRecipeIds.filter((id) => {
      const side = getAnyRecipe(id);
      return !!side && !isMain(side) && passesAllergySafety(side, profile);
    });
    const now = new Date().toISOString();
    const meals = plan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, sideRecipeIds: safeSideIds, sidesChangedAtISO: now } : m,
    );
    const next = { ...plan, meals };
    set({ plan: next });
    persist(next);
  },

  commitComponentReroll: (dayIndex, candidate, expectedRecipeId) => {
    const plan = get().plan;
    const recipe = getAnyRecipe(candidate.recipeId);
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!plan || !recipe) return;
    // F5 (July 2026 sweep): if a partner's synced change replaced this day's
    // dish since the preview, the kept sides this candidate carries were
    // paired against a main that's no longer here — no-op rather than commit
    // a plate the user never actually saw. (rerollMeal below also guards
    // cooked, belt-and-suspenders.)
    const outgoing = plan.meals.find((m) => m.dayIndex === dayIndex);
    if (!outgoing || outgoing.cooked) return;
    if (expectedRecipeId !== undefined && outgoing.recipeId !== expectedRecipeId) return;
    // LAW #5: re-apply the guard at the point of replacement rather than
    // trusting that the candidate the screen has been holding since preview
    // is still safe. A partial commit (dropping just the offending id)
    // would silently hand the user a different plate than the one they
    // looked at, so any failure rejects the whole commit instead.
    if (!isMain(recipe) || !passesAllergySafety(recipe, profile)) return;
    const sidesOk = candidate.sideRecipeIds.every((id) => {
      const side = getAnyRecipe(id);
      return !!side && !isMain(side) && passesAllergySafety(side, profile);
    });
    if (!sidesOk) return;
    get().rerollMeal(dayIndex, candidate.recipeId, candidate.sideRecipeIds);
  },

  pinnableDaysFor: (recipeId) => {
    const plan = get().plan;
    if (!plan) return [];
    return pinnableDays(plan, recipeId);
  },
  pinBlockReasonFor: (recipeId) => {
    const plan = get().plan;
    if (!plan) return null;
    return pinBlockReason(plan, recipeId);
  },

  missingIngredientsForPin: (dayIndex, recipeId) => {
    const plan = get().plan;
    const recipe = getAnyRecipe(recipeId);
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!plan || !recipe) return [];
    const pantry = usePantryStore.getState().items;
    const outgoingMeal = plan.meals.find((m) => m.dayIndex === dayIndex);
    const outgoingRecipe = outgoingMeal ? getAnyRecipe(outgoingMeal.recipeId) : undefined;
    const outgoingSides = resolveRecipes(outgoingMeal?.sideRecipeIds ?? []);
    const available = availableIngredients(pantry, get().shoppingList, outgoingRecipe, outgoingSides);
    if (!isMain(recipe)) return missingIngredients(recipe, available); // defensive; not reachable via UI
    const ctx = context(plan.intake, profile, []);
    const sides = resolveRecipes(
      composeSides(recipe, sidesPool(), { ...ctx, weekRecipes: otherWeekRecipes(plan.meals, dayIndex) }),
    );
    return missingIngredientsForPlate(recipe, sides, available);
  },

  pinRecipeToWeek: (dayIndex, recipeId) => {
    const plan = get().plan;
    const recipe = getAnyRecipe(recipeId);
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!plan || !recipe) return;
    if (!isMain(recipe)) return; // Law #5: a side/sauce is never independently pinnable as a whole dinner
    if (!passesAllergySafety(recipe, profile)) return;
    if (!pinnableDays(plan, recipeId).includes(dayIndex)) return;
    const ctx = context(plan.intake, profile, []);
    const composedSideIds = composeSides(recipe, sidesPool(), {
      ...ctx,
      weekRecipes: otherWeekRecipes(plan.meals, dayIndex),
    });
    // Defense in depth (Law #5): re-check every composed side explicitly,
    // exactly like the main above — never trust that `composeSides`'
    // internal filtering alone was enough.
    const sideRecipeIds = composedSideIds.filter((id) => {
      const side = getAnyRecipe(id);
      return !!side && passesAllergySafety(side, profile);
    });
    get().rerollMeal(dayIndex, recipeId, sideRecipeIds);
  },

  pinnableDraftDaysFor: (recipeId) => {
    const draftPlan = get().draftPlan;
    if (!draftPlan) return [];
    if (draftPlan.meals.some((m) => m.recipeId === recipeId)) return [];
    return draftPlan.meals.map((m) => m.dayIndex);
  },

  pinRecipeToDraft: (dayIndex, recipeId) => {
    const draftPlan = get().draftPlan;
    const recipe = getAnyRecipe(recipeId);
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!draftPlan || !recipe) return;
    if (!isMain(recipe)) return; // Law #5, same guard as pinRecipeToWeek
    if (!passesAllergySafety(recipe, profile)) return;
    if (!get().pinnableDraftDaysFor(recipeId).includes(dayIndex)) return;
    const ctx = context(draftPlan.intake, profile, []);
    const composedSideIds = composeSides(recipe, sidesPool(), {
      ...ctx,
      weekRecipes: otherWeekRecipes(draftPlan.meals, dayIndex),
    });
    const sideRecipeIds = composedSideIds.filter((id) => {
      const side = getAnyRecipe(id);
      return !!side && passesAllergySafety(side, profile);
    });
    const meals = draftPlan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, recipeId, sideRecipeIds, locked: false } : m,
    );
    const next = { ...draftPlan, meals };
    set({ draftPlan: next });
    persistDraft(next);
  },

  addMissingIngredients: (dayIndex, recipeId) => {
    const plan = get().plan;
    const list = get().shoppingList;
    const recipe = getAnyRecipe(recipeId);
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!plan || !list || !recipe) return;
    const pantry = usePantryStore.getState().items;
    const outgoingMeal = plan.meals.find((m) => m.dayIndex === dayIndex);
    const outgoingRecipe = outgoingMeal ? getAnyRecipe(outgoingMeal.recipeId) : undefined;
    const outgoingSides = resolveRecipes(outgoingMeal?.sideRecipeIds ?? []);
    const available = availableIngredients(pantry, list, outgoingRecipe, outgoingSides);

    const ctx = context(plan.intake, profile, []);
    const sides = isMain(recipe)
      ? resolveRecipes(
          composeSides(recipe, sidesPool(), { ...ctx, weekRecipes: otherWeekRecipes(plan.meals, dayIndex) }),
        )
      : [];

    // Each recipe on the prospective plate adds its own missing ingredients,
    // attributed to its own id — mirrors `applyServingsDeltaToShoppingList`'s
    // per-recipe application against the same threaded list.
    let next = list;
    for (const r of [recipe, ...sides]) {
      const missingNames = new Set(missingIngredients(r, available));
      const ingredientsToAdd = r.ingredients.filter((ing) => missingNames.has(ing.name));
      if (ingredientsToAdd.length > 0) next = addIngredientsToShoppingList(next, ingredientsToAdd, r.id, hebProvider);
    }
    if (next === list) return;
    set({ shoppingList: next });
    persistList(next);
  },

  approve: () => {
    const draftPlan = get().draftPlan;
    if (!draftPlan) return;
    // M5.0: archive whatever active plan is about to be replaced (there may
    // be none, on a first-ever approval) before it's overwritten below.
    const outgoing = get().plan;
    if (outgoing) void usePlanHistoryStore.getState().archive(outgoing);
    const next: WeeklyPlan = { ...draftPlan, status: 'approved' };
    const shoppingList = listFor(next);
    set({ plan: next, draftPlan: null, shoppingList });
    persist(next);
    persistList(shoppingList);
    void localDraftPlanRepository.clear();
    // M3.3: a new week means whatever's checked on the manual list was
    // bought — clear it. The caller (app/plan/review.tsx) reconciles with
    // the household sync partner just before calling approve(), so this
    // reads the merged checked-state rather than a possibly-stale local one.
    useManualItemsStore.getState().clearChecked();
  },

  discardDraft: () => {
    if (!get().draftPlan) return;
    set({ draftPlan: null });
    void localDraftPlanRepository.clear();
  },

  buildList: () => {
    const plan = get().plan;
    if (!plan) return;
    const shoppingList = listFor(plan);
    set({ shoppingList });
    persistList(shoppingList);
  },

  toggleShoppingItem: (ingredientName, unit) => {
    const list = get().shoppingList;
    if (!list) return;
    const now = new Date().toISOString();
    const items = list.items.map((i) =>
      i.ingredientName === ingredientName && i.unit === unit
        ? { ...i, checked: !i.checked, checkedAtISO: now }
        : i,
    );
    const next = { ...list, items };
    set({ shoppingList: next });
    persistList(next);
  },

  hydrateFromSync: (plan, shoppingList) => {
    // M5.0: a genuine week replacement (incoming plan exists and has a
    // different id than what's currently active) archives the outgoing
    // plan, same as approve() does on the device that performed it. A
    // same-id merge (progress on the same week) or an incoming null plan
    // (clear/reset) does neither.
    const outgoing = get().plan;
    if (outgoing && plan && outgoing.id !== plan.id) {
      void usePlanHistoryStore.getState().archive(outgoing);
    }
    set({ plan, shoppingList, intake: plan?.intake ?? get().intake });
    if (plan) persist(plan);
    else void localPlanRepository.clear();
    if (shoppingList) persistList(shoppingList);
    else void localShoppingListRepository.clear();
  },

  clear: () => {
    set({ plan: null, draftPlan: null, intake: null, shoppingList: null });
    void localPlanRepository.clear();
    void localDraftPlanRepository.clear();
    void localShoppingListRepository.clear();
  },

  recipeFor: (meal) => getAnyRecipe(meal.recipeId),

  previewShoppingList: (plan) => listFor(plan),
}));
