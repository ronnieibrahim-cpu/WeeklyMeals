# MILESTONE-2 — Finish What's Started

Prerequisite: ALL of MILESTONE-1 complete and verified. Work tasks **in order**.
Same rules as Milestone 1: one task per session, plan first, typecheck green,
check off with a one-line note, update PROJECT.md when behavior changes.

Product decisions below are ✅ DECIDED by Ronnie unless marked ⚠️ ASK.

---

## [ ] M2.1 — Mid-week re-roll from what we have (TOP PRIORITY)
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

## [ ] M2.2 — Remove the dead Sunday questions
**✅ DECIDED:** Delete the "special occasions" step entirely (UI + field usage;
keep type field tolerated for old persisted data). Remove the "desired
leftovers" step from the wizard but keep the field in the model defaulted to 0
— leftovers-aware planning is a future milestone.
**Accept when:** the wizard no longer asks either question; old saved intakes
still load; step count and progress indicator update correctly.

## [ ] M2.3 — "Same as last week" fast intake
**User problem:** 14 steps every Sunday when most answers never change.
**Behavior:** If a previous intake exists, the wizard opens with a summary card
("Last week: 5 dinners, ~$150, 45 min max…") and two buttons:
**"Same as last week — just update proteins & fridge"** (jumps through only:
number of dinners, proteins/moods if applicable, ingredients on hand → generate)
and **"Adjust everything"** (full wizard, pre-filled as today).
**Accept when:** the fast path is ≤4 interactions from open to generated draft;
full path unchanged; first-ever run (no prior intake) shows the full wizard.

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
sync merge logic from M1.6, learning math, and the M2.1 reroll candidate
function. Target: the engine folder is meaningfully covered; screens are not
the goal.
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
- Leftovers-aware planning (wire `desiredLeftovers` into cook-night count).
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
