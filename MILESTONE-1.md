# MILESTONE-1 — Trust & Safety

Goal: make the existing app correct and trustworthy. **No new features.**
Work tasks **in order** (easiest first to establish the workflow, hardest last).
Check off each task with a one-line note when done.

Product decisions already made by Ronnie are marked ✅ DECIDED. Anything marked
⚠️ ASK means: stop and ask Ronnie before implementing.

---

## [x] M1.1 — Persist the theme setting — done: added `SettingsRepository`/`LocalSettingsRepository` (kvStore `wm:settings:v1`), `settingsStore` now hydrates in `init()` wired from `app/_layout.tsx`.
**Problem:** `settingsStore` is in-memory only; theme resets to System every launch.
**Approach:** Persist `themePreference` via a small repository following the
existing pattern (`kvStore` key like `wm:settings:v1`), hydrate in `init()`
called from `app/_layout.tsx` like the other stores.
**Accept when:** choose Dark, force-quit/reload, app reopens in Dark. Typecheck green.

## [x] M1.2 — One source of truth for cost — done: added `previewShoppingList(plan)` to `planStore` (wraps `buildShoppingList()`); review and home screens use it instead of `roughCostPerServing()`, which is now engine-scoring-only.
**Problem:** Plan review (`app/plan/review.tsx`) and the home screen use
`roughCostPerServing()` while the shopping tab uses curated H-E-B pricing —
the totals visibly disagree.
**Approach:** `buildShoppingList()` is already a pure function. Use it (or a
lightweight pricing helper extracted from it) to compute the displayed total on
the review screen and home screen, so every screen shows the same number the
shopping list will show. Keep `roughCostPerServing()` ONLY as an internal
scoring heuristic inside the engine.
**Accept when:** the dollar total shown at approval equals the shopping tab's
estimated total for the same plan (pantry exclusions included in both).

## [x] M1.3 — One review per plan — done: `WeeklyPlan.reviewedAtISO` set by `planStore.markReviewed()` on submit; home card shows "Week rated ✓" and re-entering `/review` shows a read-only summary instead of the wizard. Also fixed a crash discovered while testing: the rating wizard threw when `flags` was missing from a draft (normalized via a small `normalizeDraft()` helper).
**Problem:** The weekly review can be submitted repeatedly for the same plan,
double-counting taste learning.
**Approach:** Add a `reviewedAtISO?: string` field to `WeeklyPlan`. Set it in
`submitReview` flow; when set, the "How did this week go?" card on the home
screen changes to a completed state ("Week rated ✓") and re-entering the
review shows a friendly already-reviewed message with the option to view (not
resubmit). Old persisted plans without the field must load fine.
**Accept when:** submitting a review twice is impossible through the UI, and
existing saved data still loads.

## [x] M1.4 — Real dates ("Tonight" means tonight) — done: `weekStartISO` normalized to local midnight at generation (`localMidnight()`); new `src/engine/schedule.ts` (`todayOffset`/`dayLabel`/`dateForDayIndex`) drives home (hero "Tonight" card, collapsed past section, "Week complete!" state) and schedule (real dates). Verified with a mocked system clock at day 0, day+3, and day+10.
**Problem:** `dayIndex 0` is labeled "Tonight" forever; `weekStartISO` is just
the generation timestamp. Mid-week, the home screen highlights the wrong meal.
**✅ DECIDED (default, confirm if unclear):** the plan starts the day it is
generated (day 0 = that calendar date), and each meal maps to a real calendar
date from there.
**Approach:** Normalize `weekStartISO` to local midnight of the generation day.
Home screen computes today's offset from `weekStartISO`:
- today's meal is the hero card labeled "Tonight";
- past days show under a collapsed/past section with their cooked state;
- future days list as "Tomorrow", "Thursday", etc.;
- if today is past the last planned day, show a gentle "week complete — plan
  next week?" state (and the review prompt if not yet reviewed).
Schedule tab shows real dates (it mostly does; verify off-by-one and timezone —
use local dates, never UTC parsing of the ISO string for day math).
**Accept when:** changing the device date to mid-week highlights the correct
meal as Tonight; day labels match the calendar; no timezone off-by-one at
midnight boundaries.

## [x] M1.5 — Allergy guard for imported recipes — done: `passesHardFilters` (src/engine/recommendation/filters.ts) now rejects any recipe with `estimated: true` whenever `profile.allergies.length > 0`; since generate/regenerate/swap all funnel through this one function, imports drop out of all three the moment an allergy is set, and reappear once it's cleared. Added the "Imported recipe — allergen info estimated, check labels." note to `app/meal/[id].tsx`, shown whenever `recipe.estimated` is true regardless of profile. No test runner exists yet in this repo (noted in PROJECT.md P0-1/#11) — flagging per CLAUDE.md's safety-critical rule rather than installing one as a drive-by; Milestone 4 is scoped to add the engine test suite.
**Problem:** The 311 imported recipes (`recipeImported.ts`, ids starting
`mealdb-`) have keyword-guessed `allergens`/`dietTags`. The hard allergy filter
trusts them, which can produce false "safe" results.
**⚠️ ASK Ronnie first:** confirm chosen behavior (exclude vs. warn) — see his
answer in chat; default if unreachable: **exclude**.
**Approach (exclude variant):** Add `estimated?: boolean` (or detect the
`mealdb-` prefix / existing source fields) as the marker. In
`passesHardFilters`, when `profile.allergies.length > 0`, reject recipes whose
allergen data is estimated. Additionally, on every imported recipe's detail
screen, show a small note: "Imported recipe — allergen info estimated, check
labels." (The note appears regardless of profile, since guests may have
allergies.)
**Accept when:** with any allergy set in Profile, generate/regenerate/swap can
only ever produce hand-curated recipes; with no allergies set, imported recipes
still appear; the detail-screen note shows on imported recipes.

## [x] M1.6 — Shopping-list sync merges instead of overwriting — done: `ShoppingItem.checkedAtISO` / `PlannedMeal.cookedAtISO` stamped in `planStore.toggleShoppingItem`/`toggleCooked`; new pure `src/engine/syncMerge.ts` (`mergeShoppingLists`, `mergePlanMeals`, `mergeSyncPayload`) merges per-item/per-meal state instead of whole-payload replace, is commutative and idempotent by construction, and is wired into `syncStore.pull()` (push-back only when the merge actually adds something the server doesn't have yet, gated by a stable/sorted-key stringify so it can't ping-pong). Differing plan ids now compare `createdAtISO` — the newer plan wins regardless of which side is "local" vs "remote" — so a freshly generated week can't be raced away by a stale poll. Verified with `scripts/checkSyncMerge.ts` (9 assertions: cross-device convergence, newer-uncheck-beats-older-check, one-sided items survive, legacy/missing-timestamp data, planId-differ newer-wins both directions, idempotence, commutativity) — all passing; run via `npx tsx --tsconfig ./tsconfig.json scripts/checkSyncMerge.ts`. These assertions should migrate into the real test suite once M2.5 sets one up (no runner installed yet — PROJECT.md #11).
**Problem:** Household sync pushes the whole payload, last-write-wins, 20s
polling. Two phones checking items in-store clobber each other's checkmarks.
**Approach (keep it simple, no new backend):**
1. Change `ShoppingItem.checked: boolean` to also carry
   `checkedAtISO?: string | null` (timestamp of the last toggle on this device).
2. On pull, if the remote list is for the same `planId`, merge per item
   (match by name+unit): the side with the newer `checkedAtISO` wins that
   item's checked state; items only present on one side are kept. Plan-level
   fields still last-write-wins.
3. If planIds differ, current whole-payload behavior stands (a new plan
   legitimately replaces the old one).
4. Migration: old lists without timestamps must load and merge sanely
   (treat missing timestamp as epoch 0).
**Accept when:** simulated scenario — device A checks items 1–3, device B
checks items 4–6 within the same poll window — converges to all six checked on
both devices. Cooked-toggles on meals should get the same per-meal treatment
if straightforward; otherwise note it as follow-up.

## [x] M1.7 — Small correctness cleanups (one commit) — done: `syncStore.joinHousehold` now checks `getHousehold(code)` first and returns `'not_found'` instead of silently creating a row; `app/household.tsx` shows a "No household found with that code — create a new one?" confirm card wired to a new explicit `createHouseholdWithCode` action (shares a `seedHousehold` helper with the existing random-code `createHousehold`). `recipesById` (`src/data/seed/recipes.ts`) now built with a plain `for` loop instead of spread-in-reduce. `shuffle()` no longer duplicated in `planStore` — it's private to `LocalRecommendationEngine.ts`, and `swapMeal` delegates to a new exported `selectReplacement()` helper there instead of re-implementing the shuffle-then-best-score loop inline; `generate()`'s own loop was left untouched to keep behavior identical.
- Joining a household code that doesn't exist should warn ("No household found
  with that code — create a new one?") instead of silently creating one from
  local data. Creating via explicit confirmation is fine.
- Replace the O(n²) spread-in-reduce building `recipesById` with a plain loop.
- Remove the duplicated `shuffle()` in `planStore` (import/reuse one impl) and
  have `swapMeal` delegate candidate selection to a small engine helper instead
  of re-implementing scoring inline.
**Accept when:** behavior unchanged (except the join warning), typecheck green.

---

## Ronnie's manual checklist (not code)
- [ ] In the Supabase dashboard: confirm Row-Level Security is enabled on the
      `households` table and anonymous clients cannot `select` all rows
      (only lookups that match a known code should work). Ask Claude Code to
      walk you through checking this if unsure.

## Explicitly OUT of scope for Milestone 1
Fast-path intake, removing dead questions, curated-first scoring, tests setup,
photos, leftovers logic, notifications. These are Milestone 2+ — do not start
them even if tempting.
