# PROJECT.md — Weekly Meals

> **The canonical reference for every development session (human or AI).**
> Read this before touching code. It describes how the app *actually* works
> (verified by reading the full implementation at commit `fbe6430`), not how
> the original design docs said it would work. Where `docs/ARCHITECTURE.md`
> disagrees with reality, this file wins. If reality and this file disagree,
> fix this file in the same change.

---

## 1. What this app is

A meal-planning app for one family (2 adults, 2 young kids, Houston TX).
Every week it asks a short questionnaire, generates a week of dinners from a
built-in recipe library, and produces one consolidated H-E-B shopping list
with estimated prices. Ratings after each week nudge future recommendations.

**Product owner is a non-programmer.** Communicate in plain English; make
routine engineering decisions autonomously (simplest maintainable option);
involve the owner only for product vision, UX, feature behavior, privacy, or
significant architectural tradeoffs — and then recommend one option with
reasons.

**Mission (the test for every feature):** does it meaningfully reduce
decision fatigue for a busy family? Remove clicks rather than add settings.

## 2. Technology stack

- **Expo SDK 56 / React Native 0.85 / React 19** — one codebase for iOS (Expo Go) and web
- **expo-router** — file-based navigation (`app/` folder = screens; typed routes on)
- **TypeScript (strict)** — path alias `@/*` → `src/*`; `npm run typecheck` must stay green
- **Zustand** — state management (`src/stores/`)
- **AsyncStorage** — local persistence (localStorage/IndexedDB on web)
- **Supabase REST (raw fetch, no SDK)** — optional "household sync" between two phones;
  publishable key committed by design, access must be governed by RLS
- **GitHub Pages** — web deploy via `.github/workflows/deploy-web.yml`
  (fires on every push to `claude/weekly-meals-app-eyowlr`; `app.config.js` injects `EXPO_BASE_URL`)
- **No test framework installed. There are currently zero tests.**

## 3. Layered architecture (actual, verified)

```
app/ (screens, thin)  →  src/stores/ (Zustand, orchestration + persistence calls)
                          →  src/engine/ (pure logic: recommendation, shopping, cost, learning, season)
                          →  src/domain/ (pure types + constants; depends on nothing)
src/data/ (edges): repositories (AsyncStorage), H-E-B price table, seed recipes, Supabase sync, importer
src/ui/   (theme tokens light/dark + ~18 reusable presentational components)
```

Rules that must hold:
- `engine/` and `domain/` contain **no React and no I/O**; pure functions take
  everything as arguments (no store imports inside `engine/` except types).
- All persistence flows through a repository; never call AsyncStorage directly.
- Grocery pricing behind `GroceryProvider`; recommendations behind
  `RecommendationProvider`. Swap implementations at the edges, never touch UI.
- No native-only API without a web fallback.

## 4. Repository map & key modules

```
app/(tabs)/          index (This Week) · schedule · shopping · profile  + custom tab bar
app/plan/            14-step Sunday intake wizard → review.tsx (lock/swap/regenerate/approve)
app/review/          Weekly ratings wizard (learning loop)
app/meal/[id].tsx    Recipe detail · app/household.tsx sync setup · app/settings.tsx theme
src/domain/          models (Recipe, Profile, IntakeAnswers, WeeklyPlan, ShoppingList,
                     RatingEvent, PreferenceProfile) + constants (12 cuisines, H-E-B dept order, chips)
src/engine/          recommendation/ (filters.ts hard filters · scoring.ts 12 weighted factors,
                     WEIGHTS in types.ts · LocalRecommendationEngine.ts greedy picker with shuffle
                     tie-breaking) · shoppingList.ts · cost.ts (rough heuristic) · learning.ts · season.ts
src/data/seed/       recipes.ts assembles batch1..8 (230 hand-authored) + recipeImported.ts
                     (311 TheMealDB imports, GENERATED — never hand-edit; re-run
                     scripts/importRecipes.ts via normalize.ts). 541 recipes total.
src/data/grocery/heb HebProvider: curated price table, per-lb conversion (g/ml/kg/l), dept fallbacks
src/data/repositories/local  kvStore (AsyncStorage JSON) + one repo per aggregate
src/data/sync/       config.ts (URL/key/SYNC_ENABLED kill-switch) · householdApi.ts (get/upsert row by 6-char code)
src/stores/          planStore (orchestrator) · profileStore · pantryStore · learningStore ·
                     settingsStore (in-memory only) · syncStore (poll 20s, debounced push 600ms, last-write-wins)
src/data/images.ts / recipeImages.ts   curated photo URLs with per-cuisine emoji-tile fallback
```

## 5. Key data flow (the weekly loop)

1. **Sunday intake** (`plan/index`): 14-step wizard pre-filled from Profile →
   `setIntake()` → `generate()` → draft `WeeklyPlan` persisted. ⚠️ `generate()`
   currently **replaces the live approved plan immediately** (see bug P0-3).
2. **Review** (`plan/review`): lock/swap/regenerate → `approve()` → status
   `approved`, shopping list built (scaled by servings, deduped by
   `lowercase(name)|unit`, pantry-staples + on-hand pantry excluded, priced) and persisted.
3. **During the week**: home + schedule show meals by `dayIndex`
   (0 = "Tonight" — never advances with the calendar; known bug), cooked
   toggles, shopping check-offs.
4. **Weekly review** (`review/index`): per-meal ratings → `applyRatings()` →
   cuisine/protein/technique/vegetable affinities nudged (clamped ±1), four
   dials updated (spice/complexity/budget/leftovers), strong dislikes appended
   to `blockedRecipeIds` → next week's scoring shifts. `submitReview()` also
   calls `planStore.markReviewed()`, stamping `plan.reviewedAtISO`; once set,
   the home card shows "Week rated ✓" and re-opening `/review` shows a
   read-only summary instead of the wizard — one review per plan (M1.3).
5. **Sync (optional)**: `{plan, shoppingList}` pushed/pulled as one JSON blob
   against the household row. Profile, pantry, and learning stay per-device.

## 6. Coding conventions

- Screens hold no business logic; select from stores, render `src/ui/components`.
- Stores follow a fixed shape: `hydrated` flag, idempotent `init()`, synchronous
  actions that `set()` then fire-and-forget persist (`void repo.save(...)`).
- Theme values only via `useTheme()`; no hardcoded colors/spacing; light + dark must both work.
- Comments explain *why*; doc-comments on exported functions.
- Prefer one implementation imported twice over two copies (see debt item 12).
- **Allergy/diet filtering is safety-critical: any change there ships with tests in the same PR.**

## 7. Known bugs & technical debt (verified July 2026 — full detail in AUDIT.md)

**P0**
1. **Allergy filter is unreliable.** Two failure modes: (a) seed data mixes
   `'Tree Nuts'` and `'TreeNuts'` — the lowercased exact match in
   `filters.ts` misses one of them, so tree-nut recipes can pass a tree-nut
   allergy; (b) for the 311 imported recipes, allergens were inferred by
   keyword matching (`inferAllergens` in `normalize.ts`) that misses
   derivatives (whey, casein, malt, sauces), and 65 imports have empty
   allergen arrays. Fix: canonical allergen list + normalized comparison + CI
   seed-validation script + a "curated-only when allergies present" guard for
   imports. Same caution applies to inferred diet tags (halal/kosher/vegan).
2. **Kosher filter no-op:** `(tags.includes('kosher') || true)` in
   `filters.ts` — only the pork/shellfish check actually runs.
3. **"Plan a new week" destroys the current week before approval.**
   `generate()` overwrites the approved plan (and cooked progress) the moment
   the questionnaire finishes; closing review without approving loses the week.
4. **Shared shopping list loses updates.** Whole-payload last-write-wins sync;
   two phones checking items in-store clobber each other. Needs per-item merge.

**P1**
5. **"Tonight" never advances** — `dayIndex 0` is always "Tonight";
   `weekStartISO` is the generation timestamp. Meals need real dates.
6. ~~Two disagreeing cost numbers~~ — **fixed (M1.2)**: review and home now
   call `usePlanStore().previewShoppingList(plan)` (a thin wrapper around
   `buildShoppingList()`), so every screen shows the same H-E-B-priced total;
   `roughCostPerServing()` is scoped to engine scoring only.
7. **Dead intake questions** — `desiredLeftovers` and `specialOccasions` are
   asked every Sunday and never read; no leftover-day logic exists
   (`isLeftoverDay` never set) despite README/PRD promises.
8. **Half-connected learning** — `spiceTolerance`, `complexityPreference`,
   `budgetSensitivity`, `leftoverTolerance`, `vegetableAffinity` are learned
   but never used in scoring; profile `spiceLevel`/`equipment`/`cookingSkill`
   also unused. ~~Weekly review can be submitted repeatedly for the same plan
   (double-counts).~~ **Fixed (M1.3)**: `plan.reviewedAtISO` guards it. Blocked
   recipes have no unblock UI (reset fns exist, unwired).
9. **No cross-week memory** — engine has no plan history, so top-scored weeks
   repeat. Needs a recency penalty over the last 2–3 weeks.
10. ~~Theme preference resets every launch~~ — **fixed (M1.1)**: persisted via
    `SettingsRepository` / `LocalSettingsRepository` (`kvStore` key
    `wm:settings:v1`), hydrated on app start from `app/_layout.tsx`.
11. **Zero tests** despite a deliberately pure engine; `docs/ARCHITECTURE.md`
    references `__tests__/`, `schedule.ts`, `units.ts`, `reviewStore`,
    `RatingRepository` — none exist. Docs are aspirational.

**P2**
12. Duplicate `shuffle()` + inline re-implementation of engine selection in
    `planStore.swapMeal`.
13. Imported-recipe quality dilutes picks: cuisine mapping lumps British/Irish/
    Russian/Kenyan → "American", Vietnamese/Filipino/Malaysian → "Thai"; all
    imports claim 4 servings / ~15+30 min; nutrition is formula-guessed; odd
    units ("1 piece" salt cod). No scoring distinction curated vs estimated.
14. `joinHousehold` with a short code silently no-ops (button appears dead);
    create doesn't check code collisions.
15. Sync security is honor-system: 6-char code is the only secret; **verify
    Supabase RLS on `households`** restricts anon select/upsert to a supplied
    code (key is public in the bundle). Data is low-sensitivity but dietary
    restrictions are health-adjacent.
16. `recipesById` built with spread-inside-reduce (O(n²) over 541 recipes at
    startup) — replace with a plain loop.
17. A11y gaps: chips/star rating lack accessibilityRole/state.

## 8. Roadmap (agreed direction — no code changes without owner approval on scope)

- **Milestone 1 — Trust & safety:** P0-1/2 allergen + kosher fixes + seed
  validator + imports-guard · P0-3 draft-plan protection (new plan is a pending
  draft; replace only on approve) · remove/wire dead questions · real dates +
  correct "Tonight" · single cost source (HebProvider everywhere, done) ·
  persist theme (done) · one-review-per-plan guard (done) · unblock/reset UI.
- **Milestone 2 — Reduce Sunday friction:** "Same as last week?" one-tap fast
  path + cross-week recency penalty so the engine rotates on its own.
- **Milestone 3 — Family list:** manual shopping items · per-item sync merge
  (P0-4) · checks survive rebuilds.
- **Milestone 4 — Engine test suite:** filters (every allergen), scoring
  invariants, shopping consolidation, learning math.
- Later: use learned dials in scoring · day-aware planning/reorder · recipe
  browser + manual picks · leftovers-aware planning · pantry auto-deduction
  after shopping · sync pantry/profile/learning · notifications · curated-recipe
  weighting / import quality pass · other stores.
- Future: Claude-powered natural-language intake mapped onto the deterministic
  engine as constraints — **allergy filtering stays deterministic; never
  delegate safety to a model.**

## 9. Operational notes for future AI sessions

- `npm install` then `npm run typecheck` first; keep it green; update this
  file (bugs fixed, features added) in the same change.
- `recipeImported.ts` is **generated** — never hand-edit; change
  `normalize.ts` / `scripts/importRecipes.ts` and re-run instead.
- Every push to `claude/weekly-meals-app-eyowlr` deploys the web build.
- Keep changes small and grouped by milestone; isolate anything touching the
  plan lifecycle or seed data.
