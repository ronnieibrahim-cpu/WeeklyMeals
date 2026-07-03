import { create } from 'zustand';

import { hebProvider } from '@/data/grocery/heb/HebProvider';
import { getRecipe, RECIPES } from '@/data/seed/recipes';
import { localDraftPlanRepository } from '@/data/repositories/local/LocalDraftPlanRepository';
import { localPlanRepository } from '@/data/repositories/local/LocalPlanRepository';
import { localShoppingListRepository } from '@/data/repositories/local/LocalShoppingListRepository';
import { createDefaultProfile } from '@/domain/defaults';
import { IntakeAnswers, PlannedMeal, Profile, RatingEvent, Recipe, ShoppingList, WeeklyPlan } from '@/domain/models';
import { GenerateContext, localRecommendationEngine, passesHardFilters, selectReplacement } from '@/engine/recommendation';
import { availableIngredients, RerollOutcome, rerollCandidates } from '@/engine/reroll';
import { localMidnight } from '@/engine/schedule';
import { seasonForDate } from '@/engine/season';
import { buildShoppingList } from '@/engine/shoppingList';
import { createId } from '@/utils/id';

import { useLearningStore } from './learningStore';
import { usePantryStore } from './pantryStore';
import { useProfileStore } from './profileStore';

function context(intake: IntakeAnswers, profile: Profile, lockedRecipeIds: string[]): GenerateContext {
  const learning = useLearningStore.getState();
  return {
    intake,
    profile,
    preferences: learning.preferences,
    favoriteRecipeIds: learning.favorites,
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
  /** Replace a single meal (by day index) in the draft with a fresh pick. */
  swapMeal: (dayIndex: number) => void;
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

  swapMeal: (dayIndex) => {
    const { draftPlan, intake } = get();
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!draftPlan || !intake) return;
    const used = new Set(draftPlan.meals.map((m) => m.recipeId));
    const selected = draftPlan.meals
      .filter((m) => m.dayIndex !== dayIndex)
      .map((m) => getRecipe(m.recipeId))
      .filter((r): r is Recipe => !!r);
    const ctx = context(intake, profile, []);
    const candidates = RECIPES.filter(
      (r) => !used.has(r.id) && passesHardFilters(r, intake, profile),
    );
    const best = selectReplacement(candidates, ctx, selected);
    if (!best) return;
    const meals = draftPlan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, recipeId: best.id, locked: false } : m,
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

  approve: () => {
    const draftPlan = get().draftPlan;
    if (!draftPlan) return;
    const next: WeeklyPlan = { ...draftPlan, status: 'approved' };
    const shoppingList = listFor(next);
    set({ plan: next, draftPlan: null, shoppingList });
    persist(next);
    persistList(shoppingList);
    void localDraftPlanRepository.clear();
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
