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
app/review/          Optional catch-up wizard for unrated meals (M2.1) — see §5.4
app/meal/[id].tsx    Recipe detail · app/household.tsx sync setup · app/settings.tsx theme
src/domain/          models (Recipe, Profile, IntakeAnswers, WeeklyPlan, ShoppingList,
                     RatingEvent, PreferenceProfile) + constants (12 cuisines, H-E-B dept order, chips)
src/engine/          recommendation/ (filters.ts hard filters · scoring.ts 12 weighted factors,
                     WEIGHTS in types.ts · LocalRecommendationEngine.ts greedy picker with shuffle
                     tie-breaking) · shoppingList.ts · cost.ts (rough heuristic, scoring-only) ·
                     learning.ts (pure fold, RatingEvents -> PreferenceProfile) ·
                     rating.ts (isMealRated/unratedMeals/allMealsRated, M2.1) · season.ts ·
                     schedule.ts (local-date math: todayOffset/dayLabel) · syncMerge.ts (pure,
                     commutative/idempotent household-sync merge, M1.6; per-meal rating merge M2.1)
src/data/seed/       recipes.ts assembles batch1..8 (230 hand-authored) + recipeImported.ts
                     (311 TheMealDB imports, GENERATED — never hand-edit; re-run
                     scripts/importRecipes.ts via normalize.ts). 541 recipes total.
src/data/grocery/heb HebProvider: curated price table, per-lb conversion (g/ml/kg/l), dept fallbacks
src/data/repositories/local  kvStore (AsyncStorage JSON) + one repo per aggregate
src/data/sync/       config.ts (URL/key/SYNC_ENABLED kill-switch) · householdApi.ts (get/upsert row by 6-char code)
src/stores/          planStore (orchestrator) · profileStore · pantryStore · learningStore ·
                     settingsStore (persisted, wm:settings:v1) · syncStore (poll 20s, debounced push 600ms,
                     per-item/per-meal merge via src/engine/syncMerge.ts as of M1.6)
src/data/images.ts / recipeImages.ts   curated photo URLs with per-cuisine emoji-tile fallback
```

## 5. Key data flow (the weekly loop)

1. **Sunday intake** (`plan/index`): 14-step wizard pre-filled from Profile →
   `setIntake()` → `generate()` → draft `WeeklyPlan` persisted. ⚠️ `generate()`
   currently **replaces the live approved plan immediately** (see bug P0-3).
2. **Review** (`plan/review`): lock/swap/regenerate → `approve()` → status
   `approved`, shopping list built (scaled by servings, deduped by
   `lowercase(name)|unit`, pantry-staples + on-hand pantry excluded, priced) and persisted.
3. **During the week**: home computes `todayOffset(plan.weekStartISO)`
   (`src/engine/schedule.ts`) to find which `dayIndex` is actually today —
   that meal is the "Tonight" hero card, earlier days collapse under
   "Earlier this week", later days show "Tomorrow"/weekday names, and past
   the last day the screen shows a "Week complete!" state. Schedule shows
   every day's real calendar date the same way. Cooked toggles, shopping
   check-offs as before.
4. **Rate-as-you-go (M2.1):** any meal in the current week can be rated 1-5
   stars at any time — no gate on being marked cooked. `PlannedMeal.rating`/
   `ratedAtISO` (both optional, so old persisted plans load unchanged) hold
   the rating; a tappable star row on the meal detail screen
   (`app/meal/[id].tsx`) sets/edits it instantly via `planStore.rateMeal()`,
   and it's always visible on the meal cards on This Week and Schedule
   (`MealCard`'s `rating`/`onRate` props — unrated meals show a subtle
   empty-star affordance). `rateMeal()` also calls
   `learningStore.rateRecipe()`, which upserts the corresponding
   `RatingEvent` by `(planId, recipeId)` and **recomputes the entire
   `PreferenceProfile` from scratch** — `applyRatings(createDefaultPreferences(),
   ratings, recipesById)` folded over the *whole* rating history, every
   time — rather than incrementally adding one event onto the existing
   profile. That makes editing a rating (or re-rating) structurally
   incapable of double-counting: there's no running total to skew, only a
   fresh fold of corrected history. The old `plan.reviewedAtISO` double-count
   guard (M1.3) is gone; whether a week is fully rated is now computed
   directly from the meals (`allMealsRated()` in `src/engine/rating.ts`).
   The end-of-week wizard (`review/index`) is now an optional catch-up: it
   walks only `unratedMeals()` (richer signals — cookAgain/familyAgain/
   too-spicy-etc — feed the same `rateMeal()` path) and shows a read-only
   recap instead of a wizard once every meal already has a rating; the home
   card shows "Week rated ✓" the moment that's true, no separate flag
   needed.
5. **Sync (optional)**: `{plan, shoppingList}` synced against the household
   row. **M1.6:** no longer whole-payload last-write-wins. `src/engine/syncMerge.ts`
   (pure, commutative, idempotent) merges per-item `checked`/`checkedAtISO`,
   per-meal `cooked`/`cookedAtISO`, and (M2.1) per-meal `rating`/`ratedAtISO`
   — whichever device toggled/rated an item or meal more recently wins just
   that item/meal, not the whole list/plan; a missing timestamp (legacy
   data) is never treated as newer than a real one, and equal timestamps
   resolve to true/checked (or a deterministic tie-break for ratings, since
   there's no "true" to prefer) so a toggle or rating is never silently
   lost. If the two sides are looking at different plan ids, the plan with
   the newer `createdAtISO` wins outright (a freshly generated week can't be
   raced away by a stale poll). `syncStore.pull()` only pushes the merged
   result back when it actually adds something the server doesn't have yet
   (compared via a stable, sorted-key stringify — never raw
   `JSON.stringify` — to avoid ping-ponging). Profile, pantry, and learning
   stay per-device (still out of scope). Verified in
   `scripts/checkSyncMerge.ts` (run via
   `npx tsx --tsconfig ./tsconfig.json scripts/checkSyncMerge.ts`, 11
   assertions including two M2.1 rating-merge cases); those assertions
   should migrate into the real test suite once a runner exists (M2.5).

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
   allergen arrays. ~~Fix: ... a "curated-only when allergies present" guard
   for imports.~~ **Partially fixed (M1.5):** `passesHardFilters` now rejects
   any `estimated: true` (imported) recipe whenever `profile.allergies.length
   > 0` — generate/regenerate/swap all funnel through this one function, so
   imports are excluded from all three at once; with no allergies set,
   imports still appear normally. The detail screen shows "Imported recipe —
   allergen info estimated, check labels." on every imported recipe
   regardless of profile. Still open: the `'Tree Nuts'`/`'TreeNuts'` mismatch
   in curated seed data, and a canonical allergen list + CI seed-validation
   script. Same caution still applies to inferred diet tags (halal/vegan).
2. ~~Kosher filter no-op~~ — **Removed (2026-07-02):** per Ronnie, dropped
   "Kosher" as a dietary-restriction option entirely rather than fixing the
   logic (`(tags.includes('kosher') || true)` in `filters.ts` was a no-op
   beyond the pork/shellfish check, and no recipe in the library — curated
   or imported — ever carried a genuine `'kosher'` dietTag, so a correct
   filter would have had nothing reliable to check against anyway). Removed
   from `COMMON_DIETS` and the `satisfiesDiet` switch; any old saved profile
   still carrying "Kosher" harmlessly falls through to `default: return
   true` — same practical behavior as before, just no longer pretending to
   filter on it.
3. ~~"Plan a new week" destroys the current week before approval.~~ **Fixed
   (M1.8):** `planStore` now has a separate `draftPlan` slot
   (`LocalDraftPlanRepository`, kvStore key `wm:draftPlan:v1`). `generate()`/
   `regenerate()`/`toggleLock()`/`swapMeal()` all operate on `draftPlan`;
   `plan` (the active/approved week, with cooked progress) is only ever
   replaced by `approve()`. Closing the review screen without approving
   calls `discardDraft()` instead of leaving a half-finished plan sitting in
   the active slot. Old persisted unapproved drafts migrate into `draftPlan`
   on next load (`init()`) so existing saved data still loads correctly.
4. ~~Shared shopping list loses updates.~~ **Fixed (M1.6):** per-item/per-meal
   merge in `src/engine/syncMerge.ts` replaces whole-payload last-write-wins;
   see §5 above for details.

**P1**
5. ~~"Tonight" never advances~~ — **fixed (M1.4)**: `weekStartISO` is now
   normalized to local midnight of the generation day (`localMidnight()` in
   `src/engine/schedule.ts`); home and schedule compute today's real offset
   (`todayOffset()`) instead of hardcoding `dayIndex 0`. Past days collapse
   under "Earlier this week", future days show "Tomorrow"/weekday names
   (`dayLabel()`), and a plan past its last day shows a "Week complete!" state.
6. ~~Two disagreeing cost numbers~~ — **fixed (M1.2)**: review and home now
   call `usePlanStore().previewShoppingList(plan)` (a thin wrapper around
   `buildShoppingList()`), so every screen shows the same H-E-B-priced total;
   `roughCostPerServing()` is scoped to engine scoring only.
7. ~~Dead intake questions~~ — **Removed (M1.8)**: `desiredLeftovers` and
   `specialOccasions` were asked every Sunday and never read (no leftover-day
   logic ever existed — `isLeftoverDay` was never set). Both questions,
   their `IntakeAnswers` fields, and the `SPECIAL_OCCASIONS` constant are
   gone. Real leftovers-aware planning (if wanted) is a Milestone 2+ feature
   design, not a revival of these fields.
8. **Half-connected learning** — `spiceTolerance`, `complexityPreference`,
   `budgetSensitivity`, `leftoverTolerance`, `vegetableAffinity` are learned
   but never used in scoring (wiring these into scoring is M2.6); profile
   `spiceLevel`/`equipment`/`cookingSkill` also unused. ~~Weekly review can be
   submitted repeatedly for the same plan (double-counts).~~ **Fixed (M1.3)**
   via a `plan.reviewedAtISO` guard, **superseded (M2.1)**: ratings are now
   set per-meal at any time and the whole `PreferenceProfile` is recomputed
   from scratch on every rate/edit (see §5.4), so double-counting can't
   happen regardless of how many times a meal is re-rated — `reviewedAtISO`
   is gone. ~~Blocked recipes have no unblock UI.~~ **Fixed (M1.8)**: Profile screen
   shows a "Blocked recipes" card (only when non-empty) listing each blocked
   recipe by name with an "Unblock" action, wired to a new
   `learningStore.unblockRecipe(recipeId)`.
9. **No cross-week memory** — engine has no plan history, so top-scored weeks
   repeat. Needs a recency penalty over the last 2–3 weeks.
10. ~~Theme preference resets every launch~~ — **fixed (M1.1)**: persisted via
    `SettingsRepository` / `LocalSettingsRepository` (`kvStore` key
    `wm:settings:v1`), hydrated on app start from `app/_layout.tsx`.
11. **Zero tests** despite a deliberately pure engine; `docs/ARCHITECTURE.md`
    references `__tests__/`, `schedule.ts`, `units.ts`, `reviewStore`,
    `RatingRepository` — none exist. Docs are aspirational.

**P2**
12. ~~Duplicate `shuffle()` + inline re-implementation of engine selection in
    `planStore.swapMeal`.~~ **Fixed (M1.7):** `shuffle()` now lives only in
    `LocalRecommendationEngine.ts`; `swapMeal` delegates to a new exported
    `selectReplacement(candidates, ctx, selected)` helper instead of
    re-implementing the shuffle-then-best-score loop inline. `generate()`'s
    own loop is untouched (behavior-preserving).
13. Imported-recipe quality dilutes picks: cuisine mapping lumps British/Irish/
    Russian/Kenyan → "American", Vietnamese/Filipino/Malaysian → "Thai"; all
    imports claim 4 servings / ~15+30 min; nutrition is formula-guessed; odd
    units ("1 piece" salt cod). No scoring distinction curated vs estimated.
14. ~~`joinHousehold` with a short code silently no-ops (button appears dead);
    create doesn't check code collisions.~~ **Partially fixed (M1.7):**
    joining a code with no matching household row no longer silently creates
    one from local data — `joinHousehold` now returns `'not_found'` and
    `app/household.tsx` shows "No household found with that code — create a
    new one?" before calling the new explicit `createHouseholdWithCode`.
    Still open: `createHousehold` (random code path) doesn't check for
    collisions.
15. Sync security is honor-system: 6-char code is the only secret; **verify
    Supabase RLS on `households`** restricts anon select/upsert to a supplied
    code (key is public in the bundle). Data is low-sensitivity but dietary
    restrictions are health-adjacent.
16. ~~`recipesById` built with spread-inside-reduce (O(n²) over 541 recipes at
    startup) — replace with a plain loop.~~ **Fixed (M1.7):** plain
    `for`-loop assignment in `src/data/seed/recipes.ts`.
17. A11y gaps: chips/star rating lack accessibilityRole/state.

## 8. Roadmap (agreed direction — no code changes without owner approval on scope)

- **Milestone 1 — Trust & safety: done.** P0-1 allergen imports-guard (M1.5,
  seed validator/canonical-list + Tree Nuts mismatch still open, see §7 #1) ·
  P0-3 draft-plan protection (M1.8) · dead questions removed (M1.8) · real
  dates + correct "Tonight" (M1.4) · single cost source (M1.2) · persist theme
  (M1.1) · one-review-per-plan guard (M1.3) · sync per-item merge (M1.6) ·
  unblock UI (M1.8) · small correctness cleanups (M1.7) · Kosher option
  removed rather than fixed (2026-07-02, see §7 #2).
- **Milestone 2 — Finish what's started (in progress, see `MILESTONE-2.md`):**
  rate-as-you-go (M2.1, done — see §5.4) · mid-week re-roll from pantry +
  this week's shopping list (M2.2) · "same as last week" fast intake (M2.3) ·
  curated-first scoring weight (M2.4) · engine test suite (M2.5) · wire
  learned dials into scoring (M2.6).
- Later: day-aware planning/reorder · recipe browser + manual picks ·
  leftovers-aware planning (new design — the original `desiredLeftovers`/
  `specialOccasions` fields this was scoped around were removed in M1.8) ·
  pantry auto-deduction after shopping · sync pantry/profile/learning ·
  notifications · other stores.
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
