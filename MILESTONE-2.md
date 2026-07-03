# MILESTONE-2 — Finish What's Started

Prerequisite: ALL of MILESTONE-1 complete and verified. Work tasks **in order**.
Same rules as Milestone 1: one task per session, plan first, typecheck green,
check off with a one-line note, update PROJECT.md when behavior changes.

Product decisions below are ✅ DECIDED by Ronnie unless marked ⚠️ ASK.

---

## [x] M2.1 — Rate-as-you-go (replaces the end-of-week rating wizard as the primary flow) — done: `PlannedMeal.rating`/`ratedAtISO` added; meal detail screen and every meal card (This Week + Schedule) show a tappable/always-visible star row; `learningStore.rateRecipe` upserts by (planId, recipeId) and recomputes `PreferenceProfile` from scratch via `applyRatings(createDefaultPreferences(), ratings, recipesById)` on every rate/edit, so double-counting is structurally impossible; `reviewedAtISO` removed in favor of a computed `allMealsRated()` check (`src/engine/rating.ts`); the wizard (`app/review/index.tsx`) now walks only `unratedMeals()` and shows a read-only recap once everything's rated; sync merges `rating`/`ratedAtISO` per meal like `cooked`/`cookedAtISO` (`src/engine/syncMerge.ts`), verified by two new assertions in `scripts/checkSyncMerge.ts` (11/11 passing). Manually verified end-to-end in the web preview: rating persists across reload, editing 4→2 stars updates the card instantly, and the catch-up wizard correctly skips already-rated meals.
**User problem:** Ratings are currently only possible in the sequential
end-of-week wizard, are never displayed afterward, and appear to "clear" on
revisit. Ronnie wants to rate any day's meal at any time, see the rating
persist on the meal detail screen, and see stars conspicuously on the week's
menu at all times.

**✅ DECIDED:** Ratings can be set on ANY meal in the current week at ANY
time — not gated on the meal being marked cooked.

**Behavior:**
1. Add `rating?: 1|2|3|4|5` and `ratedAtISO?: string` to `PlannedMeal`
   (optional fields — old persisted plans must load unchanged).
2. Meal detail screen: a prominent tappable 5-star row for any meal in the
   current week. Tapping sets/edits the rating instantly; it persists and
   always displays.
3. Week menu (This Week home + Schedule tab): once a meal is rated, its
   stars display on the meal card at all times, clearly visible without
   tapping in. Unrated meals show a subtle empty-stars affordance inviting a
   rating.
4. **Learning integrity:** replace the plan-level `reviewedAtISO`
   double-count guard with recompute-from-history. Ratings are the source of
   truth; whenever any rating is set or edited, recompute the entire
   `PreferenceProfile` by folding over the full rating history (`learning.ts`
   is already a pure fold — recomputing from scratch makes edits and
   re-rates structurally incapable of double-counting). Preserve legacy
   `RatingEvent`s so past learning isn't lost.
5. The end-of-week review wizard becomes an optional catch-up: it shows ONLY
   unrated meals from the week, and if everything is already rated the home
   card shows "Week rated ✓" instead of prompting.
6. **Sync:** `rating`/`ratedAtISO` merge per meal exactly like
   `cooked`/`cookedAtISO` in the M1.6 `mergePlanMeals` logic (newer
   `ratedAtISO` wins per meal, deterministic tie-break; missing timestamp =
   epoch 0). Extend `scripts/checkSyncMerge.ts` with assertions covering
   rating merges, including two devices rating different meals in the same
   window and a newer rating edit beating an older one.
7. Keep the layering: rating mutation + profile recompute live in the store
   calling pure engine functions; screens stay thin; theme values via
   `useTheme()` only.

**Accept when:** rating from the detail screen persists across app restarts
and displays on the week's cards at all times; editing a rating updates
learning without double-counting (verify: rate a meal 5, change it to 1, and
confirm the derived profile equals a fresh fold of the corrected history);
the merge assertion script passes including the new rating cases; the wizard
only ever shows unrated meals; typecheck green.

## [x] M2.2 — Mid-week re-roll from what we have (TOP PRIORITY) — done: pure `rerollCandidates()` in `src/engine/reroll.ts` (strict-mode: pantry + this week's shopping list + the outgoing meal's own ingredients, minus that meal itself, must fully cover a candidate's non-staple ingredients; falls back to up to 3 near-misses missing 1-2 ingredients); `planStore.previewReroll`/`rerollMeal` wire it up (reroll never rebuilds or touches the shopping list, and clears any cooked/rating on that day since it's now a different recipe); entry point is a single "↻ Re-roll" link on This Week's meal cards, shown only for today-or-future not-yet-cooked meals, opening a new `/reroll/[dayIndex]` modal (top pick + "Try another" cycling, or the near-miss list with "you'll need: X, Y"). Manually verified in the web preview: swapping in a candidate leaves the shopping-list total byte-for-byte unchanged, a cooked day shows no Re-roll link, and forcing a sparse week correctly surfaces the near-miss fallback with the right missing ingredients labeled. **Follow-up bug fix (same day):** `rerollMeal` changed `recipeId` with no way for `mergePlanMeals` to know the meal's identity had changed, so a stale rating/cooked-flag for the *outgoing* recipe could merge onto the *new* one across devices. Added `PlannedMeal.recipeChangedAtISO`, stamped by `rerollMeal`; `mergePlanMeals` now picks one side's whole meal body atomically (cooked/rating included) whenever `recipeId` diverges between two synced copies, instead of merging fields piecewise — see `resolveDivergedRecipe` in `syncMerge.ts`. Also fixed a stale `reroll.ts` docstring claiming candidates were shuffled (they're deterministically sorted by score) and updated `mergePlanMeals`' doc comment to describe the new same-recipe-vs-diverged-recipe split. Extended `scripts/checkSyncMerge.ts` with 4 new assertions (15 total): a re-roll beating an unchanged meal, a re-roll discarding the outgoing dish's rating, two different re-rolls of the same day picking the newer one, and idempotence on the diverged-recipe path — all passing.
**User problem:** It's Wednesday, the family doesn't want the planned meal, and
nobody is going back to H-E-B. They want one tap: "give me something else I can
make with what we already bought."
**✅ DECIDED: STRICT mode.** A re-roll must NEVER add items to the shopping
list or require a store trip.

**Behavior:**
- On the approved plan, every not-yet-cooked meal for today or a future day
  gets a "Re-roll" action (home screen card and/or meal detail — pick the
  cleaner placement and be consistent).
- **Available ingredients** = pantry items + ALL ingredients on the current
  week's shopping list (assume purchased) + the outgoing meal's own ingredients
  + `PANTRY_STAPLES`. Match by normalized name (lowercase, trimmed); ignore
  quantities for now (note this simplification in PROJECT.md).
- **Candidates** = recipes passing all existing hard filters (allergies, diet,
  time limits, dislikes, blocked, imported-recipe allergy guard from M1.5)
  whose every non-staple ingredient is in the available set, excluding recipes
  already in this week's plan. Rank by the existing scoring function; offer the
  top pick with a "try another" option (cycle through top ~5).
- **Empty-result fallback (graceful, still strict):** if zero recipes fully
  qualify, show "Nothing can be made entirely from what you have" and list up
  to 3 near-misses labeled with exactly which 1–2 ingredients are missing.
  Choosing a near-miss is allowed but NEVER silently edits the shopping list —
  the missing items are shown to the user as "you'll need: X, Y" on the meal
  card/detail.
- Re-rolling replaces the meal in the plan (persisted + synced like any plan
  change) and does not touch the shopping list at all.
**Engine note:** implement candidate selection as a pure function in
`src/engine/` (e.g. `rerollCandidates(plan, dayIndex, recipes, available, profile, prefs)`)
so it is testable; the store just calls it.
**Accept when:** with a full plan approved, re-rolling a day only ever offers
meals coverable by pantry + this week's list; the shopping list is byte-for-byte
unchanged after any re-roll; cooked/past days offer no re-roll; empty case
shows the near-miss fallback with missing items labeled.

## [x] M2.3 — "Same as last week" fast intake — done: `app/plan/index.tsx` now shows a choice screen (recap card + two buttons) whenever a previous approved plan's intake exists; "Same as last week" jumps through exactly 3 steps (dinners, proteins, ingredients-on-hand — reusing the same step definitions as the full wizard, no duplicated UI) then generates immediately; "Adjust everything" runs the unchanged 12-step wizard, pre-filled from last week's actual answers rather than profile defaults. First-ever run (no previous plan) skips straight to the full wizard, no choice screen. Read: "proteins/moods if applicable" in the spec as one step (proteins), sized so the fast path totals exactly 4 interactions per the accept criterion — flagging this reading here since it was the one real ambiguity in an otherwise-DECIDED task. Caught and fixed a real hydration race during testing: reading `previousIntake` in a `useState` initializer captured a stale pre-hydration `null` and permanently locked the screen into the full-wizard path; fixed with a one-time post-hydration effect (same `hydrated`-gated pattern already used on This Week/Schedule). Manually verified in the web preview: first run shows the full wizard directly; a second week shows the recap + choice; the fast path lands on `/plan/review` in exactly 4 taps; "Adjust everything" starts pre-filled with last week's real values (not profile defaults).

## [ ] M2.4 — Curated-first recommendation weighting
**Problem:** 311 imported recipes (estimated quality) outnumber 230 curated
ones and win picks too often.
**Approach:** Add a modest scoring bonus for curated (non-`mealdb-`) recipes —
enough to win ties and near-ties, not enough to bury a clearly better imported
match. Tune so a typical generated week is majority-curated.
**Accept when:** across ~10 generated test weeks, curated recipes make up a
clear majority of picks while imported recipes still appear.

## [ ] M2.5 — Engine test suite (protects everything after this)
**Approach:** Add the standard Expo/Jest setup (`jest-expo`) — this is the one
sanctioned new dev dependency. Write tests for: hard filters (each rule),
allergy guard incl. imported exclusion, scoring invariants (locked recipes
kept, no duplicates in a week), shopping-list consolidation & pantry exclusion,
sync merge logic from M1.6 and M2.1, learning math, and the M2.2 reroll
candidate function. Target: the engine folder is meaningfully covered;
screens are not the goal.
**Accept when:** `npm test` runs green and is documented in CLAUDE.md as a
required pre-commit check alongside typecheck.

## [ ] M2.6 — Finish the learning loop
**Problem:** Learned dials (spice, complexity, budget sensitivity, leftover
tolerance) and `vegetableAffinity` are computed from ratings but never used.
**Approach:** Wire each into scoring with small, capped weights (learning nudges
picks; it must never dominate explicit profile settings). Add tests.
**Accept when:** ratings visibly shift future recommendations in tests
(e.g., consistently low ratings on spicy meals reduces spicy picks) and
profile hard-filters still always win.

---

## Parked (do NOT start without explicit go-ahead from Ronnie)
- **Photos for curated recipes** — approach undecided (real/AI/hybrid).
- Leftovers-aware planning (real day-aware leftover logic — the
  `desiredLeftovers`/`specialOccasions` intake fields this was originally
  scoped around were removed entirely in M1.8, not merely hidden; this would
  need new design, not a revival).
- End-of-week review nudge/notification; Sunday planning reminder.
- Shopping list share/export; post-shop pantry auto-add.
- Browse/search library; pin a specific recipe into the week.
- H-E-B Curbside/Instacart links; other stores; LLM recommendation layer.

## Standing product direction (context for all future work)
1. Bug-free and trustworthy beats feature-rich. Always.
2. Reduce Sundays toward zero effort: the end-state is the app opening with a
   drafted week and one question — "anything different?"
3. The shopping list and the mid-week experience are the most-touched surfaces;
   they get the highest quality bar.
4. Never ask the user a question the code doesn't act on.
5. All decisions framed in plain English for a non-programmer Product Owner
   who is engineer-minded and wants to steer.
