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
- **jest-expo (M2.5)** — `npm test` runs the engine test suite
  (`src/engine/**/*.test.ts`); screens/stores have no coverage yet.

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
app/(tabs)/          index (This Week) · recipes (search/browse, M3.1, see §5.8) ·
                     schedule · shopping (department-grouped list + manual
                     items, no longer gated on an approved plan, M3.3, see
                     §5.10) · profile  + custom tab bar
app/plan/            12-step Sunday intake wizard (M2.3: skipped by a 2-button
                     choice screen + 3-step fast path when a previous week's
                     intake exists) → review.tsx (lock/swap/regenerate/approve/
                     "Swap in a favorite", M3.1; approve syncs before clearing
                     checked manual items, M3.3, see §5.10)
app/review/          Optional catch-up wizard for unrated meals (M2.1) — see §5.4
app/reroll/[dayIndex].tsx  Mid-week re-roll modal (M2.2) — see §5.6
app/pin/[recipeId].tsx     Pin-to-week day picker (M3.1) — see §5.8
app/cook/[dayIndex].tsx    Full-screen guided cook mode (M3.4) — see §5.11
app/meal/[id].tsx    Recipe detail (+ "Pin to this week", M3.1; "Start cooking",
                     M3.4; edit/delete pencil + "saved on this device" note for
                     user- recipes, M3.5) · app/household.tsx sync setup ·
                     app/settings.tsx theme
app/recipe/new.tsx, app/recipe/edit/[id].tsx  Add/edit a family recipe (M3.5,
                     modal-presented) — share `RecipeForm` (src/ui/components)
src/domain/          models (Recipe, Profile, IntakeAnswers, WeeklyPlan, ShoppingList,
                     RatingEvent, PreferenceProfile) + constants (13 cuisines incl. `Other`
                     since 2026-07-04, see §7 #18, H-E-B dept order, chips)
src/engine/          recommendation/ (filters.ts hard filters, incl. passesAllergySafety extracted
                     for pin-to-week (M3.1) · scoring.ts 15 weighted factors incl.
                     a flat curated-recipe bonus (M2.4, tuned via scripts/checkCuratedWeighting.ts),
                     a flat kid-approved bonus (M3.2, tuned via scripts/checkKidApprovedWeighting.ts),
                     and learnedDialsFit (M2.6: spice/complexity/budget/leftover/vegetableAffinity
                     dials from ratings, small capped weight so they nudge but never override the
                     explicit profile) · WEIGHTS in types.ts · LocalRecommendationEngine.ts greedy picker,
                     random pick among near-equally-scored recipes rather than always the single top
                     scorer (`pickNearBest`, see §7 #19) · shoppingList.ts · cost.ts (rough heuristic, scoring-only) ·
                     learning.ts (pure fold, RatingEvents -> PreferenceProfile) ·
                     rating.ts (isMealRated/unratedMeals/allMealsRated, M2.1) ·
                     reroll.ts (rerollCandidates, strict-mode candidate selection, M2.2;
                     pinnableDays, M3.1) · season.ts · recipeSearch.ts (search/autocomplete/
                     filter over the 586-recipe library, client-side, M3.1) ·
                     manualItems.ts (normalizeItemName, department-guess map, M3.3) ·
                     cookMode.ts (parseDurationMinutes: single/range, minutes/hours,
                     upper-bound-of-range, M3.4) ·
                     userRecipes.ts (buildUserRecipe + validation/allergen/diet-tag/
                     nutrition/difficulty inference for family recipes, M3.5, see §5.12) ·
                     schedule.ts (local-date math: todayOffset/dayLabel) · syncMerge.ts (pure,
                     commutative/idempotent household-sync merge, M1.6; per-meal rating merge
                     M2.1; mergeTimestampedFlagMap for favorites, M3.1; mergeManualItems, M3.3)
src/data/seed/       recipes.ts assembles batch1..8 (230 hand-authored) + recipeImported.ts
                     (356 TheMealDB imports, GENERATED — never hand-edit; re-run
                     scripts/importRecipes.ts via normalize.ts). 586 recipes total (see
                     §7 #18 for the 2026-07-04 cuisine-taxonomy fix that changed this
                     count from 541/311).
                     All 230 curated recipes passed a cookbook-quality content pass
                     (M2.2b, July 2026): every recipe has a complete ingredient list
                     (nothing referenced in steps is missing, pantryStaple: true on
                     salt/pepper/oil/butter-type items so the shopping list doesn't
                     bloat), 5-10 concrete steps with pan/heat/time/doneness detail,
                     and the two new optional Recipe fields `description` (1-2
                     sentences, shown on the meal detail screen) and `tips` (0-3
                     practical notes). Enforced by scripts/validateRecipes.ts (run via
                     `npx tsx --tsconfig ./tsconfig.json scripts/validateRecipes.ts`),
                     which fails loudly listing any curated recipe missing these bars.
                     The 356 mealdb- imports are intentionally out of scope — their
                     source text is their fidelity anchor.
src/data/grocery/heb HebProvider: curated price table, per-lb conversion (g/ml/kg/l), dept fallbacks
src/data/repositories/local  kvStore (AsyncStorage JSON) + one repo per aggregate
src/data/sync/       config.ts (URL/key/SYNC_ENABLED kill-switch) · householdApi.ts (get/upsert row by 6-char code)
src/stores/          planStore (orchestrator; pinRecipeToWeek/pinRecipeToDraft/
                     addMissingIngredients, M3.1; approve() clears checked manual
                     items, M3.3) · profileStore · pantryStore ·
                     learningStore (favoritesMap/kidApprovedMap household-synced as of
                     M3.1/M3.2, see §5.8-9) · manualItemsStore (ManualItemMap
                     household-synced, keyed by normalized name, M3.3, see §5.10) ·
                     cookModeStore (per-device only, NOT synced — current step per
                     plan+day, M3.4, see §5.11) ·
                     userRecipesStore (per-device only, NOT synced — family recipes,
                     M3.5, see §5.12; also exports non-hook `getAnyRecipe`/
                     `allRecipesList`/`allRecipesById` for other stores and reactive
                     `useRecipesById`/`useAllRecipes` hooks for screens, both merging
                     the 586-recipe seed library with this store's recipes) ·
                     settingsStore (persisted, wm:settings:v1) · syncStore (poll 20s, debounced push 600ms,
                     per-item/per-meal merge via src/engine/syncMerge.ts as of M1.6)
src/data/images.ts / recipeImages.ts   curated photo URLs (110/230 curated recipes as of
                     M3.0b) with per-cuisine emoji-tile fallback for the rest; per-photo
                     source/license/attribution recorded, credited on the meal detail
                     screen where the license requires it (see §5.7)
```

## 5. Key data flow (the weekly loop)

1. **Sunday intake** (`plan/index`): 12-step wizard pre-filled from Profile
   (or, once a previous week exists, from that week's actual answers) →
   `setIntake()` → `generate()` → draft `WeeklyPlan` persisted. ⚠️ `generate()`
   currently **replaces the live approved plan immediately** (see bug P0-3).
   **M2.3 fast intake:** if `plan.intake` from a previously-approved week
   exists, the screen opens with a recap card ("Last week: 5 dinners for 4,
   ~$150, 15+30 min prep+cook.") and two buttons — "Same as last week" runs
   only 3 of the 12 steps (dinners, proteins, ingredients-on-hand, reusing
   the exact same step definitions as the full wizard) then generates
   immediately (4 taps total, open to draft); "Adjust everything" runs the
   full 12-step wizard pre-filled with last week's real answers rather than
   Profile defaults. First-ever run (no previous plan) skips the choice
   screen and opens straight into the full wizard. Picking which mode/prefill
   to start with can't happen in a `useState` initializer — that runs before
   `planStore` finishes hydrating from storage and would randomly lock onto
   "no previous intake" depending on load timing — so it's decided once in a
   `hydrated`-gated effect, same pattern as the loading gates already used on
   This Week/Schedule.
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
5. **Sync (optional)**: `{plan, shoppingList, favorites}` synced against the
   household row (`favorites` added M3.1, see §5.8). **M1.6:** no longer
   whole-payload last-write-wins. `src/engine/syncMerge.ts`
   (pure, commutative, idempotent) merges per-item `checked`/`checkedAtISO`
   and, per meal, either `cooked`/`cookedAtISO` + (M2.1) `rating`/`ratedAtISO`
   independently — if both sides agree on that meal's `recipeId` — or, if
   they disagree (M2.2: one side re-rolled that day to a different dish),
   the whole meal body atomically, keyed on `recipeChangedAtISO`. That
   split matters: two devices can legitimately toggle `checked`/`cooked`/
   `rating` on the *same* dish independently and it's correct to merge those
   fields piecewise, but a `rating` or `cooked` flag describing a dish that
   got re-rolled away must never survive onto whatever replaced it — see bug
   fix below. Whichever side changed a field more recently wins it; a
   missing timestamp (legacy data) is never treated as newer than a real
   one, and equal timestamps resolve to true/checked (or a deterministic
   tie-break otherwise, since there's no "true" to prefer) so a toggle,
   rating, or re-roll is never silently lost. If the two sides are looking
   at different plan ids, the plan with the newer `createdAtISO` wins
   outright (a freshly generated week can't be raced away by a stale poll).
   `syncStore.pull()` only pushes the merged result back when it actually
   adds something the server doesn't have yet (compared via a stable,
   sorted-key stringify — never raw `JSON.stringify` — to avoid
   ping-ponging). Profile, pantry, and the rest of learning (preferences,
   ratings) stay per-device (still out of scope); favorites is the one
   exception as of M3.1 (see §5.8). Verified by `src/engine/syncMerge.test.ts` (run via
   `npm test`, 15 assertions including two M2.1 rating-merge cases and four
   M2.2 diverged-recipe cases) — migrated from the standalone
   `scripts/checkSyncMerge.ts` once M2.5 set up a real test runner.
6. **Mid-week re-roll (M2.2), STRICT mode:** every not-yet-cooked meal for
   today or a future day gets a "↻ Re-roll" link on its This Week card,
   opening `/reroll/[dayIndex]`. `rerollCandidates()` (`src/engine/reroll.ts`,
   pure) only offers recipes whose every non-staple ingredient is covered by
   pantry + this week's shopping list (assumed purchased) + the outgoing
   meal's own ingredients — a re-roll can never imply a store trip, and the
   outgoing recipe itself is excluded from its own candidate pool (swapping a
   meal for itself isn't a re-roll). Coverage matching (**M3.0**) is exact
   normalized-name match first, substring match only as a fallback, and only
   in the safe direction — an available name must be as long as or longer
   than the required name to satisfy it (having "cream" no longer wrongly
   satisfies a recipe that needs "coconut cream"). Candidates are ranked by the existing
   scoring function; the screen offers the top pick with "Try another"
   (cycles up to 5). If nothing fully qualifies, up to 3 near-misses are
   shown instead, each labeled with exactly what's missing ("you'll need: X,
   Y") — picking one is allowed but never edits the shopping list.
   `planStore.rerollMeal()` only ever replaces that one meal's `recipeId`
   (clearing any `cooked`/`rating` on that day, since it's now a different
   recipe) and never touches the shopping list. It also stamps a new
   `recipeChangedAtISO` on that meal — **bug fixed post-M2.2:** the initial
   version changed `recipeId` without any way for sync to know the meal's
   *identity* had changed, so `mergePlanMeals` kept treating it as ordinary
   progress on the same dish and could merge a stale rating/cooked-flag for
   the *outgoing* recipe onto the *new* one (e.g. device B rates the
   original dish, then device A re-rolls it — B's rating must not survive
   onto A's replacement). `recipeChangedAtISO` gives the merge a signal to
   pick one side's meal body atomically whenever `recipeId` diverges,
   instead of merging fields piecewise (see §5.5).
7. **Recipe photos (M3.0b):** `RECIPE_IMAGE_URLS` (`src/data/recipeImages.ts`)
   maps recipe id → photo URL; `imageForRecipe()` (`src/data/images.ts`) falls
   back to the per-cuisine emoji tile for anything unmapped, so the map can
   stay partial forever without looking broken. Stage 1 was hand-matched
   TheMealDB artwork (30 recipes); Stage 2 (`scripts/importPhotos.ts`) added
   80 more by matching TheMealDB first, then Wikimedia Commons via the
   Openverse API, filtered to licenses that only require attribution (CC0,
   Public Domain, CC BY/BY-SA/BY-ND — never NC) — 110/230 curated recipes
   have a real photo now, the rest keep the tile. A candidate is only
   proposed on an exact or near-exact dish-name match, plus a protein-keyword
   sanity check (if the recipe's own name says "chicken"/"lamb"/etc., the
   matched photo's name/ingredients must mention it too) to catch the
   same-family-wrong-protein trap a hand-matched Stage 1 batch had to dodge
   manually. Wikimedia entries carry per-photo license/attribution metadata
   in `RECIPE_IMAGE_ATTRIBUTION`, rendered as a small credit line under the
   photo on the meal detail screen (`app/meal/[id].tsx`) since their license
   requires it; TheMealDB photos rely on the existing blanket note in
   Settings. Per Ronnie (2026-07-03): matches were wired in directly rather
   than gated on a text-based pre-review, since photo URLs aren't practical
   to eyeball from a markdown list — he reviews them live in the app and
   flags any bad ones for removal.
8. **Recipe browser, favorites, and pin-to-week (M3.1):** a 5th tab,
   **Recipes**, searches all 586 recipes client-side (`src/engine/
   recipeSearch.ts`: name/cuisine/protein/ingredient match, ranked, plus
   autocomplete suggestions) with filter chips (cuisine, protein,
   difficulty, max time, categories, curated-only). The tab opens with a
   **Favorites** section up top (still respecting active filters); typing a
   search or picking a filter collapses that into one ranked results list —
   Favorites is a starting view, not a separate mode. Favorites are now
   **household-synced**, not per-device: `learningStore`'s `favoritesMap`
   (recipeId → `{flag, atISO}`) is part of the sync payload, merged by
   `mergeTimestampedFlagMap()` (same newer-wins/tie-true pattern as
   `checked`/`cooked`, reused by M3.2's `kidApproved`); a device's old
   plain-array favorites migrate into the map once, locally, the first time
   `learningStore` loads after this change (`migrateFavoritesToMap()` in
   `src/engine/learning.ts`) — by the time that device first syncs, its
   migrated favorites are already in the payload.

   **Pin to this week**, from a result card's quick-pin icon or the detail
   screen, opens `app/pin/[recipeId].tsx`: a day picker restricted to
   today-or-future, not-yet-cooked days (`pinnableDays()` in
   `src/engine/reroll.ts`, same rule the re-roll link uses), refusing to
   offer a day at all if the recipe is already elsewhere in the week
   (mirrors reroll's duplicate exclusion). Committing a pin onto the
   approved plan calls `planStore.rerollMeal()` **verbatim** — identical
   `recipeChangedAtISO` stamp, cooked/rating clear, and sync behavior to a
   mid-week re-roll — so pinning and re-rolling are indistinguishable to
   every other part of the app once committed; pinning into a draft
   (`pinRecipeToDraft`, reachable via the review screen's **"Swap in a
   favorite"** button) is the analogous operation on `draftPlan`. Every pin
   entry point (quick-pin, detail screen, draft) re-checks two things itself
   before committing, never just trusting the screen that offered the
   action: **(a) allergy safety** — `passesAllergySafety()`
   (`src/engine/recommendation/filters.ts`, extracted out of
   `passesHardFilters` so pinning can bypass *soft* mismatches like
   dislikes/time/diet on an explicit user choice, but never allergy safety)
   blocks a recipe whose allergens match a set allergy, or (with any allergy
   set) an imported/estimated recipe, with a plain explanation; **(b) day
   validity** per `pinnableDays()`. If the pinned recipe needs ingredients
   beyond pantry + this week's list, the day picker shows "You'll need: X,
   Y" with the pin committing either way — adding those ingredients to the
   shopping list is a **separate, explicit** button
   (`addIngredientsToShoppingList()` in `src/engine/shoppingList.ts`, the
   only way the list is ever edited outside a full rebuild), never
   automatic. **Explicit decision:** if that same day is later re-rolled or
   re-pinned again, ingredients added by an earlier pin are **not** removed
   — silently deleting them would violate "never silently edit the shopping
   list" exactly as much as silently adding them would have.
9. **Kids-approved flag (M3.2):** a per-recipe "Kids approved 😊" toggle,
   separate from the existing family star rating (no per-person ratings —
   Ronnie decided one family rating plus this one flag is enough). Reuses
   M3.1's favorites machinery wholesale rather than inventing anything new:
   `learningStore.kidApprovedMap` is the same `TimestampedFlagMap` shape as
   `favoritesMap`, merged by the same generic `mergeTimestampedFlagMap()`,
   synced the same way (part of the household sync payload, migrated
   nowhere since it's a new field with no legacy shape to read). Toggleable
   from the meal detail screen (a smiley icon next to the favorite heart,
   plus a "😊 Kids approved" line under the title), every meal card (This
   Week, Schedule, the draft review screen) via a small icon next to the
   dish name, and the Recipes tab's result cards — all single-tap, same
   gesture as favoriting. The Recipes tab also gained a "Kid-approved"
   filter chip. Recommendation scoring gets a new flat `WEIGHTS.kidApproved
   = 0.15` bonus (`kidApprovedBonus()` in `scoring.ts`, same pattern as the
   M2.4 curated bonus and same structural guarantee as M2.6/M3.0's learned
   dials: kept well below `preference`/`affinity` so it nudges, never
   overrides). Tuned via `scripts/checkKidApprovedWeighting.ts` (mirrors
   `checkCuratedWeighting.ts`): marking ~30 recipes kid-approved and
   generating 10 varied weeks shows a ~2x pick-rate lift over their base
   rate in the pool, with every week still including non-approved picks.
10. **Manual grocery items (M3.3):** a new `manualItemsStore` holds
    hand-added items ("milk", "dish soap") that are **not plan-scoped** —
    they live independently of any week's plan, so the Shopping tab no
    longer needs an approved plan to show anything. `ManualItemMap` is keyed
    by **normalized name** (trimmed/lowercased), not a generated id — that's
    what lets two devices independently add "milk" and converge to one row
    instead of duplicating it. Renaming an item is therefore a tombstone of
    the old key plus a fresh entry under the new one
    (`manualItemsStore.edit`), never an in-place name change. Paper-list
    default: `quantityLabel` is optional free text ("2 lbs"), not a forced
    "1" with a structured unit. `checked` and `deleted` (soft-delete, never a
    hard removal) are each resolved independently by the same
    newer-timestamp-wins `resolveFlag` used for `checked`/`cooked`
    elsewhere (`mergeManualItems()` in `syncMerge.ts`) — deliberately never
    special-cased against each other, so a delete-vs-check race and a
    delete-then-re-add (a newer add always beats an older tombstone) both
    converge regardless of which device merges first (explicit
    `syncMerge.test.ts` cases for both). Department is auto-guessed from
    `INGREDIENT_DEPARTMENT_MAP` (`src/data/ingredientSuggestions.ts`, built
    from the most common department each ingredient name appears under
    across the recipe library — `buildDepartmentGuessMap()` in
    `src/engine/manualItems.ts`), falling back to Dry Goods, and is editable
    per item via a chip picker. Synced exactly like favorites/kidApproved
    (part of the household payload, its own polling subscription in
    `syncStore.ts`). The Shopping tab renders manual items merged into the
    same department-grouped list as plan-derived items — same checkbox, same
    row style — with a pencil icon (manual items only) opening an inline
    edit/delete. Lifecycle: `planStore.approve()` clears (soft-deletes)
    whatever's checked when a new week is approved; unchecked items carry
    over untouched since they were never plan-scoped. That clear must act on
    the **merged** checked-state, not a possibly-stale local one — so
    `app/plan/review.tsx`'s approve handler calls `syncStore.syncNow()`
    (reconcile with the household partner) immediately before calling
    `approve()`, not after. Manual item rows also support swipe-left-to-
    reveal-delete (react-native-gesture-handler's `Swipeable`, already a
    dependency), alongside the pencil-icon edit sheet.
11. **Cook mode (M3.4):** "🍳 Start cooking" on a planned meal's detail
    screen opens `app/cook/[dayIndex].tsx` — a full-screen, one-step-at-a-
    time view (large type, tap-anywhere-to-advance plus explicit Back/Next
    links, a progress bar). Screen wake lock keeps the screen on for as long
    as the screen is mounted — direct `activateKeepAwakeAsync`/
    `deactivateKeepAwake` calls (`expo-keep-awake`) rather than the bare
    `useKeepAwake()` hook, because on web the browser's Screen Wake Lock API
    auto-releases the lock on tab-switch/dim and the hook never re-acquires
    it; a `visibilitychange` listener re-requests the lock whenever the tab
    becomes visible again (**fixed, debug-sweep P2-1, 2026-07-09** — before
    this, the screen only stayed awake until the first interruption). On
    older iOS Safari (pre-16.4, no Wake Lock API at all) the request
    silently fails and the screen behaves as it always did — no in-app
    warning, same silent-fallback posture as the timer note below. If a step
    mentions a duration, `parseDurationMinutes()`
    (`src/engine/cookMode.ts`) detects it — single values or ranges, minutes
    or hours, taking the upper bound of a range — and offers a tappable
    timer chip; the timer is screen-level state (not tied to the current
    step), so starting one and moving on keeps it counting down, ending in
    a vibration (where supported) plus an always-visible "Time's up!"
    banner rather than a push notification. A quick-access ingredients
    sheet is a plain conditional overlay `View`, not React Native's core
    `Modal` — `Modal` on web was found to leave something intercepting
    touches even after being dismissed, blocking further step navigation,
    so this follows the same overlay pattern used everywhere else in the
    app instead. The final step reuses `planStore.toggleCooked`/`rateMeal`
    verbatim, so marking cooked and rating behave identically to the detail
    screen. The current step is remembered per (plan id, day index) in a
    new `cookModeStore`, **deliberately per-device and not household-
    synced** — cooking is a real-time, one-person activity, unlike
    checked/cooked/rating state.
12. **Family recipes (M3.5):** an "Add" button on the Recipes tab header opens
    `app/recipe/new.tsx` — a form (`src/ui/components/RecipeForm.tsx`, shared
    with `app/recipe/edit/[id].tsx`) collecting name, cuisine, main protein,
    servings, prep/cook minutes, ingredient rows (name/quantity/unit/
    department, department auto-guessed via the same
    `guessDepartment`/`INGREDIENT_DEPARTMENT_MAP` M3.3 already built), and
    reorderable step rows, plus optional description/tips. The form enforces
    the milestone's minimums (≥1 ingredient, ≥3 steps) via
    `validateUserRecipeInput` (`src/engine/userRecipes.ts`). Saved recipes get
    an id prefixed `user-` and live in a new `userRecipesStore`
    (`LocalUserRecipesRepository`, `wm:userRecipes:v1`) — **deliberately
    per-device, like profile, not household-synced**, with a "🏠 saved on this
    device only" note on the detail screen and result cards.

    A family recipe is a full participant everywhere a curated recipe is:
    `userRecipesStore` exports plain accessors `getAnyRecipe`/`allRecipesList`/
    `allRecipesById` (seed library merged with the store's recipes, read via
    `.getState()` — the same pattern `planStore`/`learningStore` already use
    for every other cross-store read) that replaced the direct
    `getRecipe`/`RECIPES`/`recipesById` seed imports inside `planStore.ts` and
    `learningStore.ts`, so generation, swap, re-roll, pinning, and rating all
    see family recipes automatically. Screens instead use the reactive
    `useRecipesById`/`useAllRecipes` hooks (so an edit/delete shows up
    immediately without a reload) in the Recipes tab, meal detail, pin,
    re-roll, cook mode, the end-of-week review recap, and the Profile
    "blocked recipes" list. `favoritesMap`/`kidApprovedMap` needed no changes
    at all — they're just `Record<recipeId, {flag, atISO}>`, agnostic to which
    store owns the underlying `Recipe`. `scripts/validateRecipes.ts` is
    unaffected (it only ever iterated the seed `RECIPES` array, never a merged
    pool), so user recipes are correctly outside its curated-quality gate.

    Safety-motivated additions beyond the form fields the milestone bullet
    list named: **allergens** are keyword-guessed from the ingredient list
    (`inferAllergensFromIngredients`, using the exact `COMMON_ALLERGENS`
    labels like `'Tree Nuts'` — a fresh implementation, not a copy of
    `normalize.ts`'s importer-side `inferAllergens`, specifically to avoid
    reintroducing its known `'TreeNuts'`/`'Tree Nuts'` mismatch (since fixed
    at the source in `inferAllergens` too, see §7 #1) and
    shown as **editable** chips on the form with a "re-check ingredients"
    button, since a family recipe fully bypasses the "imported recipes are
    excluded once any allergy is set" guard (`estimated` stays unset, so it's
    trusted like a curated recipe) — unlike an import, nothing else double-checks
    its allergen data, so getting the default right (and letting the user
    correct it) matters more here, not less. **Diet tags**
    (vegetarian/vegan/gluten-free/dairy-free) are inferred the same way
    (`inferDietTagsFromIngredients`, mirroring `normalize.ts`'s
    `inferDietTags`) so a homemade vegetarian/vegan dish correctly matches a
    week's dietary restriction. **Nutrition** and **difficulty** get a rough
    heuristic estimate from the ingredients/times
    (`estimateNutritionFromIngredients`/`difficultyFromMinutes`) rather than
    defaulting to zero — a carb-heavy dish defaulting to 0g carbs would have
    trivially (and wrongly) satisfied the "low-carb"/"keto" diet filters.
    `categories`/`vegetables`/`techniques`/`seasons` default to empty and
    `spiceLevel` to `'Mild'` — none of these are used by hard filters, only by
    optional browse filter chips or soft scoring nudges.

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
1. ~~Allergy filter is unreliable.~~ **Fixed (debug-sweep P0-1/P1-1,
   2026-07-09).** Two failure modes, both closed: (a) seed data mixed
   `'Tree Nuts'` and `'TreeNuts'` — the curated `fr-trout-amandine` and 8
   imported recipes carried the non-canonical `'TreeNuts'`, so a Tree Nuts
   allergy silently let them through. Fixed at the root: `normalize.ts`'s
   `inferAllergens` now emits the canonical `'Tree Nuts'` (recipeImported.ts
   regenerated), the one hand-authored offender was corrected, and
   `passesAllergySafety` in `filters.ts` now compares allergens/allergies
   through a `canonicalAllergen()` normalizer (strip spaces + lowercase) so
   this class of mismatch can't recur regardless of spelling/spacing. (b)
   `scripts/validateRecipes.ts` had no allergen checks at all — the safety
   net that would have caught (a). It now runs two checks: every recipe
   (curated + imported) must use only canonical `COMMON_ALLERGENS` labels,
   and curated recipes must declare every allergen their ingredients imply
   (reuses `inferAllergens` as a keyword-coverage check). Running it the
   first time surfaced real gaps — 13 curated recipes with an undeclared
   allergen from a present ingredient (parmesan/yogurt→Dairy, fish
   sauce→Fish, tofu/soy sauce→Soy, flour/soy sauce→Gluten) — now fixed, plus
   two `inferAllergens` false-positive fixes surfaced along the way
   (`'coconut milk'`/`'peanut butter'`/`'butter beans'` were tripping the
   Dairy check, `'eggplant'` was tripping the Eggs check, `'rice noodles'`
   was tripping the Gluten check). `dietTags` on `fr-beef-bourguignon` and
   `gr-lamb-moussaka` also lost an incorrect `'gluten-free'` tag now that
   their required (non-optional) flour is correctly flagged. Imported
   recipes were left out of the keyword-coverage check (their `allergens`
   field *is* `inferAllergens`'s output already, so re-running it would only
   prove the generator agrees with itself) — they still rely on the M1.5
   guard for safety: `passesHardFilters` rejects any `estimated: true`
   (imported) recipe whenever `profile.allergies.length > 0`, so imports are
   excluded from generate/regenerate/swap alike whenever any allergy is set;
   with no allergies set, imports still appear normally, and the detail
   screen shows "Imported recipe — allergen info estimated, check labels."
   on every imported recipe regardless of profile. Same caution still
   applies to inferred diet tags (halal/vegan).
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
8. ~~**Half-connected learning** — `spiceTolerance`, `complexityPreference`,
   `budgetSensitivity`, `leftoverTolerance`, `vegetableAffinity` are learned
   but never used in scoring.~~ **Fixed (M2.6):** all five wired into scoring
   via `learnedDialsFit()` in `scoring.ts` (`WEIGHTS.learnedDials = 0.8`,
   below `preference`/`affinity` so it nudges, never overrides). Profile
   `spiceLevel`/`equipment`/`cookingSkill` still unused. ~~Weekly review can be
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
11. ~~Zero tests~~ — **fixed (M2.5, extended M2.6, M3.0, M3.1, M3.2, M3.3, M3.4, M3.5):**
    `jest-expo` installed as the sanctioned dev dependency; `npm test` runs the
    engine test suite (`src/engine/**/*.test.ts`, 169 assertions covering hard
    filters incl. the imported-allergy guard and M3.1's extracted
    `passesAllergySafety`, recommendation-engine invariants (incl. M2.6's
    learned-dials scoring and hard-filters-always-win case; M3.0's structural
    assertion that `WEIGHTS.learnedDials` stays below
    `WEIGHTS.preference`/`WEIGHTS.affinity`; and M3.2's equivalent assertion
    plus tie-break/hard-filter cases for `WEIGHTS.kidApproved`), shopping-list
    consolidation (incl. M3.1's `addIngredientsToShoppingList`), sync merge
    (incl. M3.1/M3.2's favorites/kidApproved map merges and M3.3's
    `mergeManualItems` — normalized-name identity, delete-vs-check race,
    tombstone-override, and rename cases), learning math (incl. M3.1's
    favorites migration), recipe search/filter/autocomplete (M3.1, extended
    M3.2 for `kidApprovedOnly`), M3.3's department-guessing
    (`buildDepartmentGuessMap`/`guessDepartment`), M3.4's duration parsing
    (`parseDurationMinutes`), M3.5's `userRecipes.ts` (validation, allergen/
    diet-tag/nutrition inference from ingredients, `buildUserRecipe`), and the
    M2.2/M3.0/M3.1 reroll candidate/pinnable-days functions). Screens
    still have zero coverage — out of scope per the milestone (`docs/ARCHITECTURE.md`'s
    references to `__tests__/`, `units.ts`, `reviewStore`, `RatingRepository`
    remain aspirational/stale).

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
    units ("1 piece" salt cod). ~~No scoring distinction curated vs
    estimated.~~ **Partially fixed (M2.4):** curated recipes now get a flat
    scoring bonus (`WEIGHTS.curated`) over imported ones; the cuisine-mapping/
    servings/nutrition/units issues themselves are unchanged.
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
18. ~~Cuisine mislabeling skewed swap/rotation toward "American," and swap
    only ever offered one pick~~ — **fixed (2026-07-04):** `normalize.ts`'s
    `AREA_TO_CUISINE` table was folding a dozen unrelated regions (British,
    Irish, Australian, Canadian, Dutch, Norwegian, Polish, Russian,
    Ukrainian, Slovak, Kenyan) plus an unconditional "anything unrecognized"
    fallback into `'American'` — making it the single largest cuisine
    bucket (66/541) and ~2/3 dishonestly labeled (spot-checked: Belgian
    Waterzooi Chicken, Bryndzové Halušky, Chilean Empanada, etc., all tagged
    American). Added a 13th `Cuisine` value, `'Other'`, for the genuinely
    unclassifiable regions (British/Irish/Australian/Canadian stay American
    — culturally close enough; Dutch/Norwegian/Polish/Russian/Ukrainian/
    Slovak/Kenyan and true unknowns now go to `Other`); regenerated
    `recipeImported.ts` (`npx tsx scripts/importRecipes.ts`) — verified
    zero existing recipe ids dropped (so no stale favorite/rating/pin
    references break), 30 relabeled, 45 new ones added into the
    newly-available `Other` bucket that were previously excluded by the
    per-cuisine import cap (311 → 356 imports, 541 → 586 total). Separately,
    the plan-review "Swap" action went from silently committing to the
    single highest-scoring candidate (`selectReplacement`) to offering a
    picker with up to 3 alternatives (`rankReplacements` in
    `LocalRecommendationEngine.ts`), diversified to at most one pick per
    cuisine first — otherwise, since American is still the single largest
    cuisine even after the relabeling, "3 alternatives" could still mean 3
    near-identical American dishes. `planStore.swapMeal` replaced by
    `swapCandidates`(pure query)/`swapMealTo`(commit); UI in
    `app/plan/review.tsx`. `npm run typecheck`, `npx jest` (151/151, +6
    new), `validateRecipes.ts` (230/230), and both tuning scripts
    (`checkCuratedWeighting.ts`/`checkKidApprovedWeighting.ts`) all green;
    browser-verified end-to-end (seeded a draft plan with Classic Beef
    Burgers, confirmed swap now offers 3 distinct-cuisine alternatives with
    zero American duplicates, committed one, re-opened swap again, and
    confirmed backdrop-tap cancel).
19. ~~Generating a fresh week (or tapping "regenerate unlocked") with a
    new/loosely-specified profile always produced the exact same week,
    every time~~ — **fixed (2026-07-04):** `scoreRecipe` blends ~14
    continuous-valued factors into one float, so two different recipes
    essentially never land on the exact same score — confirmed empirically
    (generated a fresh default-profile week 8 times, got byte-identical
    results every time; the top 15 candidates for the first pick all had
    distinct scores to 10 decimal places). `generate()`'s greedy loop always
    took the single highest scorer, so with no randomness anywhere in the
    scoring itself, there was nothing for the existing `shuffle()`
    tie-break to ever actually catch — it ran every time and never mattered.
    Fixed in `LocalRecommendationEngine.ts`: `pickNearBest()` now treats
    recipes within a small band of the best score (2% of the top score,
    floored at 0.05 so the band can't collapse near zero) as
    interchangeable, and picks uniformly at random among them — a
    genuinely clear best fit still always wins (verified: with one recipe
    scoring far ahead of a "mediocre" pool, it won 20/20 runs), but when
    several recipes are basically equally good, which one you get is now
    actually random from one generate/regenerate to the next. Verified with
    the real recipe library: 15 fresh-default-profile generations produced
    7 distinct day-1 picks and 15 distinct whole weeks (previously: 1 and
    1). Applies to both `generate()` and `regenerate()` (the latter calls
    the former) automatically. `rankReplacements` (swap picker, §7 #18) was
    left alone — its cuisine diversification already guarantees real
    variety across the 3 alternatives shown, independent of this issue.
    `npm run typecheck`, `npx jest` (153/153, +2 new — one asserting real
    variety across runs, one asserting a clear best fit still always wins),
    `validateRecipes.ts` (230/230), and both tuning scripts all green;
    browser-verified end-to-end (5 consecutive "regenerate unlocked" taps
    on a seeded draft, all 5 produced distinct weeks).
20. ~~Schedule tab overpromised: the empty state advertised "leftover days"
    (scheduled leftover-eating days — never built, see §7 #7) and a
    "meal-prep tip" that was really one hardcoded paragraph shown on every
    plan regardless of its recipes~~ — **fixed (debug-sweep P1-2,
    2026-07-09):** empty-state copy now only claims what the screen does
    (day-by-day dinners, with a heads-up on meals that make leftovers — the
    real, already-working leftovers count callout); the fake per-plan tip
    card is removed outright rather than gated, since there's no per-week
    signal yet to make it real. No leftover-day scheduling was built — still
    a Milestone 2+ feature design if wanted (§7 #7).
21. ~~Cook mode's keep-awake stopped working after the first interruption on
    web~~ — **fixed (debug-sweep P2-1, 2026-07-09):** `useKeepAwake()` only
    acquires the browser's Screen Wake Lock once on mount; the browser
    auto-releases it on tab-switch/dim, so the screen went back to sleeping
    normally for the rest of the cooking session after the first
    interruption — exactly the wet-hands moment cook mode exists to prevent.
    Fixed in `app/cook/[dayIndex].tsx`: switched to direct
    `activateKeepAwakeAsync`/`deactivateKeepAwake` calls plus a
    `visibilitychange` listener that re-requests the lock every time the tab
    becomes visible again. See §5 #11 for the older-iOS-Safari caveat (no
    Wake Lock API at all — silent no-op, same posture as the timer note).
22. ~~`weekStartISO` was a UTC instant, not a local date~~ — **fixed
    (debug-sweep P2-2, 2026-07-09):** M1.4 (§7 #5) normalized generation to
    local midnight, but still stored it via
    `localMidnight(new Date()).toISOString()` — a UTC instant that bakes in
    the *writer's* timezone offset. A household member's device in a
    different timezone re-derives the wrong calendar day from that instant
    (e.g. a plan generated at Tokyo local midnight serializes to
    `...T15:00:00.000Z`, which a device in Los Angeles reads back as the
    previous day), shifting "Tonight"/schedule offsets by a day. Latent on a
    single-device household (same timezone reads its own writes correctly)
    but real the moment the household syncs across timezones (travel).
    Fixed: `weekStartISO` is now a plain local `YYYY-MM-DD` string
    (`localDateString()` in `src/engine/schedule.ts`), which has no instant
    to misinterpret — `dateForDayIndex`/`todayOffset` parse it via local
    date components (`parseWeekStart()`), never `new Date(dateOnlyString)`
    (which the JS spec treats as UTC midnight, reintroducing the exact same
    bug). `parseWeekStart` still falls back to the old UTC-instant parsing
    for already-persisted plans, so existing plans keep working — no
    migration needed. Covered by `src/engine/schedule.test.ts`.
23. ~~`kvStore.getJSON` guarded against unparseable JSON but not valid-JSON-
    wrong-shape data~~ — **fixed (debug-sweep P2-3, 2026-07-09):** corrupt or
    partially-written storage that fails `JSON.parse` was already handled
    gracefully (treated as "no data"), but a value that parses fine yet has
    the wrong shape (e.g. a persisted plan missing `meals`) passed straight
    through to a screen that assumes the shape (`plan.meals.sort(...)` in
    the home tab and Schedule) and would throw, white-screening the tab. No
    migration or new storage format — `kvStore.getJSON<T>` now takes an
    optional `isValid: (value: unknown) => value is T` guard; when the
    parsed value fails it, `getJSON` returns `null` exactly like a parse
    failure, so `hydrated: true` still lands with `plan`/`shoppingList` at
    their normal "no data" default. Minimal structural checks (right-shaped
    presence of a few key fields, not full schema validation) live in the
    new `src/data/repositories/local/shapeGuards.ts`
    (`isWeeklyPlan`/`isShoppingList`), wired into
    `LocalPlanRepository`/`LocalDraftPlanRepository`/
    `LocalShoppingListRepository`'s `load()`. Other `kvStore` consumers
    (settings, pantry, manual items, etc.) are unchanged — out of scope for
    this pass.
24. ~~Some curated recipes' steps called for an ingredient not in the
    ingredient list~~ — **fixed (2026-07-09):** a step referencing an
    ingredient the shopper never bought (mirin, nutmeg, cornstarch, a
    tahini sauce's lemon, frying oil that was never listed, etc.) is a
    trust/usability bug — the shopping list silently under-buys. This is
    the mirror image of `validateRecipes.ts`'s existing ingredient→step
    check (every listed ingredient must appear in a step); there was no
    check the other way. A one-off scan (curated-ingredient vocabulary,
    reduced to each ingredient's head noun to avoid descriptor-word noise
    like "high" from "high heat cooking oil") flagged ~260 candidates
    across 141 recipes; the overwhelming majority were correct as-is
    (serving suggestions — "serve with pasta or rice"; explicitly optional
    add-ins — "cilantro if you have it"; verbs/doneness words matching an
    unrelated ingredient — "the salmon flakes" vs. red pepper flakes;
    synonyms for an already-listed ingredient — "the cheese" for
    already-listed mozzarella; self-referential technique nouns — "the
    dressing" made from already-listed oil+vinegar). 20 recipes had a
    genuine miss and were fixed by adding the missing ingredient(s):
    `cn-hot-sour-soup` (cornstarch, white pepper, green onions),
    `jp-shrimp-udon`/`jp-agedashi-tofu-rice` (mirin), `fr-quiche-lorraine`
    (nutmeg), `me-fattoush-chicken` (lemon), `cn-egg-foo-young` (vegetable
    broth, cornstarch), `cn-black-pepper-beef` (cornstarch),
    `cn-general-tso` (rice vinegar, dried chilies), `am-chicken-pot-pie`
    (flour), `bq-steak-chimichurri` (red pepper flakes),
    `am-fried-chicken-sandwich` (paprika, vegetable oil — the deep-frying
    oil itself was never listed), `in-coconut-lentil-curry` (lime),
    `am-lentil-shepherds-pie` (milk), `jp-chicken-karaage` (garlic,
    vegetable oil), `md-vegetable-paella` (vegetable broth, lemon), and
    five tahini-sauce recipes all missing the lemon their own sauce step
    calls for (`me-beef-shawarma-plate`, `me-cauliflower-shawarma`,
    `me-lamb-shawarma-plate`, `me-tofu-shawarma-bowls`,
    `am-crispy-tofu-buddha-bowl`). `validateRecipes.ts`,
    `npm run typecheck`, and `npm test` all still green — every added
    ingredient is referenced in its recipe's steps, so the existing
    forward check keeps passing. The reverse-check script itself was a
    one-off (too noisy to run unsupervised — see the false-positive
    categories above) and was not committed as a permanent gate; worth
    revisiting as a proper CI check if this class of bug recurs.

## 8. Roadmap (agreed direction — no code changes without owner approval on scope)

- **Milestone 1 — Trust & safety: done.** P0-1 allergen imports-guard (M1.5)
  · seed validator/canonical-allergen-list + Tree Nuts mismatch fixed
  (debug-sweep P0-1/P1-1, 2026-07-09, see §7 #1) ·
  P0-3 draft-plan protection (M1.8) · dead questions removed (M1.8) · real
  dates + correct "Tonight" (M1.4) · single cost source (M1.2) · persist theme
  (M1.1) · one-review-per-plan guard (M1.3) · sync per-item merge (M1.6) ·
  unblock UI (M1.8) · small correctness cleanups (M1.7) · Kosher option
  removed rather than fixed (2026-07-02, see §7 #2).
- **Milestone 2 — Finish what's started (in progress, see `MILESTONE-2.md`):**
  rate-as-you-go (M2.1, done — see §5.4) · mid-week re-roll from pantry +
  this week's shopping list (M2.2, done — see §5.6) · "same as last week" fast
  intake (M2.3, done — see §5.1) · recipe content quality pass to
  cookbook-detail on all 230 curated recipes (M2.2b, done — see
  `RECIPE-CONTENT.md`) · curated-first scoring weight (M2.4, done — a flat
  `WEIGHTS.curated = 0.1` bonus in `scoring.ts` for non-`mealdb-` recipes,
  tuned via `scripts/checkCuratedWeighting.ts` so curated recipes are a clear
  majority of picks without fully burying imported ones) · engine test suite
  (M2.5, done — `npm test`, 93 assertions over `src/engine/`, see §9) · wire
  learned dials into scoring (M2.6, done — spice/complexity/budget/leftover/
  vegetableAffinity nudge picks via `learnedDialsFit()`, capped below the
  explicit profile factors; see §4 and §7 #8).
- **Milestone 3 — The Family's Daily App (in progress, see `MILESTONE-3.md`):**
  carry-over cleanups (M3.0, done) · real photos for curated recipes (M3.0b,
  done — see §5.7) · recipe browser with search, favorites (now
  household-synced), and pin-to-week (M3.1, done — see §5.8) · Kids-approved
  flag, synced the same way, with a modest scoring nudge (M3.2, done — see
  §5.9) · manual grocery items, not plan-scoped, household-synced with the
  same merge rigor as everything else (M3.3, done — see §5.10) · full-screen
  guided cook mode with timers, per-device step memory (M3.4, done — see
  §5.11) · our own family recipes, per-device, fully participating in
  generation/search/pinning/shopping/cook mode (M3.5, done — see §5.12).
- Later: day-aware planning/reorder · leftovers-aware planning (new design — the
  original `desiredLeftovers`/`specialOccasions` fields this was scoped
  around were removed in M1.8) · pantry auto-deduction after shopping · sync
  pantry/profile/(the rest of) learning · notifications · other stores.
- Future: Claude-powered natural-language intake mapped onto the deterministic
  engine as constraints — **allergy filtering stays deterministic; never
  delegate safety to a model.**

## 9. Operational notes for future AI sessions

- `npm install` then `npm run typecheck` and `npm test` first; keep both
  green; update this file (bugs fixed, features added) in the same change.
- **Test suite (M2.5):** `jest-expo` + `jest.config.js` (`testMatch` scoped to
  `src/engine/**/*.test.ts`, `@/` alias mapped via `moduleNameMapper`) +
  `babel.config.js` (`babel-preset-expo`). Only the engine folder is covered
  — screens/stores are explicitly out of scope for now. Shared fixtures live
  in `src/engine/testFixtures.ts` (not matched by `testMatch`, so it's never
  itself run as a test file). Add or update a test alongside any new/changed
  pure function in `src/engine/`.
- `recipeImported.ts` is **generated** — never hand-edit; change
  `normalize.ts` / `scripts/importRecipes.ts` and re-run instead.
- Every push to `claude/weekly-meals-app-eyowlr` deploys the web build.
- Keep changes small and grouped by milestone; isolate anything touching the
  plan lifecycle or seed data.
