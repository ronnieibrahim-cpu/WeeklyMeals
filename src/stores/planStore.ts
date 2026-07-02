import { create } from 'zustand';

import { hebProvider } from '@/data/grocery/heb/HebProvider';
import { getRecipe, RECIPES } from '@/data/seed/recipes';
import { localPlanRepository } from '@/data/repositories/local/LocalPlanRepository';
import { localShoppingListRepository } from '@/data/repositories/local/LocalShoppingListRepository';
import { createDefaultProfile } from '@/domain/defaults';
import { IntakeAnswers, PlannedMeal, Profile, Recipe, ShoppingList, WeeklyPlan } from '@/domain/models';
import { passesHardFilters, scoreRecipe } from '@/engine/recommendation';
import { localRecommendationEngine } from '@/engine/recommendation';
import { GenerateContext } from '@/engine/recommendation';
import { localMidnight } from '@/engine/schedule';
import { seasonForDate } from '@/engine/season';
import { buildShoppingList } from '@/engine/shoppingList';
import { createId } from '@/utils/id';

import { useLearningStore } from './learningStore';
import { usePantryStore } from './pantryStore';
import { useProfileStore } from './profileStore';

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  plan: WeeklyPlan | null;
  shoppingList: ShoppingList | null;
  hydrated: boolean;
  init: () => Promise<void>;
  setIntake: (intake: IntakeAnswers) => void;
  /** Build a fresh draft plan from the current intake. */
  generate: () => void;
  /** Re-pick every unlocked meal, keeping locked ones. */
  regenerate: () => void;
  toggleLock: (recipeId: string) => void;
  /** Replace a single meal (by day index) with a fresh pick. */
  swapMeal: (dayIndex: number) => void;
  /** Mark a meal cooked / not cooked (week progress). */
  toggleCooked: (dayIndex: number) => void;
  approve: () => void;
  /** Mark the current plan as reviewed, so the weekly review can't be submitted again. */
  markReviewed: () => void;
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
  shoppingList: null,
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const [plan, shoppingList] = await Promise.all([
      localPlanRepository.load(),
      localShoppingListRepository.load(),
    ]);
    set({
      plan: plan ?? null,
      intake: plan?.intake ?? null,
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
    const plan: WeeklyPlan = {
      id: createId(),
      weekStartISO: localMidnight(new Date()).toISOString(),
      intake,
      meals,
      status: 'draft',
      createdAtISO: new Date().toISOString(),
    };
    set({ plan });
    persist(plan);
  },

  regenerate: () => {
    const { plan, intake } = get();
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!plan || !intake) return;
    const lockedIds = plan.meals.filter((m) => m.locked).map((m) => m.recipeId);
    const meals = localRecommendationEngine.generate(context(intake, profile, lockedIds), RECIPES);
    const next: WeeklyPlan = { ...plan, meals };
    set({ plan: next });
    persist(next);
  },

  toggleLock: (recipeId) => {
    const plan = get().plan;
    if (!plan) return;
    const meals = plan.meals.map((m) =>
      m.recipeId === recipeId ? { ...m, locked: !m.locked } : m,
    );
    const next = { ...plan, meals };
    set({ plan: next });
    persist(next);
  },

  swapMeal: (dayIndex) => {
    const { plan, intake } = get();
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!plan || !intake) return;
    const used = new Set(plan.meals.map((m) => m.recipeId));
    const selected = plan.meals
      .filter((m) => m.dayIndex !== dayIndex)
      .map((m) => getRecipe(m.recipeId))
      .filter((r): r is Recipe => !!r);
    const ctx = context(intake, profile, []);
    const candidates = RECIPES.filter(
      (r) => !used.has(r.id) && passesHardFilters(r, intake, profile),
    );
    if (candidates.length === 0) return;
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const r of shuffle(candidates)) {
      const s = scoreRecipe(r, ctx, selected);
      if (s > bestScore) {
        bestScore = s;
        best = r;
      }
    }
    const meals = plan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, recipeId: best.id, locked: false } : m,
    );
    const next = { ...plan, meals };
    set({ plan: next });
    persist(next);
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

  approve: () => {
    const plan = get().plan;
    if (!plan) return;
    const next: WeeklyPlan = { ...plan, status: 'approved' };
    const shoppingList = listFor(next);
    set({ plan: next, shoppingList });
    persist(next);
    persistList(shoppingList);
  },

  markReviewed: () => {
    const plan = get().plan;
    if (!plan || plan.reviewedAtISO) return;
    const next: WeeklyPlan = { ...plan, reviewedAtISO: new Date().toISOString() };
    set({ plan: next });
    persist(next);
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
    set({ plan: null, intake: null, shoppingList: null });
    void localPlanRepository.clear();
    void localShoppingListRepository.clear();
  },

  recipeFor: (meal) => getRecipe(meal.recipeId),

  previewShoppingList: (plan) => listFor(plan),
}));
