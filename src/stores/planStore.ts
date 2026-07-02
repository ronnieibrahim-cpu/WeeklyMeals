import { create } from 'zustand';

import { hebProvider } from '@/data/grocery/heb/HebProvider';
import { getRecipe, RECIPES } from '@/data/seed/recipes';
import { localPlanHistoryRepository } from '@/data/repositories/local/LocalPlanHistoryRepository';
import { localPlanRepository } from '@/data/repositories/local/LocalPlanRepository';
import { localShoppingListRepository } from '@/data/repositories/local/LocalShoppingListRepository';
import { createDefaultProfile } from '@/domain/defaults';
import { IntakeAnswers, PlannedMeal, Profile, Recipe, ShoppingList, WeeklyPlan } from '@/domain/models';
import { passesHardFilters, sampleTopScored, scoreRecipe } from '@/engine/recommendation';
import { localRecommendationEngine } from '@/engine/recommendation';
import { GenerateContext } from '@/engine/recommendation';
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

function context(
  intake: IntakeAnswers,
  profile: Profile,
  lockedRecipeIds: string[],
  history: WeeklyPlan[],
): GenerateContext {
  const learning = useLearningStore.getState();
  // Meals from the last two archived weeks get a fatigue penalty.
  const recentRecipeIds = history.slice(0, 2).flatMap((p) => p.meals.map((m) => m.recipeId));
  return {
    intake,
    profile,
    preferences: learning.preferences,
    favoriteRecipeIds: learning.favorites,
    recentRecipeIds,
    pantry: intake.ingredientsAtHome,
    season: seasonForDate(new Date()),
    lockedRecipeIds,
  };
}

interface PlanState {
  intake: IntakeAnswers | null;
  plan: WeeklyPlan | null;
  shoppingList: ShoppingList | null;
  /** Past approved weeks, newest first. */
  history: WeeklyPlan[];
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
  /**
   * Replace one meal after the week is finalized. Rebuilds the shopping list for
   * the new week, keeping items you'd already checked off checked.
   */
  applyReroll: (dayIndex: number, recipeId: string) => void;
  /** Mark a meal cooked / not cooked (week progress). */
  toggleCooked: (dayIndex: number) => void;
  approve: () => void;
  /** (Re)build the H-E-B shopping list from the current plan. */
  buildList: () => void;
  toggleShoppingItem: (ingredientName: string, unit: string) => void;
  /** Replace plan + shopping list from a remote sync payload. */
  hydrateFromSync: (plan: WeeklyPlan | null, shoppingList: ShoppingList | null) => void;
  clear: () => void;
  recipeFor: (meal: PlannedMeal) => Recipe | undefined;
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
  history: [],
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;
    const [plan, shoppingList, history] = await Promise.all([
      localPlanRepository.load(),
      localShoppingListRepository.load(),
      localPlanHistoryRepository.load(),
    ]);
    set({
      plan: plan ?? null,
      intake: plan?.intake ?? null,
      shoppingList: shoppingList ?? null,
      history: history ?? [],
      hydrated: true,
    });
  },

  setIntake: (intake) => set({ intake }),

  generate: () => {
    const intake = get().intake;
    const profile = useProfileStore.getState().profile ?? createDefaultProfile();
    if (!intake) return;

    // Starting a new week retires the old one into history (drafts are discarded).
    const previous = get().plan;
    let history = get().history;
    if (previous && previous.status === 'approved') {
      history = [previous, ...history];
      set({ history });
      void localPlanHistoryRepository.save(history);
    }

    const meals = localRecommendationEngine.generate(
      context(intake, profile, [], history),
      RECIPES,
    );
    const plan: WeeklyPlan = {
      id: createId(),
      weekStartISO: new Date().toISOString(),
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
    const meals = localRecommendationEngine.generate(
      context(intake, profile, lockedIds, get().history),
      RECIPES,
    );
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
    const ctx = context(intake, profile, [], get().history);
    const candidates = RECIPES.filter(
      (r) => !used.has(r.id) && passesHardFilters(r, intake, profile),
    );
    if (candidates.length === 0) return;
    const scored = shuffle(candidates).map((recipe) => ({
      recipe,
      score: scoreRecipe(recipe, ctx, selected),
    }));
    const best = sampleTopScored(scored, 5);
    if (!best) return;
    const meals = plan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, recipeId: best.id, locked: false } : m,
    );
    const next = { ...plan, meals };
    set({ plan: next });
    persist(next);
  },

  applyReroll: (dayIndex, recipeId) => {
    const { plan, shoppingList } = get();
    if (!plan) return;
    const meals = plan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, recipeId, locked: false, cooked: false } : m,
    );
    const next = { ...plan, meals };
    set({ plan: next });
    persist(next);

    if (plan.status !== 'approved') return;
    const rebuilt = listFor(next);
    if (shoppingList && shoppingList.planId === plan.id) {
      const checked = new Set(
        shoppingList.items
          .filter((i) => i.checked)
          .map((i) => `${i.ingredientName.toLowerCase()}|${i.unit}`),
      );
      rebuilt.items = rebuilt.items.map((i) =>
        checked.has(`${i.ingredientName.toLowerCase()}|${i.unit}`) ? { ...i, checked: true } : i,
      );
    }
    set({ shoppingList: rebuilt });
    persistList(rebuilt);
  },

  toggleCooked: (dayIndex) => {
    const plan = get().plan;
    if (!plan) return;
    const meals = plan.meals.map((m) =>
      m.dayIndex === dayIndex ? { ...m, cooked: !m.cooked } : m,
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
    const items = list.items.map((i) =>
      i.ingredientName === ingredientName && i.unit === unit ? { ...i, checked: !i.checked } : i,
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
    set({ plan: null, intake: null, shoppingList: null, history: [] });
    void localPlanRepository.clear();
    void localShoppingListRepository.clear();
    void localPlanHistoryRepository.clear();
  },

  recipeFor: (meal) => getRecipe(meal.recipeId),
}));
