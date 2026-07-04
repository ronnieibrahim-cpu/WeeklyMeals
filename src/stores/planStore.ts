import { create } from 'zustand';

import { hebProvider } from '@/data/grocery/heb/HebProvider';
import { getRecipe, RECIPES } from '@/data/seed/recipes';
import { localDraftPlanRepository } from '@/data/repositories/local/LocalDraftPlanRepository';
import { localPlanRepository } from '@/data/repositories/local/LocalPlanRepository';
import { localShoppingListRepository } from '@/data/repositories/local/LocalShoppingListRepository';
import { createDefaultProfile } from '@/domain/defaults';
import { IntakeAnswers, PlannedMeal, Profile, RatingEvent, Recipe, ShoppingList, WeeklyPlan } from '@/domain/models';
import { GenerateContext, localRecommendationEngine, passesAllergySafety, passesHardFilters, rankReplacements } from '@/engine/recommendation';
import { availableIngredients, missingIngredients, pinnableDays, RerollOutcome, rerollCandidates } from '@/engine/reroll';
import { localMidnight } from '@/engine/schedule';
import { seasonForDate } from '@/engine/season';
import { addIngredientsToShoppingList, buildShoppingList } from '@/engine/shoppingList';
import { createId } from '@/utils/id';

import { useLearningStore } from './learningStore';
import { useManualItemsStore } from './manualItemsStore';
import { usePantryStore } from './pantryStore';
import { useProfileStore } from './profileStore';

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
   * a single draft day. */
  swapMealTo: (dayIndex: number, recipeId: string) => void;
  /** Mark a meal cooked / not cooked (week progress, on the active plan). */
  toggleCooked: (dayIndex: number) => void;
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
   * meal, restricted to recipes fully coverable by pantry + this week's
   * shopping list + the outgoing meal's own ingredients — a re-roll never
   * implies a store trip. Read-only; call `rerollMeal` to actually commit
   * one of the returned candidates (or a near-miss).
   */
  previewReroll: (dayIndex: number) => RerollOutcome;
  /**
   * Commit a re-roll: replace one meal's recipe on the active plan. Clears
   * `cooked`/`rating` on that day (a different recipe means any prior
   * progress/rating no longer describes it) and stamps `recipeChangedAtISO`
   * so sync knows this meal's whole body — not just individual fields —
   * changed (see `mergePlanMeals`). Never touches the shopping list.
   */
  rerollMeal: (dayIndex: number, recipeId: string) => void;
  /**
   * M3.1: today-or-future, not-yet-cooked days `recipeId` could be pinned
   * into on the active plan — empty means "can't be pinned right now"
   * (already used elsewhere this week, or every remaining day is cooked).
   */
  pinnableDaysFor: (recipeId: string) => number[];
  /** Which of `recipeId`'s non-staple ingredients aren't covered by pantry +
   * this week's shopping list + the day's outgoing recipe (same "available"
   * set reroll uses) — for the "You'll need: X, Y" confirm before pinning. */
  missingIngredientsForPin: (dayIndex: number, recipeId: string) => string[];
  /**
   * Pin `recipeId` into `dayIndex` of the active plan — reuses `rerollMeal`
   * exactly (same recipeChangedAtISO stamp, cooked/rating clear, sync
   * behavior) so pinning and re-rolling are indistinguishable to every
   * other part of the app once committed. Never touches the shopping list
   * on its own — see `addMissingIngredients` for the explicit opt-in.
   * No-ops if the recipe fails the allergy safety guard or `dayIndex` isn't
   * in `pinnableDaysFor` (defense in depth: the UI is expected to have
   * already checked both before offering this action, including for the
   * card-level quick-pin, which must not skip the missing-ingredients
   * confirm just because it's a shortcut).
   */
  pinRecipeToWeek: (dayIndex: number, recipeId: string) => void;
  /** Draft equivalent of `pinnableDaysFor` — a draft has no "today" or
   * "cooked" concept yet, so every day is eligible except one already
   * holding `recipeId`. */
  pinnableDraftDaysFor: (recipeId: string) => number[];
  /** Draft equivalent of `pinRecipeToWeek` (same allergy-safety guard). */
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
  /** Promote the draft to the active plan and build its shopping list. */
  approve: () => void;
  /** Discard the pending draft without approving it (e.g. closing review). */
  discardDraft: () => void;
  /** (Re)build the H-E-B shopping list from the current plan. */
  buildList: () => void;
  toggleShoppingItem: (ingredientName: string, unit: string) => void;
  /** Replace plan + shopping list from a remote sync payload. */
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
  return buildShoppingList(plan.id, plan.meals, getRecipe, pantry, hebProvider);
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
    const meals = localRecommendationEngine.generate(context(intake, profile, []), RECIPES);
    const draftPlan: WeeklyPlan = {
      id: createId(),
      weekStartISO: localMidnight(new Date()).toISOString(),
      intake,
      meals,
      status: 'draft',
      createdAtISO: new Date().toISOString(),
    };
    set({ draftPlan });
    persistDraft(draftPlan);
  },

  regenerate: () => {
    const { draftPlan, intake } = get();
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!draftPlan || !intake) return;
    const lockedIds = draftPlan.meals.filter((m) => m.locked).map((m) => m.recipeId);
    const meals = localRecommendationEngine.generate(context(intake, profile, lockedIds), RECIPES);
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
      .map((m) => getRecipe(m.recipeId))
      .filter((r): r is Recipe => !!r);
    const ctx = context(intake, profile, []);
    const candidates = RECIPES.filter(
      (r) => !used.has(r.id) && passesHardFilters(r, intake, profile),
    );
    return rankReplacements(candidates, ctx, selected, 3);
  },

  swapMealTo: (dayIndex, recipeId) => {
    const draftPlan = get().draftPlan;
    if (!draftPlan) return;
    const meals = draftPlan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, recipeId, locked: false } : m,
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
    const outgoingRecipe = outgoingMeal ? getRecipe(outgoingMeal.recipeId) : undefined;
    const available = availableIngredients(pantry, get().shoppingList, outgoingRecipe);
    const ctx = context(plan.intake, profile, []);
    return rerollCandidates(plan, dayIndex, RECIPES, getRecipe, available, ctx);
  },

  rerollMeal: (dayIndex, recipeId) => {
    const plan = get().plan;
    if (!plan) return;
    const now = new Date().toISOString();
    const meals = plan.meals.map((m) =>
      m.dayIndex === dayIndex
        ? {
            ...m,
            recipeId,
            recipeChangedAtISO: now,
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

  pinnableDaysFor: (recipeId) => {
    const plan = get().plan;
    if (!plan) return [];
    return pinnableDays(plan, recipeId);
  },

  missingIngredientsForPin: (dayIndex, recipeId) => {
    const plan = get().plan;
    const recipe = getRecipe(recipeId);
    if (!plan || !recipe) return [];
    const pantry = usePantryStore.getState().items;
    const outgoingMeal = plan.meals.find((m) => m.dayIndex === dayIndex);
    const outgoingRecipe = outgoingMeal ? getRecipe(outgoingMeal.recipeId) : undefined;
    const available = availableIngredients(pantry, get().shoppingList, outgoingRecipe);
    return missingIngredients(recipe, available);
  },

  pinRecipeToWeek: (dayIndex, recipeId) => {
    const plan = get().plan;
    const recipe = getRecipe(recipeId);
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!plan || !recipe) return;
    if (!passesAllergySafety(recipe, profile)) return;
    if (!pinnableDays(plan, recipeId).includes(dayIndex)) return;
    get().rerollMeal(dayIndex, recipeId);
  },

  pinnableDraftDaysFor: (recipeId) => {
    const draftPlan = get().draftPlan;
    if (!draftPlan) return [];
    if (draftPlan.meals.some((m) => m.recipeId === recipeId)) return [];
    return draftPlan.meals.map((m) => m.dayIndex);
  },

  pinRecipeToDraft: (dayIndex, recipeId) => {
    const draftPlan = get().draftPlan;
    const recipe = getRecipe(recipeId);
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!draftPlan || !recipe) return;
    if (!passesAllergySafety(recipe, profile)) return;
    if (!get().pinnableDraftDaysFor(recipeId).includes(dayIndex)) return;
    const meals = draftPlan.meals.map((m) => (m.dayIndex === dayIndex ? { ...m, recipeId, locked: false } : m));
    const next = { ...draftPlan, meals };
    set({ draftPlan: next });
    persistDraft(next);
  },

  addMissingIngredients: (dayIndex, recipeId) => {
    const plan = get().plan;
    const list = get().shoppingList;
    const recipe = getRecipe(recipeId);
    if (!plan || !list || !recipe) return;
    const pantry = usePantryStore.getState().items;
    const outgoingMeal = plan.meals.find((m) => m.dayIndex === dayIndex);
    const outgoingRecipe = outgoingMeal ? getRecipe(outgoingMeal.recipeId) : undefined;
    const available = availableIngredients(pantry, list, outgoingRecipe);
    const missingNames = new Set(missingIngredients(recipe, available));
    const ingredientsToAdd = recipe.ingredients.filter((ing) => missingNames.has(ing.name));
    if (ingredientsToAdd.length === 0) return;
    const next = addIngredientsToShoppingList(list, ingredientsToAdd, recipeId, hebProvider);
    set({ shoppingList: next });
    persistList(next);
  },

  approve: () => {
    const draftPlan = get().draftPlan;
    if (!draftPlan) return;
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

  recipeFor: (meal) => getRecipe(meal.recipeId),

  previewShoppingList: (plan) => listFor(plan),
}));
