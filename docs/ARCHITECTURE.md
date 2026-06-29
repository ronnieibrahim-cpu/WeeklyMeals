# Weekly Meals — Folder Architecture & Data Model (Step 3)

> The engineering blueprint. Defines the project layout, the layered architecture
> (UI ↔ stores ↔ engine ↔ data), the TypeScript data models, the provider/repository
> interfaces that make the app future-proof, and the reusable component library.
> Step 4 scaffolds exactly this.

---

## 1. Architectural principles

1. **Layered & one-directional.** Dependencies point *inward*:
   `app/ (routes) → stores → engine → domain`, with `data` plugged in at the edges.
   The **domain** layer (pure types + rules) depends on nothing.
2. **Pure, testable core.** `engine/` and `domain/` contain **no React and no I/O** —
   just deterministic functions. This is what makes the recommendation logic unit-testable.
3. **Swappable edges via interfaces.** Persistence and grocery stores sit behind
   interfaces (`Repository`, `GroceryProvider`, `RecommendationProvider`). v1 ships local
   implementations; Supabase / other stores / an LLM engine drop in later **without touching UI**.
4. **Cross-platform by construction (native iOS + web).** No native-only API without a web
   fallback (per PRD §10.0). Storage uses AsyncStorage (IndexedDB on web). Styling uses a
   token theme that works on both.
5. **Feature-oriented, reusable UI.** A small library of presentational components
   (`src/ui/components`) composed by route screens (`app/`).

```
        ┌─────────────────────────────────────────────┐
        │  app/  (Expo Router screens — thin, declarative)
        └───────────────┬─────────────────────────────┘
                        │ uses
        ┌───────────────▼─────────────┐   ┌──────────────────────┐
        │  src/stores/ (Zustand)       │   │  src/ui/ (components, │
        │  bridge: state + actions     │◄──┤  theme, hooks)        │
        └───────────────┬─────────────┘   └──────────────────────┘
                        │ calls
        ┌───────────────▼─────────────┐
        │  src/engine/ (pure logic)    │  recommendation · shopping · cost ·
        │                              │  schedule · learning · units
        └───────────────┬─────────────┘
                        │ depends on types only
        ┌───────────────▼─────────────┐   ┌──────────────────────┐
        │  src/domain/ (models, rules) │   │  src/data/ (edges)    │
        │  pure types, constants       │◄──┤  repositories, grocery│
        └──────────────────────────────┘   │  providers, seed data │
                                            └──────────────────────┘
```

---

## 2. Project structure

```
WeeklyMeals/
├── app/                              # Expo Router (file-based routes)
│   ├── _layout.tsx                   # Root: ThemeProvider, stores init, fonts, splash
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Bottom tab bar (4 tabs)
│   │   ├── index.tsx                 # 🍽  This Week (home)
│   │   ├── schedule.tsx              # 📅  Schedule
│   │   ├── shopping.tsx              # 🛒  Shopping List
│   │   └── profile.tsx               # 👤  Profile
│   ├── plan/                         # "Plan This Week" — presented as modal
│   │   ├── _layout.tsx               # modal stack
│   │   ├── index.tsx                 # intake questionnaire (stepper)
│   │   └── review.tsx                # Review & Approve generated week
│   ├── review/
│   │   └── index.tsx                 # Weekly Review (learning loop, modal)
│   ├── meal/
│   │   └── [id].tsx                  # Meal Detail (dynamic route)
│   ├── settings.tsx                  # Settings (pushed)
│   └── +not-found.tsx
│
├── src/
│   ├── domain/                       # PURE — no React, no I/O
│   │   ├── models/                   # TypeScript interfaces (see §3)
│   │   │   ├── profile.ts
│   │   │   ├── recipe.ts
│   │   │   ├── ingredient.ts
│   │   │   ├── plan.ts
│   │   │   ├── shopping.ts
│   │   │   ├── rating.ts
│   │   │   ├── preferences.ts
│   │   │   ├── intake.ts
│   │   │   └── index.ts              # barrel export
│   │   └── constants/
│   │       ├── cuisines.ts           # the cuisine/category list (PRD §"Meal Categories")
│   │       ├── departments.ts        # H-E-B department order (PRD §6.3)
│   │       ├── equipment.ts
│   │       └── index.ts
│   │
│   ├── engine/                       # PURE deterministic logic (unit-tested)
│   │   ├── recommendation/
│   │   │   ├── RecommendationProvider.ts   # interface
│   │   │   ├── LocalRecommendationEngine.ts # v1 implementation
│   │   │   ├── scoring.ts                    # score(recipe) — PRD §7
│   │   │   └── filters.ts                    # hard filters (allergy/diet/time)
│   │   ├── shoppingList.ts           # consolidate + dedupe + subtract pantry
│   │   ├── cost.ts                   # cost estimate via GroceryProvider
│   │   ├── schedule.ts               # cooking schedule + leftover plan
│   │   ├── learning.ts               # RatingEvent[] → PreferenceProfile update
│   │   ├── units.ts                  # unit normalization / conversion
│   │   └── __tests__/                # engine unit tests
│   │
│   ├── data/                         # EDGES — IO + seed data (swappable)
│   │   ├── repositories/
│   │   │   ├── Repository.ts                 # generic CRUD interface
│   │   │   ├── ProfileRepository.ts
│   │   │   ├── PlanRepository.ts
│   │   │   ├── RatingRepository.ts
│   │   │   ├── PreferenceRepository.ts
│   │   │   └── local/
│   │   │       ├── kvStore.ts                # AsyncStorage wrapper (native+web)
│   │   │       ├── LocalProfileRepository.ts
│   │   │       ├── LocalPlanRepository.ts
│   │   │       └── ...                       # (Supabase impls live here later)
│   │   ├── grocery/
│   │   │   ├── GroceryProvider.ts            # interface (future: Costco, Kroger…)
│   │   │   └── heb/
│   │   │       ├── HebProvider.ts            # v1 store
│   │   │       └── hebPriceTable.ts          # curated realistic prices
│   │   └── seed/
│   │       └── recipes.ts                    # ~50-recipe starter library
│   │
│   ├── stores/                       # Zustand — UI state + orchestration
│   │   ├── profileStore.ts
│   │   ├── planStore.ts              # intake answers, current plan, generate/swap
│   │   ├── reviewStore.ts
│   │   └── settingsStore.ts          # theme, etc.
│   │
│   ├── ui/
│   │   ├── components/                # reusable presentational components (§4)
│   │   ├── theme/
│   │   │   ├── tokens.ts              # raw scales (palette, spacing, radius)
│   │   │   ├── colors.ts              # semantic light/dark colors
│   │   │   ├── typography.ts
│   │   │   ├── ThemeProvider.tsx
│   │   │   └── useTheme.ts
│   │   └── hooks/
│   │       ├── useColorScheme.ts
│   │       └── useHaptics.ts          # no-op fallback on web
│   │
│   └── utils/
│       ├── date.ts                   # week ranges, day labels
│       ├── id.ts                     # id generation
│       └── format.ts                 # currency, quantities
│
├── assets/                           # icons, fonts, illustrations
├── docs/                             # PRD.md · WIREFRAMES.md · ARCHITECTURE.md
├── app.json                          # Expo config (name, icon, scheme, web)
├── babel.config.js
├── tsconfig.json                     # strict; path alias @/* → src/*
└── package.json
```

---

## 3. Data Model (TypeScript interfaces)

These are the concrete types that live in `src/domain/models/`. Shown here as the
contract Step 4 implements verbatim.

### 3.1 Shared / enums
```ts
export type Cuisine =
  | 'Italian' | 'Mexican' | 'Greek' | 'Indian' | 'Thai' | 'Japanese'
  | 'Chinese' | 'French' | 'Mediterranean' | 'American' | 'MiddleEastern'
  | 'BBQ';

export type Category =
  | 'ComfortFood' | 'Healthy' | 'LowCarb' | 'HighProtein' | 'Seafood'
  | 'Vegetarian' | 'SlowCooker' | 'Grilling' | 'SheetPan' | 'OnePot'
  | 'Pasta' | 'RiceBowls' | 'Soups' | 'Stews' | 'Sandwiches'
  | 'Salads' | 'BreakfastForDinner' | 'SeasonalSpecial';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type SpiceLevel = 'None' | 'Mild' | 'Medium' | 'Hot';
export type Department =
  | 'Produce' | 'Meat' | 'Seafood' | 'Bakery' | 'Frozen'
  | 'Dairy' | 'DryGoods' | 'International' | 'Spices' | 'Household';
export type Unit =
  | 'g' | 'kg' | 'oz' | 'lb' | 'ml' | 'l' | 'tsp' | 'tbsp'
  | 'cup' | 'clove' | 'can' | 'bunch' | 'piece' | 'pinch';
export type Protein =
  | 'Chicken' | 'Beef' | 'Pork' | 'Fish' | 'Shellfish'
  | 'Turkey' | 'Lamb' | 'Tofu' | 'Beans' | 'Eggs' | 'None';
```

### 3.2 Recipe & ingredients
```ts
export interface Nutrition { calories: number; protein: number; carbs: number; fat: number; } // per serving

export interface RecipeIngredient {
  name: string;            // canonical name, e.g. "chicken thighs"
  quantity: number;        // per the recipe's base servings
  unit: Unit;
  department: Department;   // for shopping-list grouping
  optional?: boolean;
  pantryStaple?: boolean;   // salt/oil — usually already at home
}

export interface Recipe {
  id: string;
  name: string;
  cuisine: Cuisine;
  categories: Category[];
  primaryProtein: Protein;
  vegetables: string[];            // for rotation/variety scoring
  techniques: string[];            // e.g. ['roast','sheet-pan'] for learning
  difficulty: Difficulty;
  spiceLevel: SpiceLevel;
  prepMinutes: number;
  cookMinutes: number;
  baseServings: number;
  nutrition: Nutrition;            // per serving
  ingredients: RecipeIngredient[];
  steps: string[];
  leftoverNotes?: string;
  freezingNotes?: string;
  makesLeftovers: boolean;
  seasons: ('spring'|'summer'|'fall'|'winter')[]; // [] = all-year
  allergens: string[];             // e.g. ['peanuts','dairy']
  dietTags: string[];              // e.g. ['vegetarian','gluten-free']
  image?: string;                  // asset key; UI falls back to gradient card
}
```

### 3.3 Profile & intake
```ts
export interface HouseholdMember { ageYears?: number; isChild: boolean; }

export interface Profile {
  id: string;
  familySize: number;
  members: HouseholdMember[];
  cookingSkill: Difficulty;
  favoriteCuisines: Cuisine[];
  dislikedCuisines: Cuisine[];
  preferredProteins: Protein[];
  dislikedIngredients: string[];
  allergies: string[];
  dietaryRestrictions: string[];   // e.g. ['vegetarian','gluten-free']
  spiceLevel: SpiceLevel;
  weeklyBudget: number;            // USD
  avgCookMinutes: number;
  shoppingDay: number;             // 0–6
  mealPrepDay: number;
  favoriteStore: string;           // 'HEB'
  equipment: string[];             // ['Oven','AirFryer','SlowCooker'...]
  nutritionPriorities: string[];   // ['HighProtein','LowCarb'...]
  targetCaloriesPerMeal?: number;
  targetProteinPerMeal?: number;
  pantryStaples: string[];         // things always on hand
}

// One Sunday's answers (defaults seeded from Profile)
export interface IntakeAnswers {
  dinners: number;
  people: number;
  budget: number;
  maxPrepMinutes: number;
  maxCookMinutes: number;
  cuisines: Cuisine[];             // [] = no preference
  healthyVsComfort: number;        // 0 healthy … 1 comfort
  dietaryRestrictions: string[];
  ingredientsAtHome: string[];
  adventurousness: number;         // 0 safe … 1 adventurous
  specialOccasions: string[];
  desiredLeftovers: number;        // # meals that should yield leftovers
}
```

### 3.4 Plan, schedule, shopping, ratings, preferences
```ts
export interface PlannedMeal {
  recipeId: string;
  servings: number;                // scaled to people
  dayIndex: number;                // 0–6 within the week
  locked: boolean;                 // user "kept" it during review
  isLeftoverDay?: boolean;         // reuses a prior meal
  leftoverFromRecipeId?: string;
}

export interface WeeklyPlan {
  id: string;
  weekStartISO: string;            // Monday (or shopping day) of the week
  intake: IntakeAnswers;
  meals: PlannedMeal[];
  status: 'draft' | 'approved' | 'completed';
  createdAtISO: string;
}

export interface ShoppingItem {
  ingredientName: string;
  quantity: number;
  unit: Unit;
  department: Department;
  hebProductName?: string;
  estimatedPrice: number;          // USD
  checked: boolean;
  fromRecipeIds: string[];         // provenance (for edits/regen)
}

export interface ShoppingList {
  planId: string;
  items: ShoppingItem[];           // grouped by department in the UI
  estimatedTotal: number;
  costPerServing: number;
  generatedAtISO: string;
}

export interface RatingEvent {
  id: string;
  planId: string;
  recipeId: string;
  cooked: boolean;
  enjoyment?: number;              // 1–5
  cookAgain?: boolean;
  familyAgain?: boolean;
  tooMuchPrep?: boolean;
  tooExpensive?: boolean;
  tooSpicy?: boolean;
  tooBland?: boolean;
  tooManyLeftovers?: boolean;
  ratedAtISO: string;
}

// Derived, evolving — the heart of "gets better every week"
export interface PreferenceProfile {
  cuisineAffinity: Partial<Record<Cuisine, number>>;     // -1 … +1
  proteinAffinity: Partial<Record<Protein, number>>;
  vegetableAffinity: Record<string, number>;
  techniqueAffinity: Record<string, number>;
  spiceTolerance: number;          // adjusts away from "too spicy/bland"
  complexityPreference: number;    // adjusts toward easier if "too much prep"
  budgetSensitivity: number;       // raises if "too expensive"
  leftoverTolerance: number;       // lowers if "too many leftovers"
  mealsRated: number;
  avgEnjoyment: number;
  blockedRecipeIds: string[];      // repeatedly hated
}
```

---

## 4. Reusable component library (`src/ui/components/`)

Derived directly from the wireframes' component map (WIREFRAMES §12).

| Component | Purpose | Key props |
| --- | --- | --- |
| `Screen` | Safe-area page wrapper w/ themed bg + scroll | `title?`, `headerRight?` |
| `PrimaryButton` / `SecondaryButton` | Actions; one primary per screen | `title`, `onPress`, `loading?` |
| `Card` | Rounded surface (shadow light / border dark) | `onPress?` |
| `MealCard` | compact · hero · lockable variants | `recipe`, `variant`, `onLock?`, `onSwap?` |
| `StatStrip` | prep · cook · cal · protein row | `recipe` |
| `CuisineTag` | tinted chip | `cuisine` |
| `SummaryCard` | cost total + per-serving | `total`, `perServing`, `meta` |
| `QuestionScaffold` | intake/review frame: progress + title + control + continue | `step`, `total`, `title`, `subtitle`, `onContinue`, `onSkip?` |
| `Stepper` | – n + | `value`, `min`, `max`, `onChange` |
| `OptionCards` | single-select cards | `options`, `value`, `onChange` |
| `ChipMultiSelect` | multi-select chips | `options`, `values`, `onChange` |
| `Slider` | labeled poles (Healthy↔Comfort) | `value`, `labels` |
| `TagInput` | free-text tags (pantry items) | `values`, `onAdd`, `onRemove` |
| `StarRating` | 1–5 | `value`, `onChange` |
| `YesNoToggle` | segmented yes/no | `value`, `onChange` |
| `DepartmentSection` | collapsible shopping group | `department`, `items`, `onToggleItem` |
| `ShoppingItemRow` | checkbox + name + qty + price | `item`, `onToggle` |
| `SettingsRow` | label + value + chevron | `label`, `value?`, `onPress?`, `disabled?` |
| `SectionHeader` | uppercase group label | `title` |
| `Banner` | inline nudges (end-of-week review) | `title`, `action` |
| `EmptyState` | illustration + message + CTA | `title`, `body`, `action` |
| `SkeletonCard` | shimmer loading placeholder | `variant` |

---

## 5. State stores (Zustand)

- **`profileStore`** — load/save `Profile`; exposes derived defaults for intake.
- **`planStore`** — holds `IntakeAnswers`, current `WeeklyPlan`, derived `ShoppingList` &
  schedule; actions: `generate()`, `swapMeal(slot)`, `toggleLock(slot)`, `regenerateUnlocked()`,
  `approve()`, `toggleShoppingItem(id)`. Calls `engine/` + `data/` under the hood.
- **`reviewStore`** — collects `RatingEvent[]` for the active/just-finished week; on submit
  calls `engine/learning` and persists the updated `PreferenceProfile`.
- **`settingsStore`** — theme mode + misc app settings.

Stores are the **only** place UI talks to engine/data, keeping screens thin.

---

## 6. Future-proofing (interfaces already in place)

- **`RecommendationProvider`** — `recommend(intake, profile, prefs, recipes): PlannedMeal[]`.
  v1 = `LocalRecommendationEngine`. Later = `RemoteRecommendationEngine` (LLM/API), same signature.
- **`GroceryProvider`** — `priceFor(item): {productName, price}` + `departmentOrder`.
  v1 = `HebProvider`. Later = `CostcoProvider`, `KrogerProvider`, … + ordering hooks
  (Instacart / HEB Curbside) added to the interface without breaking callers.
- **`Repository<T>`** — `get/getAll/save/delete`. v1 = AsyncStorage (native + web).
  Later = `SupabaseRepository<T>` swapped in `data/repositories/`; nothing above changes.
- **Serializable models** — every model is plain JSON → trivial cloud sync / export.

---

## 7. Tooling & conventions

- **TypeScript strict**, path alias `@/*` → `src/*`.
- **Expo Router** for native + web routing with shareable URLs.
- **Zustand** for state (tiny, no boilerplate).
- **AsyncStorage** for cross-platform persistence behind `kvStore`.
- **Engine unit tests** (Jest) for scoring, consolidation, cost, learning — the logic that must stay correct.
- Naming: components `PascalCase.tsx`, modules `camelCase.ts`, types in `domain/models`.
- No business logic in `app/` route files — they compose stores + components only.

---

## 8. What Step 4 will scaffold from this

1. Expo project (`app.json`, `package.json`, `tsconfig.json`, `babel.config.js`) with web enabled.
2. `app/_layout.tsx` + `(tabs)/_layout.tsx` → booting, themed, navigable 4-tab shell.
3. `src/ui/theme/*` → token theme + dark mode + `useTheme`.
4. `src/domain/models/*` + `constants/*` → the types above (compiling, no logic yet).
5. Empty-but-present folders for `engine/`, `data/`, `stores/` so the structure is real.
6. A couple of core components (`Screen`, `PrimaryButton`, `Card`) to prove the theme.

Exit criteria for Step 4: **`npx tsc --noEmit` passes and the app boots** (web export + Expo Go),
showing themed placeholder tabs. Features (5a–5h) fill the empty layers one at a time.
```
