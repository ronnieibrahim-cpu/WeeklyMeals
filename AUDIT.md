# Weekly Meals — Project Audit & Technical Product Leadership Review

*Prepared by: Lead Engineer / Technical Advisor · July 2026*
*Scope: full repository read of branch `claude/weekly-meals-app-eyowlr` — every screen, store, engine module, data file, and config was read; nothing below is inferred from docs alone.*

---

## 1. Executive Summary

**The good news first: this codebase is in significantly better shape than a typical vibe-coded app.** The architecture is genuinely clean and layered (screens → stores → pure engine → data), the code matches its own documentation more closely than most professionally-built apps, TypeScript strict mode passes with zero errors, and the persistence and grocery-pricing layers sit behind interfaces so they can be swapped later without touching the UI. Whoever guided the early sessions did well. **Do not rewrite anything. This foundation is worth building on.**

That said, there are real problems, and they cluster into four themes:

1. **One safety-relevant data bug.** The allergy filter can silently fail for tree nuts because the recipe data uses two different spellings (`'Tree Nuts'` vs `'TreeNuts'`). The kosher filter contains a logic typo that makes part of it a no-op. If anyone in your household ever relies on the allergy filter, this is the first thing to fix.
2. **The app asks questions it ignores.** Two of the fourteen Sunday questions (special occasions, desired leftovers) are collected and then thrown away — the engine never reads them. For an app whose entire mission is "don't make me think," asking a family to answer questions that do nothing is the worst possible sin. Similarly, the learning system tracks spice tolerance, prep tolerance, and budget sensitivity from your weekly ratings, but the recommendation scorer never uses those four dials.
3. **Some promised features don't exist yet.** The README and empty states promise a "cooking schedule and leftover plan." There is no leftover-plan engine; the schedule tab is the meal list with a hard-coded generic tip. The data model has `isLeftoverDay` fields that nothing ever sets. The docs also reference an engine test suite, `schedule.ts`, and `units.ts` that were never created.
4. **The planner will repeat itself.** The engine has no memory of what it planned in previous weeks. Because scoring is deterministic apart from tie-breaking, your highest-scoring meals will keep coming back week after week. This directly undermines the core promise ("gets smarter every week").

There are also two workflow traps that can lose real data (starting a new plan mid-week silently destroys the current approved week before you've approved the new one; re-submitting the weekly review double-counts ratings), a static "Tonight" label that's wrong from day two onward, inconsistent cost numbers between screens, and a household sync design that is fine for two trusting spouses but has last-write-wins conflicts and a privacy caveat worth understanding.

**Overall grade: B for engineering, C+ for product completeness.** The recommended path is: a small, surgical P0 fix batch (allergy data, plan-overwrite trap, dead questions), then a P1 batch focused on trust (correct "Tonight," week-to-week variety, one consistent cost number), then the features that make Sundays truly one-tap.

---

## 2. Architecture Overview (plain English)

Think of the app as four layers, each only talking to the one below it:

1. **Screens** (`app/`) — what you see. Expo Router file-based routes: 4 tabs (This Week, Schedule, Shopping, Profile), a plan-week modal wizard, a weekly-review modal wizard, meal detail, settings, and household sync.
2. **Stores** (`src/stores/`, Zustand) — the app's working memory. Six stores: plan, profile, pantry, learning, settings, sync. Each loads itself from device storage on launch and saves after every change.
3. **Engine** (`src/engine/`) — the brains. Pure functions with no UI and no I/O: hard filters (allergies, diets, time limits), a weighted scoring function (12 weighted factors), a greedy week-builder, shopping-list consolidation, a cost heuristic, and the ratings→preferences learning function.
4. **Data** (`src/data/`) — the edges. AsyncStorage-backed repositories (device storage; IndexedDB on web), a curated H-E-B price table behind a `GroceryProvider` interface, a 541-recipe seed library (230 hand-authored + 311 imported from TheMealDB with citations), and a tiny Supabase REST client for household sync.

Household sync works by both phones sharing a 6-character code; the whole plan + shopping list is pushed as one JSON blob to a Supabase row and polled every 20 seconds.

**Assessment: this is the right architecture for this app.** It's simple, testable in principle (though no tests exist), and future-proofed in the right places.

---

## 3. Repository Map

```
app/                       Screens (Expo Router)
  (tabs)/                  This Week · Schedule · Shopping · Profile
  plan/                    14-step Sunday questionnaire → review & approve
  review/                  Weekly ratings wizard (the learning loop)
  meal/[id].tsx            Recipe detail (ingredients, steps, favorite)
  household.tsx            Sync setup (create/join/leave a household code)
  settings.tsx             Theme + "coming soon" list
src/
  domain/                  Pure types (Recipe, Profile, WeeklyPlan…) + constants
  engine/                  recommendation (filters/scoring/greedy picker),
                           shoppingList, cost, learning, season
  data/
    seed/                  541 recipes (batch1–8 hand-authored; recipeImported.ts
                           = 311 TheMealDB imports, 39k lines, generated file)
    repositories/local/    AsyncStorage persistence (plan, profile, pantry,
                           learning, shopping list)
    grocery/heb/           Curated price table + fallback pricing
    sync/                  Supabase REST client + committed publishable key
  stores/                  Zustand: plan, profile, pantry, learning, settings, sync
  ui/                      Theme tokens (light/dark) + 18 reusable components
docs/                      PRD · Wireframes · Architecture (partially stale)
scripts/importRecipes.ts   TheMealDB importer (excluded from typecheck)
.github/workflows/         Deploys the web build to GitHub Pages
```

---

## 4. Data Flow Summary

**Sunday:** Questionnaire seeds its defaults from your saved Profile → answers become `IntakeAnswers` → `generate()` filters 541 recipes through hard filters, then greedily picks the week by score → draft plan saved to device → you review, lock/swap, approve → approval builds the shopping list (scaled, deduped, pantry-subtracted, H-E-B-priced) → both persist locally → sync (if enabled) pushes the blob to Supabase.

**During the week:** Tapping "cooked" updates the plan; the spouse's phone picks it up within ~20s via polling.

**Week's end:** The review wizard collects per-meal ratings → `applyRatings()` nudges cuisine/protein/technique/vegetable affinities up or down, updates four "dials" (spice, complexity, budget, leftovers), and blocks strongly-disliked recipes → those affinities feed next week's scoring. *(The four dials are currently written but never read — see bugs.)*

---

## 5. Product Review (Phase 4 — where users think or click too much)

**The Sunday questionnaire is the app's biggest asset and its biggest liability.** Fourteen steps is a lot. Worse, for a returning user, most answers never change week to week (budget, family size, time limits, diets). The app already remembers everything it needs — it just doesn't use that memory to shorten the ritual.

Specific friction, ranked by how much thinking it forces:

1. **Two dead questions** (special occasions, leftover count) — pure wasted effort every single Sunday. Remove or wire them.
2. **No "same as last week" fast path.** Week 2+ should open with: "Same setup as last week — 7 dinners, $150, the usual. Anything different?" One tap → done. This is the single highest-leverage UX change in the whole app.
3. **The planner repeats itself across weeks** (no history awareness), so the "regenerate" button becomes a crutch — the user is doing the variety work the engine should do.
4. **"Tonight" is wrong from day 2.** The home hero card always shows the week's first meal, even on Thursday. The one glanceable answer the app exists to give ("what's for dinner tonight?") is only right one day a week.
5. **No day control.** Meals get day slots by pick order. Real families have soccer Tuesdays and slow Sundays. You can't reorder days or say "quick meal Thursday."
6. **The shopping list can't hold non-recipe items.** You still need milk, fruit, diapers. If the family needs a second list, this list loses; whoever shops will abandon it. Manual items are cheap to build and existential to retention.
7. **Cost numbers disagree between screens.** The review screen shows a rough heuristic; the shopping tab shows H-E-B table prices. Different totals for "the same week" quietly erode trust in all numbers.
8. **No recipe browsing / manual adds.** "The kids demanded tacos Tuesday" has no home. You should be able to browse/search the 541 recipes and pin one into the week.
9. **No way to undo the learning system's grudges.** One 1-star rating permanently blocks a recipe with no UI to see or unblock the list. The reset functions exist in code but no button calls them.
10. **Re-reviewing a week double-counts.** Nothing marks a plan as "reviewed," so tapping through the review twice applies the preference nudges twice.

---

## 6. Comprehensive Bug Report

### Critical (P0)

| # | Bug | Where | Detail |
|---|-----|-------|--------|
| B1 | **Allergy filter silently fails for tree nuts on some recipes** | seed data + `filters.ts` | Profile chip is `'Tree Nuts'`; batches 4–5 use `'Tree Nuts'` but batch 8 and 8 imported recipes use `'TreeNuts'`. Lowercased comparison `'tree nuts' ≠ 'treenuts'` → those recipes pass the filter. Additionally, 65 of 311 imported recipes have *empty* allergen arrays (keyword-inferred), and all imported allergens are best-effort guesses. Safety-relevant. |
| B2 | **Kosher filter is a no-op beyond pork/shellfish** | `filters.ts:33` | `(tags.includes('kosher') \|\| true)` — always true. Classic AI-generated typo. |
| B3 | **"Plan a new week" destroys the current week before approval** | `planStore.generate()` | Finishing the questionnaire immediately replaces the approved plan (and its cooked progress) with a new draft. Close the review without approving → the old week is gone, home shows a draft nag, shopping list is orphaned. Data-loss trap for exactly the "let me just peek at next week" behavior a busy parent will do. |

### High (P1)

| # | Bug | Where | Detail |
|---|-----|-------|--------|
| B4 | Dead intake fields | `plan/index.tsx`, engine | `specialOccasions` and `desiredLeftovers` collected, never read. No leftover-day logic exists anywhere (`isLeftoverDay` never set). |
| B5 | "Tonight" label static | `(tabs)/index.tsx` | `dayIndex === 0` is always "Tonight" regardless of actual date; hero card doesn't advance or skip cooked meals. |
| B6 | Learned dials never used | `scoring.ts` | `spiceTolerance`, `complexityPreference`, `budgetSensitivity`, `leftoverTolerance` are updated by reviews but no scoring term reads them. Half the learning loop is disconnected. Also `profile.spiceLevel`, `dislikedIngredients` (partially), `equipment`, `cookingSkill` vs recipe difficulty are never considered. |
| B7 | No cross-week variety | engine | `GenerateContext` has no plan history; deterministic scoring reproduces near-identical weeks. |
| B8 | Review double-submission | `review/index.tsx`, `learningStore` | No "reviewed" flag on the plan; ratings can be applied repeatedly. Also `enjoyment === 1` (or ≤2 + "wouldn't cook again") permanently blocks a recipe with no unblock UI. |
| B9 | Sync conflicts (last-write-wins) | `syncStore.ts` | Whole payload replaced on push; two spouses checking shopping items within the same ~20s window silently lose each other's checks. Profile/pantry/learning are *not* synced at all (household sees different preferences per phone). |
| B10 | Cost inconsistency | `plan/review.tsx` vs shopping | Review uses `roughCostPerServing` heuristic; shopping uses the H-E-B table. Totals visibly disagree. Count-based units ("3 cloves") priced crudely. |
| B11 | Shopping checks lost on rebuild | `planStore.approve/buildList` | List rebuilt from scratch (checked=false); staleness detected by planId only, so a modified plan with the same id would keep a stale list. Currently mostly unreachable, but fragile. |

### Medium (P2)

| # | Bug | Detail |
|---|-----|--------|
| B12 | Theme preference not persisted — resets to System every launch (`settingsStore` comment admits it). |
| B13 | `joinHousehold` with a short code silently returns — the button appears dead; no validation message. Household create doesn't check code collisions (887M space, low but nonzero). |
| B14 | Duplicate logic: `shuffle` + greedy scorer copy-pasted into `planStore.swapMeal` instead of reusing the engine. Drift risk. |
| B15 | `recipesById` built with spread-inside-reduce → O(n²) over 541 recipes at module load (measurable startup cost; trivial fix). |
| B16 | Imported recipe quality: all 311 claim 4 servings, ~15/30 min, formula-guessed nutrition (`420 + 100 if starch…`). 57% of the library feeds the budget/nutrition/time scorers noise. Cuisine mapping lumps Vietnamese/Filipino→Thai, British/Russian/Kenyan→American (display uses `origin`, so cosmetic, but scoring uses the mapped cuisine). |
| B17 | Accessibility gaps: chips and star rating lack `accessibilityRole`/`state`; collapsible department headers unlabeled. |
| B18 | Docs drift: ARCHITECTURE.md references `schedule.ts`, `units.ts`, `RatingRepository`, `__tests__/` — none exist. README claims a "leftover plan" feature that doesn't exist. |
| B19 | Zero tests, despite the engine being purpose-built for testing. |

---

## 7. Technical Debt Assessment

Ranked by risk to future development:

1. **No tests on the engine (high).** The scoring/filter/learning code is exactly where subtle regressions hide, it's pure (trivially testable), and it's the code AI sessions will most often touch. Every future change is currently verified by vibes.
2. **Seed-data inconsistency (high, because safety).** Two allergen spellings, guessed metadata on imports, no validation script. A tiny `validateRecipes()` script run in CI would catch the entire B1 class permanently.
3. **Docs drift (medium).** Three doc files partially describe an app that doesn't exist. Future AI sessions will read them and "restore" phantom features. PROJECT.md (created alongside this audit) should become the single source of truth.
4. **Duplicated engine logic in planStore (medium).** One scorer, one shuffle, imported everywhere.
5. **Whole-blob sync (medium).** Fine today; will fight every future feature (item-level checks, multi-week history). Contained behind a small API, so replaceable later.
6. **39k-line generated file in the bundle (low).** Ships every recipe in JS. Fine for now; lazy-load or move to a JSON asset if startup ever feels slow.

## 8. Security & Privacy Observations

- The committed Supabase **publishable key is the intended pattern** — not a leak — *provided* Row-Level Security is configured on the `households` table. **Action item you can't see from the repo:** verify in the Supabase dashboard that anonymous users can only `select`/`upsert` rows matching a code they supply, not `select *` the whole table. If RLS is permissive, anyone with the key (public in the JS bundle) can enumerate every household's meal plans and dietary restrictions. Meal data is low-sensitivity, but dietary restrictions/allergies are health-adjacent — worth 15 minutes of verification.
- Anyone who learns your 6-character code has full read/write on your household. Acceptable for a family app; just know it. No rate limiting on guesses (mitigate via RLS + Supabase's built-in limits).
- Everything else is on-device. No auth, no analytics, no third-party trackers. Good.

## 9. Performance Observations

No real problems at this scale. Notables: the O(n²) `recipesById` build (B15), scoring runs 541 recipes × 12 factors per pick × 7 picks — thousands of cheap function calls, fine; the 20s sync poll is battery-friendly enough. The imported-recipes file is the biggest bundle contributor; defer optimizing until launch feels slow.

## 10. Maintainability Assessment

**Good.** Strict TS passes clean; naming is consistent; components are small; comments explain *why*; layering is respected (I checked imports — no UI→data leaks). The main threats are the untested engine and doc drift, both addressed in the roadmap. Future AI sessions will navigate this codebase easily, especially with PROJECT.md as the anchor.

---

## 11. Prioritized Roadmap

### P0 — Critical fixes (small, safe, do first)

| Item | Why | Effort | Risk |
|---|---|---|---|
| **P0.1 Fix allergen matching + kosher filter** — normalize allergen strings in one canonical list, normalize comparison (strip spaces/case), fix the `\|\| true`, add a seed-data validation script to CI. | Safety. The one bug class that can hurt someone. | Small (half a session) | Very low |
| **P0.2 Protect the current week** — build the new plan as a *pending draft* alongside the approved plan; only replace on approve; "discard draft" returns to the live week. | Prevents silent data loss of the week in progress. | Small–medium | Low |
| **P0.3 Remove or wire the dead questions** — recommendation: **remove** special occasions entirely (speculative feature); **wire** desired leftovers minimally (prefer `makesLeftovers` recipes up to the requested count) or remove it too. | Every Sunday, zero-value questions cost real attention. | Small | Very low |

### P1 — Highest-value improvements (make the app trustworthy)

| Item | Why / cognitive load removed | Effort |
|---|---|---|
| **P1.1 Correct "Tonight"** — compute today's meal from the actual date; hero shows the next uncooked meal; past uncooked meals offer a one-tap "push the rest of the week back." | The app's #1 glanceable answer becomes always right. | Small |
| **P1.2 Cross-week variety** — keep the last 2–3 weeks' recipe/cuisine history and add a recency penalty to scoring. | The engine does the rotation work instead of the user hammering "regenerate." Directly delivers "gets smarter every week." | Medium |
| **P1.3 "Same as last week" fast path** — returning users see last week's setup as a one-tap confirm, with an "adjust" escape hatch into the full wizard. | Sunday goes from 14 taps to 1–3. The single biggest decision-fatigue win available. | Medium |
| **P1.4 Manual shopping-list items** — add-your-own line items (persisted, synced, surviving rebuilds); merge checked-state by item key on rebuild. | Makes this the family's *only* list — the retention linchpin. | Small–medium |
| **P1.5 One cost number** — use the H-E-B provider everywhere (review + home + shopping); delete the heuristic from UI paths (keep it engine-internal for scoring). | Numbers that agree = numbers you trust. | Small |
| **P1.6 Housekeeping trio** — persist theme; wire reset/unblock UI ("recipes I've said never again" list in settings); mark plans reviewed to stop double-counting. | Removes the sharp edges users hit exactly once and never forgive. | Small |
| **P1.7 Engine test suite** — unit tests for filters (incl. every allergen), scoring invariants, shopping-list consolidation, learning math. | Insurance for every future session, human or AI. | Medium, zero product risk |

### P2 — Product enhancements

- **Day-aware planning:** drag meals between days; per-day "busy night" flag steers quick recipes there. (This is what makes the Schedule tab earn its existence.)
- **Recipe browser + manual picks:** search/filter the library; pin a recipe into the week ("taco Tuesday").
- **Sync v2:** sync pantry/profile/learning too; merge shopping checks at item level; verify/tighten Supabase RLS.
- **Finish the learning loop:** use the four learned dials + profile spice level + cooking skill vs difficulty in scoring.
- **Imported-recipe quality pass:** either enrich the 311 imports (real servings/times) or curate down to the best ~100 — quality over count. Exclude allergen-uncertain imports for users with allergies.

### P3 — Future ideas

- **Claude-powered planning** (you already have API experience): natural-language Sunday intake — "soccer Tuesday, guests Friday, use up the brisket" — mapped onto the existing deterministic engine as constraints. The pure-engine architecture makes this a clean add, not a rewrite.
- Plan history & "cook it again" from past weeks; notifications ("defrost the chicken"); H-E-B curbside deep links; widgets; multi-store providers.

### Recommended first milestone

**Milestone 1 = P0.1 + P0.2 + P0.3 + P1.1 + P1.5 + P1.6.** All small, independent, low-risk changes; together they make the app *safe, honest, and non-destructive*. Roughly one focused session. Ship it, live with it for a week, then do Milestone 2 (P1.2 variety + P1.3 fast path — the "wow, it's actually smarter" release) and Milestone 3 (P1.4 shopping + P1.7 tests).

Grouping guidance: P0.1 and P1.7 pair naturally (write the allergen tests while fixing the bug). P0.2 should stay isolated (touches plan lifecycle — the riskiest area). P1.2 and P1.3 pair (both touch intake/plan generation).

---

## 12. Making It Feel Effortless & Delightful

Small touches with outsized emotional payoff, in rough order of value-per-effort:

1. **The right answer at a glance.** Open the app any evening → tonight's actual meal, huge, with a "start cooking" state. (P1.1 is the prerequisite.)
2. **One-tap Sundays.** "Same as last week?" → Confirm → done. The ritual becomes a habit, the habit becomes trust.
3. **Explainable picks.** One line under each suggested meal: "Uses your ground beef · you rated Thai ★5 last month." People trust recommendations they can see the reasons for — and you already compute every one of these signals.
4. **The list that survives the store.** Manual items, checks that never vanish, spouse's checks appearing live. Whoever's pushing the cart with a toddler should never have to think.
5. **Celebrate the streak.** "4 weeks planned · $87 under budget this month · 12 new recipes tried." Quiet proof the app is earning its place.

---

## "What Would I Do If This Were My Product?"

Ignoring incremental thinking, here's my two-year founder view.

**The product is not a meal planner. It's the elimination of a weekly argument.** Every feature decision should be tested against one scene: it's 5:40pm on a Wednesday, one parent is holding an infant, the other just got home, and somebody asks "what's for dinner?" If the app answers that in one glance, it wins. Everything else is supporting cast.

**Bet 1 — Make Sunday disappear.** The endgame of the questionnaire is *no questionnaire*. Week 1–4: the fast path (one confirm screen). Month 2–6: the app *proposes* the week Saturday night via notification — "Here's next week. Approve?" — because after a month of ratings and history it genuinely knows enough. The questionnaire becomes the exception (something changed), not the ritual. Every release should remove taps from Sunday.

**Bet 2 — Own the shopping trip, not just the list.** The list is the app's weekly moment of physical-world truth. Manual items, bulletproof spouse sync, and eventually H-E-B curbside handoff (build the cart, tap once to send it). The day the family stops keeping any other grocery list is the day this app becomes uninstallable-in-the-good-sense.

**Bet 3 — LLM on top of the deterministic engine, not instead of it.** You built the right substrate: pure filters and scoring that are fast, free, private, and predictable. The 2026-era move is a thin Claude layer that translates messy family reality ("Ramadan starts next week," "guests Friday," "use up the brisket," "kids are on a plain-food strike") into constraints the deterministic engine executes. You get magic input with auditable output — and hard safety properties (allergies) stay in deterministic code where they belong, never delegated to a model.

**Bet 4 — Quality over quantity in the library.** 541 recipes sounds impressive; 311 of them have guessed times, guessed nutrition, and guessed allergens. I would rather ship 250 recipes a Texas family will actually cook — verified data, real photos, honest 30-minute claims — than 541 where every fourth pick disappoints. Disappointing dinners are the churn event for this app. Curate ruthlessly; re-expand with verified imports later.

**What I would cut:** special occasions (speculative), the adventurousness slider (the learning system will infer it), multi-store providers before H-E-B is nailed, and any temptation to add breakfast/lunch before dinner is flawless. Depth on the dinner problem beats breadth every time.

**The two-year picture:** Year 1 — dinner, one store, one family, flawless: right meal at a glance, one-tap Sundays, a shopping list the household actually lives by, an engine with memory. Year 2 — the proposal model (app plans first, family approves), calendar-aware day scheduling, natural-language constraints via Claude, and only then broader stores/meals. If in two years your wife has stopped thinking about weekday dinners entirely and can't tell you when she last "planned a week," the product succeeded.

---

*No code has been modified. PROJECT.md has been drafted as the canonical reference for future sessions (delivered alongside this audit). Awaiting your approval on Milestone 1 before any implementation.*
