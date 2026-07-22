# PROJECT.md — Weekly Meals

> **The canonical reference for every development session (human or AI).**
> Read this before touching code. It describes how the app *actually* works,
> verified by reading the implementation. Where `docs/ARCHITECTURE.md` disagrees
> with reality, **this file wins** (that file is stale and partly fictional).
> If reality and this file disagree, **fix this file in the same change.**
>
> **State: Milestone 4 COMPLETE; Milestone 5 partly shipped (PARKED July 2026).**
> **M4** ("Real Dinners, Right-Sized" — see `MILESTONE-4.md`): M4.0 (fixes +
> virtualized browse), M4.1 (household composition → adult-equivalent servings),
> M4.2 (a dinner is a plate, not a dish — composed main + sides), M4.3
> (waste-fit scoring + `checkWasteFit.ts` + "used in N meals" caption), M4.4
> (per-recipe family notes, synced), M4.5 (component re-roll — keep a plate
> part), M4.6 (rearrange the approved week — swipe "Move to…" swap; drag
> deferred), M4.7 (bugfixes: syncNow pull-before-push, shopping-list dedup by
> ingredient identity) — all shipped and deployed.
> **M5** ("Look Back, Look Better" — see `MILESTONE-5.md`): M5.0 (rolling
> 6-week "Past weeks" archive, per-device), M5.2 (adversarial bug sweep — no
> P0s, all P1/P2 fixed), M5.3 (Vercel branch previews; production stays on
> GitHub Pages) shipped; **M5.1 (recipe photos) live but partial** — 55
> vision-screened exact matches wired, 20 "plausible" in `PHOTO-REVIEW-2.md`
> pending Ronnie; **M5.4 (household-synced user recipes) confirmed-next, not
> started.** A Basil green retheme (separate design session) is also live.
> **Open priority is process, not a feature: the independent advisor close-out
> audit of M4.3–M4.7 + M5.0–M5.1** (see `ADVISOR-HANDOFF.md` Part 6) — that
> range self-reviewed; the M5.2 sweep is not a substitute.
> **Last verified:** July 2026 · typecheck clean · 398 tests green ·
> 230/230 curated recipes + 50/50 sides/sauces pass content validation,
> 636/636 recipes use canonical allergen labels and plausible `provides` ·
> `checkWasteFit`/`checkIngredientConsistency`/`checkCuratedWeighting`/
> `checkKidApprovedWeighting` all PASS.
>
> **Advisor context, decision rationale, and current open items live in
> `ADVISOR-HANDOFF.md`. Read that too.**

---

## 1. What this app is

A meal-planning app for one family (2 adults, 2 young kids, Houston TX, shops at
H-E-B). Each week it asks a short questionnaire (or a one-tap "same as last week"),
generates a week of dinners from a ~586-main library, composes each main with 0–2
sides/sauces from a 50-recipe sides library (M4.2 — a dinner is a plate, not a
dish), and produces one consolidated H-E-B shopping list with estimated prices. The
family cooks from the app, re-rolls meals mid-week from ingredients already bought
(evaluated on the whole plate, not just the main), rates as they go, and those
ratings nudge future recommendations.

**Product owner is a non-programmer** (an anesthesiologist, engineer-minded).
Communicate in plain English; make routine engineering decisions autonomously
(simplest maintainable option); involve him only for product vision, UX, feature
behavior, privacy, or significant architectural tradeoffs — and then recommend one
option with reasons.

**Mission (the test for every feature):** does it meaningfully reduce decision
fatigue for a busy family? Remove clicks rather than add settings.

## 2. Technology stack

- **Expo SDK 56 / React Native 0.85 / React 19** — one codebase; delivered as a
  **web app** (installed on iPhones via Safari → Add to Home Screen)
- **expo-router** — file-based navigation (`app/` = screens; typed routes on)
- **TypeScript (strict)** — path alias `@/*` → `src/*`; `npm run typecheck` must stay green
- **Zustand** — state management (`src/stores/`)
- **AsyncStorage** — local persistence (localStorage/IndexedDB on web)
- **Supabase REST (raw fetch, no SDK)** — optional "household sync" between two
  phones; publishable key committed by design, **RLS is a permanent, informed
  accepted risk, not a fix in progress** (see §8)
- **Jest / jest-expo** — engine + `src/data/import` test suite, plus one deliberate
  store-level exception (`src/stores/syncStore.test.ts`, M4.7 — see `jest.config.js`)
  (**377 tests**); `npx jest` must stay green
- **expo-keep-awake** — cook mode only (sanctioned dependency)
- **GitHub Pages** — web deploy via `.github/workflows/deploy-web.yml`, fires on
  every push to `claude/weekly-meals-app-eyowlr`. **Every push is a deploy.**

## 3. Layered architecture (actual, verified)

```
app/ (screens, thin)  →  src/stores/ (Zustand: orchestration + persistence calls)
                          →  src/engine/ (pure logic — no React, no I/O)
                          →  src/domain/ (pure types + constants; depends on nothing)
src/data/ (edges): repositories (AsyncStorage), H-E-B price table, seed recipes,
                   Supabase sync, recipe/photo importers
src/ui/   (theme tokens light/dark + reusable presentational components)
```

**Rules that must hold:**
- `engine/` and `domain/` contain **no React and no I/O**; pure functions take
  everything as arguments. This purity is what makes the test suite possible — protect it.
- All persistence flows through a repository; never call AsyncStorage directly
  (only `kvStore.ts` touches storage).
- Grocery pricing behind `GroceryProvider`; recommendations behind
  `RecommendationProvider`. Swap implementations at the edges, never touch UI.
- No native-only API without a web fallback (web is the delivery platform).
- Theme values only via `useTheme()` — no hardcoded colors/spacing; light + dark both work.

## 4. Repository map

```
app/(tabs)/       index (This Week) · schedule · shopping · recipes · profile + custom tab bar
app/plan/         intake wizard (with "same as last week" fast path) → review.tsx
app/review/       weekly ratings wizard (now a catch-up for unrated meals only)
app/cook/         full-screen guided cook mode (steps, timers, keep-awake)
app/meal/ recipe/ pin/ reroll/   detail, pin-to-week, re-roll flows
app/household.tsx sync setup · app/settings.tsx theme

src/domain/       models (Recipe — `role`/`provides` + `isMain()`, M4.2;
                  PlannedMeal — `sideRecipeIds`/`sidesChangedAtISO`, M4.2 part 2 —
                  Profile, IntakeAnswers, WeeklyPlan, ShoppingList, ManualItem,
                  RatingEvent, PreferenceProfile) + constants (cuisines, H-E-B
                  dept order, canonical allergen list, chips)
src/engine/       recommendation/ (filters · scoring [scoreRecipe + M4.2's
                  scoreSide] · LocalRecommendationEngine) · mealComposition
                  (M4.2 part 2: composeSides, pure, best-effort) · shoppingList ·
                  cost · learning · season · schedule · reroll · rating ·
                  syncMerge · manualItems · recipeSearch · cookMode (M4.2:
                  composeCookSteps/cookModePlateKey) · userRecipes · portions
                  (M4.1: household → adult-equivalent servings) · planHistory
                  (M5.0: archivePlan — dedupe/sort/cap for the rolling 6-week
                  per-device archive)    (+ a .test.ts beside almost every module)
src/data/seed/    230 hand-curated mains (batches 1–8, cookbook-grade content) +
                  recipeImported.ts (356 TheMealDB imports, GENERATED — never
                  hand-edit) + recipeSides.ts (50 hand-curated sides/sauces,
                  M4.2). All three are merged into one `RECIPES` pool
                  (recipes.ts) — anything picking "a main" (generation, re-roll,
                  swap, the Recipes browse tab) filters through `isMain()`;
                  nothing else needs to, since `getAnyRecipe`/shopping
                  list/cook mode/meal detail resolve a side id exactly like a
                  main id.
src/data/import/  normalize.ts (import heuristics incl. M4.2's `inferProvides`/
                  `unsupportedProvides`) + themealdb-raw.json (a frozen
                  snapshot of TheMealDB's raw API response; scripts/
                  importRecipes.ts regenerates recipeImported.ts from this
                  fixture, not a live fetch — see §10)
src/data/grocery/heb   curated price table, per-lb conversion, dept fallbacks
src/data/repositories/local   kvStore (AsyncStorage JSON) + one repo per aggregate
src/data/sync/    config.ts (URL/key/kill-switch) · householdApi.ts (row by 6-char code)
src/stores/       planStore · profileStore · pantryStore · learningStore ·
                  settingsStore · syncStore · manualItemsStore · cookModeStore ·
                  userRecipesStore · recipeNotesStore (M4.4) · planHistoryStore
                  (M5.0, per-device — not household-synced, same class as
                  cookModeStore)
scripts/          validateRecipes · importRecipes · importPhotos ·
                  checkCuratedWeighting · checkKidApprovedWeighting
```

## 5. Key data flow (the weekly loop)

1. **Intake** (`plan/index`): full wizard, or a one-tap **"same as last week"** fast
   path (proteins + what's in the fridge only) → `generate()` → **draft** plan.
   A new draft never destroys the live approved plan until approval.
2. **Review** (`plan/review`): lock / swap / regenerate / **pin a favorite** / adjust
   any draft meal's **servings** (a −/+ stepper, no confirmation needed pre-approval) →
   `approve()` → status `approved`; shopping list built (scaled by servings, pantry
   staples + on-hand items excluded, priced by the H-E-B provider) and persisted.
   **Deduped by ingredient identity, not exact string match (M4.7):** two lines merge
   when they share a `canonicalIngredientName` (trims/lowercases, folds a simple
   trailing plural — "carrots"/"carrot" are the same ingredient) AND a unit family —
   mass (`g`/`kg`/`oz`/`lb`), volume (`ml`/`l`/`tsp`/`tbsp`/`cup`), or, for anything
   else (`piece`/`clove`/`can`/`bunch`/`pinch`), the exact unit itself, since those
   never convert. A cross-unit merge (e.g. curated `1 lb` + imported `700 g` ground
   beef) sums in the base unit and displays in whichever of the two units actually in
   play has the larger conversion factor — see `src/engine/ingredientKey.ts`. This is
   why the same real-world ingredient from a curated main, an imported side, and a
   composed side all land on one line instead of three. **Cost shown at approval
   equals the shopping tab's total** (single source of truth).
   - **Servings (M4.1):** `IntakeAnswers.servingsPerMeal` (not a flat headcount) drives
     generation — `src/engine/portions.ts`'s `adultEquivalents(members)` converts
     `Profile.members` (each `{ name?, ageYears?, isChild, eatsLikeAdult? }`) into a
     fractional adult-equivalent number (rounded to the nearest 0.5, floored at 2.0 —
     but the floor only applies once there are 2+ members, so a genuine single adult
     reads as 1.0, not 2.0; the floor exists to stop a real couple/family rounding
     down below 2, not to inflate one person). `ageYears` is a plain number the user
     types in and updates by hand as a child grows (no birthdate, no date parsing —
     kept deliberately simple). `familySize` is an **invisible migration-only
     fallback**: read in exactly one place, `servingsPerMeal()`, when `members` is
     empty (so a profile saved before M4.1 still computes a sane number on first
     load) — there is no visible "Family size" control on the Profile screen anymore,
     and once a household has any members, `familySize` is never read again.
     `usePlanStore.generate()` re-reads the live profile immediately before generating
     (never trusts stale wizard state). `PlannedMeal.servings` can also be adjusted
     per-meal (a stepper on the meal card / meal detail, plus a "Cook extra for lunches
     (+2)" shortcut).
   - **Composed plates (M4.2 part 2):** every main gets 0–2 sides/sauces composed
     onto it — `LocalRecommendationEngine.generate()` calls `composeSides(main,
     sidesPool, ctx)` for each selected main, same at a draft `swapMealTo`. Pure,
     best-effort, capped at 2: fills the hard minimum (protein + vegetable/starch)
     first, then the full target (protein + vegetable + starch), only considering a
     sauce once the hard minimum is already met, never adding a side that duplicates
     what's already on the plate. Every side candidate passes the exact same hard
     filters a main does (allergies, diet, dislikes, blocked, combined time budget)
     — a side is food, it can hurt someone just as badly as a main. Scored with
     `scoreSide` — every `scoreRecipe` signal except `varietyBonus` (which is
     main-vs-week-scoped and inverts into the wrong signal at plate scope), plus a
     small cuisine-fit bonus against the main. `sideRecipeIds` flows into
     `buildShoppingList`/cost through the exact same per-recipe path as the main —
     one source of truth, unchanged. Some curated mains (a frozen, reviewed
     allowlist in `scripts/validateRecipes.ts`) are honestly protein-light and stay
     that way if nothing in the sides pool can close the gap that week — no error
     state, no nagging copy.
   - **Waste-fit scoring (M4.3, fully landed):** `src/engine/wasteFit.ts` adds
     a small, capped scoring bonus (`WEIGHTS.wasteFit = 0.5`, chosen by an
     evidence-based sweep against `checkWasteFit.ts` — see below — and kept
     under half of `variety`'s 1.3) when a candidate main or side reuses a
     **whole-unit perishable** (Produce/Meat/Seafood/Dairy/Bakery, bought as an indivisible
     piece/bunch/can, or under 1 lb/kg/l) that another meal already fixed for
     the week has forced onto the shopping list without consuming the whole
     unit — the "half a cabbage goes to waste" problem. `generate()`,
     `rerollCandidates`, and every `composeSides` call site in `planStore.ts`
     pass `weekRecipes` (the week's other fixed mains/sides) through
     `GenerateContext` for this comparison. A tie/near-tie breaker only —
     never enough to bury a better dish or beat variety.
     `scripts/checkWasteFit.ts` measures it the same way `checkCuratedWeighting
     .ts`/`checkKidApprovedWeighting.ts` measure their bonuses: 100 simulated
     weeks, twice each (bonus on vs. `weightOverrides: { wasteFit: 0 }`,
     random draws seeded identically per pair so the comparison isolates the
     weight's effect from the engine's own near-tie randomness), reporting the
     average count of whole-unit perishables used by only one day that week
     — reliably shows a measurable reduction. On the shopping list, any
     plan-derived (not manual) whole-unit item shared by 2+ meals gets a
     quiet "used in N meals" caption under its quantity line — display only,
     never touches the list (Product Law #1); see `app/(tabs)/shopping.tsx`'s
     `PlannedRow`.
3. **During the week:** meals map to **real calendar dates** ("Tonight" means
   tonight). Cook mode (composed steps: the main's, then each side's, each side's
   first step carrying a "Side: X"/"Sauce: X" section label; cook-mode progress is
   keyed by a content-addressed `cookModePlateKey`, so a side removed, swapped, or
   changed via sync resets progress to the start instead of landing on a different
   dish's step), cooked toggles, shopping check-offs, **rate-as-you-go** (stars on
   any meal any time, visible on cards), **strict mid-week re-roll** (evaluated on
   the WHOLE PLATE, M4.2 part 2 — a candidate main's composed sides are checked
   against pantry + this week's list + staples too, and the exact plate shown as a
   candidate is the exact plate committed, never recomposed at commit time; **M4.5
   component re-roll** adds a Keep lock toggle per plate part on the re-roll screen —
   keep nothing for the unchanged whole-plate re-roll just described; keep the main to
   re-roll only the sides (commits via `rerollSidesOnly`: sides + `sidesChangedAtISO`
   only, `cooked`/`rating` untouched since the dish itself didn't change); or keep a
   side/sauce to re-roll only the main (commits via `commitComponentReroll`: a new
   dish, full body stamp, `cooked`/`rating` cleared). Both M4.5 commit paths
   **re-apply the allergy guard at the point of replacement** (Law #5) rather than
   trusting the screen's held candidate is still safe, rejecting the whole commit —
   never a partial substitution — if anything fails; coverage still applies to the
   WHOLE PLATE either way. Cook-mode progress invalidates automatically with no
   special-casing: `cookModePlateKey` is content-addressed over the main id + sorted
   side ids, so any sides change already yields a different key),
   **manual grocery items**, favorites, kids-approved badges. A servings change on an
   **approved** plan (Law #1) never touches the shopping list by itself — it shows the
   exact delta ("you'll need 0.4 lb more chicken thighs") behind an explicit "Update
   shopping list" / "Reduce shopping list" button; declining leaves the list untouched
   — a side can also be removed from the plate ("no sides tonight" is a real, explicit
   choice) with the same explicit-button pattern before the shopping list is touched.
   **Recipe notes (M4.4):** one free-text note per recipe (not per cooking),
   household-synced, display only — never feeds scoring. Edited inline on the
   recipe/meal detail screen (`app/meal/[id].tsx`, a "Family notes" section under
   Steps — "+ Add a note" / Edit / Save / Cancel; saving empty text clears it), and
   flagged with a small quiet glyph next to the recipe name on `MealCard` and
   `RecipeResultCard` wherever those are shown (This Week, Schedule, Recipes browse,
   plan review). Belongs to the recipe, not the plan, so it survives re-rolls, plan
   changes, and week rollovers untouched.
   **Rearranging the week (M4.6, fully shipped):** an approved week's not-yet-cooked
   days can be swapped via `usePlanStore.moveMeal(fromDay, toDay)` — the ENTIRE meal
   body (recipe, sides, servings, rating, cooked flag, locked) travels with the dish
   to its new day, never the shopping list (same food, different night). A cooked
   day can never be moved into or out of. UI: swiping a not-yet-cooked meal card on
   This Week or Schedule (`SwipeableMealRow`, mirroring the shopping tab's
   swipe-to-delete gesture on manual items) reveals a "Move to…" action that opens a
   bottom sheet (`MoveMealSheet`, structured like the plan-review "Swap in…" sheet)
   listing every other not-yet-cooked day with its real date and what's currently on
   it ("Swap with: {dish}") — choosing a row is the confirmation. `eligibleMoveTargets`
   (`src/engine/rearrange.ts`) computes that list using the exact same guards
   `moveMeal` enforces, so the UI never offers a day the store would reject, and the
   swipe action itself doesn't render at all when no eligible day exists. Drag-and-drop
   was considered and explicitly deferred (Product Owner's call, `MILESTONE-4.md`
   §M4.6) — swipe "Move to…" is the only rearrange gesture that shipped.
4. **Learning:** ratings are the source of truth and the `PreferenceProfile` is
   **recomputed from the full rating history** on every change (structurally
   immune to double-counting). Cuisine/protein/technique/vegetable affinities and
   the learned dials (spice, complexity, budget, leftovers) all feed scoring with
   capped weights; hard filters always win.
5. **Sync (optional):** plan, shopping list, manual items, favorites, kid-approved
   flags, and recipe notes sync between two phones (~20s poll, 600ms debounced push)
   with **per-item / per-meal deterministic merging** (see §6).
6. **Past weeks (M5.0):** on approval, or on adopting a genuine week-replacement
   synced from the other phone, the outgoing week joins a rolling 6-week
   per-device archive (`usePlanHistoryStore`, NOT synced — same class as cook-mode
   progress), browsable read-only as a collapsible "Past weeks" list below the
   current week on the Schedule tab.

## 6. The sync merge contract (the most dangerous code in the app)

Merging is **deterministic, commutative, and idempotent** — both phones must compute
the identical result regardless of order, or they ping-pong forever.

- **Per-field newer-timestamp-wins**; a missing timestamp = epoch 0; ties resolve
  deterministically (a real toggle is never silently lost).
- **`recipeChangedAtISO` gates meal-body divergence:** if two devices hold different
  recipes for the same day, the newer stamp wins the **entire meal body** — a rating,
  cooked flag, servings value, or `sideRecipeIds` must never attach to a dish that was
  replaced by a re-roll or a pin. `servings` (M4.1) merges the same way `rating` does
  — its own `servingsChangedAtISO` stamp, newer-wins, independent of `cooked`/`rating`.
  `sideRecipeIds` (M4.2 part 2) merges the identical way via its own
  `sidesChangedAtISO` stamp — one phone swapping a side while the other re-rolls the
  same day still converges: the re-roll's `recipeChangedAtISO` wins the whole meal
  body (sides included), regardless of how fresh the losing side's
  `sidesChangedAtISO` happens to be. **M4.5's `rerollSidesOnly`** (the keep-the-main
  commit path) never touches `recipeId`/`recipeChangedAtISO`, so a sides-only change
  from it merges as an ordinary field edit — independent of `rating`/`servings`,
  both survive a race against either — and loses cleanly to a real re-roll on the
  other phone via the same `recipeChangedAtISO` gate as any other sides edit.
- **Shopping-list sync merging (`mergeShoppingLists`'s `itemKey`) is still exact
  `ingredientName|unit`, unchanged by M4.7's build-time dedup.** That's fine, not a
  gap: both phones build a list from the identical `buildShoppingList` code against
  the identical plan data, so they always arrive at the same already-merged lines
  (same canonical name, same elected display unit) before sync ever compares them —
  `itemKey` only ever needs to match two copies of the SAME line. The one edge case
  this doesn't smooth over is a household mid-upgrade (one phone on the old
  per-exact-unit build, one on the new one) producing differently-shaped lines for
  the same plan; sync's existing union-of-keys fallback treats that exactly like any
  other one-sided item today — an accepted, temporary rough edge until both phones
  are current, not a new risk.
- **Manual items** are keyed by **normalized name** (two people adding "milk"
  converge to one row) and deleted via **tombstones** (a delete is never resurrected
  by a phone that hasn't caught up). They are **not plan-scoped**: on approving a new
  week, checked items clear (bought) and unchecked items carry over. **Reviving a
  tombstoned key (re-adding a cleared item) stamps `checkedAtISO` with the current
  time, not `null`** — a null timestamp reads as older than any real one, so a stale
  remote `checked: true` from before the delete would otherwise win the merge and
  resurrect the item pre-checked (M4.7).
- **`syncNow()` pulls before it pushes.** Push unconditionally overwrites the remote
  row and records that write's own `updated_at` as "last synced," so pushing first
  makes the very next pull see itself as already caught up and skip merging the
  partner's state — exactly the reconcile `app/plan/review.tsx`'s approve flow depends
  on before `clearChecked()` runs (M4.7 — previously `syncNow()` pushed first and
  silently dropped the partner's still-unmerged check-offs).
- **Recipe notes (M4.4)** merge per `recipeId`, newer `updatedAtISO` wins, same pattern
  as favorites/kidApproved; not plan-scoped, so they merge unconditionally regardless
  of which plan branch fires. A cleared note is saved as an empty-text record, not a
  deleted key — emptiness is its own tombstone, so a clear beats a stale non-empty copy
  whenever it's newer. Two people editing the same note in the same poll window: the
  later save wins the whole text, no merge-of-text (accepted limitation).
- **Rearranging the week (M4.6 part 1):** `moveMeal` (`src/engine/rearrange.ts`) stamps
  `recipeChangedAtISO` on BOTH affected meals with the same swap timestamp, so a remote
  device adopts both whole bodies together via `resolveDivergedRecipe` instead of
  mixing halves of two different swaps; a cross-day rating race (one phone swaps while
  the other rates the pre-swap dish on one of the two days) resolves deterministically
  in both merge orders, with the rating dropped — same accepted class as the existing
  re-roll-vs-rate race — since the merge resolves per `dayIndex`, not per dish.
- Plan-level fields (intake, weekStartISO) remain whole-payload last-write-wins.
- Every sync change ships with assertions for both merge orders, idempotence, and the
  specific race the feature introduces.

## 7. Product laws (violating these is a bug, even if the code "works")

1. **Never silently modify the shopping list.** Features may say "you'll need X, Y"
   and offer an **explicit** add button. Nothing adds/removes items unasked. (Applies
   to re-roll, pin-to-week, and everything after.)
2. **Strict re-roll:** a mid-week re-roll only offers meals cookable from pantry +
   this week's list + staples. No surprise store trips. If nothing qualifies, show
   near-misses labeled with exactly what's missing. **Since M4.2 part 2, this applies
   to the WHOLE PLATE** — main and composed sides together, not the main alone; a
   candidate's sides are checked for coverage too, and the plate offered as a
   candidate is exactly the plate committed (never recomposed at commit time).
   **M4.5 component re-roll (keep a plate part) is still whole-plate coverage** — only
   the part(s) not kept are re-rolled, but the kept part(s) plus every candidate are
   still checked against pantry + this week's list + staples exactly as before; keeping
   something never loosens the strictness.
3. **Never ask a question the code doesn't act on** — and never promise a capability
   in UI copy that doesn't exist.
4. **Allergy filtering is deterministic and safety-critical.** Never delegate it to a
   model. Any change ships with tests in the same commit. Imported (`mealdb-`)
   recipes are **excluded entirely** whenever any profile allergy is set (their
   allergen data is keyword-guessed), and always carry an "allergen info estimated"
   note on their detail screen. A side is food; it can hurt someone just as badly as
   a main — every side candidate passes the exact same hard filters a main does
   (M4.2 part 2, `composeSides`).
5. **Pinning bypasses candidate generation** — so the pin action itself must enforce
   the allergy guard. (Reusing a code path silently reuses its assumptions.) **M4.2
   part 2 extends this to sides:** pinning a main composes fresh sides the same way
   generation does, then re-checks `passesAllergySafety` on every composed side
   explicitly — defense in depth, never trusting that `composeSides`' internal
   filtering alone was enough. Also store-level, not just an absent UI button: a
   side/sauce is never independently pinnable as a whole dinner (`pinRecipeToWeek`/
   `pinRecipeToDraft` reject a non-main `recipeId` outright). **M4.5 extends this to
   component re-roll:** reusing `rerollMeal`'s commit path for a candidate the screen
   has been holding since preview taught us the same lesson again. `commitComponentReroll`
   (keep-the-sides, or no-keep, commit path) re-checks `passesAllergySafety` + `isMain`
   on the candidate's main and `passesAllergySafety` + `!isMain` on every one of its
   sides, and rejects the WHOLE commit — never a partial substitution — if anything
   fails, so the plate committed is always exactly the plate the screen showed.
   `rerollSidesOnly` (keep-the-main commit path) does the identical
   `passesAllergySafety`/`!isMain` re-check on every incoming side id, but drops any
   failing or unresolvable id instead (the main isn't changing, so there's no "whole
   plate" to reject — only the ids arriving are ever suspect).
6. **Bug-free beats feature-rich. Always.**

## 8. Known issues

**`DEBUG-SWEEP.md`'s P0-1, P1-1, P1-2, P2-1, P2-2, P2-3 are all closed** (tree-nut
allergen mismatch, missing allergen validator, stale schedule-screen copy, cook-mode
wake lock, `weekStartISO` UTC bug, `kvStore` shape guard — see that file for detail
and `git log` for the fixing commits). P3 items remain parked (dead `reset`/`clear`
store actions with no UI · no keyboard-avoidance around the inline manual-item editor
· `docs/ARCHITECTURE.md` drift).

**Accepted risk (permanent — not open, not "in progress", not to be re-flagged)**

1. **Supabase `households` has no Row-Level Security.** Confirmed live: an anonymous
   client using the bundled publishable key can enumerate every household code —
   equivalent to full read/write of every family's plan and dietary data. **This is
   declined as a standing, informed choice by the Product Owner (Ronnie, July 2026),
   not a bug to be fixed or a risk to be periodically reassessed.**
   **Rationale (verbatim):** "the only data in household sync is one family's meal
   plan, shopping list, manual items, favorites and kid-approved flags; the owner
   judges the exposure of that data — and the vandalism risk from anonymous write
   access — to be beneath the cost of acting on it. The app is used by two phones in
   one household and is not shared."
   **Profile-sync is a planned, knowingly-accepted extension of this same exposure,
   not a new decision point:** when household composition (members' abbreviated names
   and ages) starts syncing, that data lands on the same unsecured database under the
   same rationale. There is no reopen trigger tied to that milestone — this is the
   standing decision.

**Live sync notes (M4.1)**

2. **Household composition does not sync.** `Profile.members` (M4.1) is local-only —
   `SyncPayload` (`src/data/sync/householdApi.ts`) carries `plan`/`shoppingList`/
   `favorites`/`kidApproved`/`manualItems` only. Profile-sync (see the accepted-risk
   note above) is the planned next step for this.
3. **A newly-approved plan sometimes doesn't appear on the second phone** — resolved
   after the M4.1 updates. If it recurs, investigate as a merge race.

**Accepted edges (July 2026 adversarial sweep of M4.3–M4.7).** The sweep found
no P0s; its three P1s (F1 disclosure layer, F6 stale servings prompt, F7
waste-fit self-double-count) and two P2s (F4 rename revive-stamp, F8a archive
hydration race) are FIXED. These remaining edges are knowingly accepted, not
open bugs:
1. **Sub-0.01-display-unit co-contributor swallow (F2).** A merged shopping
   line whose two sources differ by less than the display unit's rounding
   floor (≈2 g on a pounds-displayed line) can be zeroed out by removing the
   larger source. Contrived magnitudes; real recipes don't sit there.
2. **Approve while offline/unsyncable (F3).** `onApprove` reconciles via
   `syncNow()` before `clearChecked()`; if that pull fails (offline, Supabase
   hiccup, or the partner simply hasn't pushed yet), checked items clear
   against local-only state and the partner's un-pulled check-offs survive
   until the next successful approval-time sync. Narrow window; the fix would
   be a "couldn't reach the other phone" notice, deferred.
3. **Double-approval archives a never-cooked week (F8b).** In a two-phones-
   approve-at-once race, the losing phone archives its own just-approved,
   never-cooked plan as a "past week." Cosmetic on a read-only surface.
4. **recipeNotes tombstones accumulate.** A cleared note keeps an empty-text
   entry forever; the map grows unbounded. Trivial at family scale.
Also fixed after the initial sweep pass: F5 (`rerollMeal`/`rerollSidesOnly`/
`commitComponentReroll` now no-op on a cooked target, and the two
component-reroll paths take an `expectedRecipeId` so a preview raced by a
synced change commits nothing) and the name-fold audit gap
(`checkIngredientConsistency.ts` now performs the collision check
`ingredientKey.ts` references). The whole M4.3–M4.7 sweep is closed except
the four accepted edges above.

## 9. Roadmap

**Milestone 5 — "Look Back, Look Better"** (`MILESTONE-5.md`) is the current
milestone, PARKED mid-flight (July 2026):
- **M5.0** — rolling 6-week per-device "Past weeks" archive on the Schedule
  tab. ✅ Shipped (`src/engine/planHistory.ts`, `planHistoryStore`).
- **M5.1** — recipe photos at scale. 🚧 Live but partial: 55 vision-screened
  exact matches wired into `recipeImages.ts`; 20 "plausible" candidates await
  Ronnie in `PHOTO-REVIEW-2.md`; 82 recipes keep the cuisine tile.
- **M5.2** — adversarial parking-lot bug sweep of M4.3–M4.7. ✅ Done (no P0s;
  F1/F6/F7 P1s + F4/F8a/F5 P2s + the name-fold audit gap all fixed; four edges
  accepted, see §8).
- **M5.3** — Vercel branch preview deploys (production stays on GitHub Pages).
  ✅ Shipped (`vercel.json`; repo connected in Ronnie's dashboard).
- **M5.4** — household-synced user recipes. ⬜ Confirmed-next, not started.
- **Do first, not a feature:** the independent advisor close-out audit of the
  whole M4.3–M4.7 + M5.0–M5.1 range (that range self-reviewed — see
  `ADVISOR-HANDOFF.md` Part 6).

**Milestone 4 — "Real Dinners, Right-Sized"** (`MILESTONE-4.md`) is complete
history, all shipped and deployed:

- **M4.0** — three bug fixes + virtualized recipe browse list. ✅ Shipped.
- **M4.1** — household composition → adult-equivalent servings. ✅ Shipped, revised
  (plain editable age, no birthdate; `familySize` demoted to invisible fallback).
- **M4.2** — a dinner is a plate, not a dish (main + sides composition). ✅ Shipped,
  both parts: the data model (`Recipe.role`/`Recipe.provides`, curated `provides`,
  `recipeSides.ts`, validator gates) and actually composing plates at generation
  time (`mealComposition.ts`, shopping list, cost, cook mode, meal detail UI,
  whole-plate strict re-roll, sync).
- **M4.3** — waste-fit scoring bonus (use the whole cabbage). ✅ Shipped: scoring
  bonus, `checkWasteFit.ts` harness, shopping-list "used in N meals" caption.
- **M4.4** — per-recipe notes, household-synced. ✅ Shipped: data + sync layer,
  the "Family notes" editor on meal detail, and the card glyph on This
  Week/Schedule/Recipes/plan review.
- **M4.5** — component re-roll (keep a side/sauce, regenerate the rest). ✅ Shipped:
  `rerollCandidates`' `keep?: RerollKeepOptions` engine mode, `previewComponentReroll`/
  `rerollSidesOnly`/`commitComponentReroll` store actions (both commit paths re-apply
  the allergy guard, Law #5), Keep lock toggles on the re-roll screen, and sync
  assertions for the sides-vs-rating and sides-vs-full-re-roll races.
- **M4.6** — rearrange the week after approval. ✅ Shipped: engine
  (`moveMeal`/`eligibleMoveTargets` in `src/engine/rearrange.ts`) + store
  (`usePlanStore.moveMeal`, approved-only, cook-mode progress swap) + swipe
  "Move to…" UI (`SwipeableMealRow`, `MoveMealSheet`) on This Week and
  Schedule. Hold-to-drag was considered and deferred by the Product Owner —
  not built.

- **Photos:** M5.1 wired 55 vision-screened matches; the old `M3.6` "verify
  every photo depicts its dish" QA is now largely folded into M5.1's screening.
  `PHOTO-REVIEW-2.md` holds the 20 plausible candidates still pending Ronnie.
- **Parked candidates (do not start without an explicit go-ahead; full list in
  `MILESTONE-5.md`):** leftovers-aware planning · thaw-tonight reminders/
  notifications (needs an iOS web-push feasibility check first) · quantity-aware
  re-roll · H-E-B Curbside / Instacart export · other stores · **calendar-aware
  planning (explicitly deferred on privacy grounds)** · an optional TestFlight
  native build (EAS cloud build; **not** a rewrite). Note: **household-synced
  user recipes is now M5.4 (confirmed-next), no longer a mere candidate.**

## 10. Operational notes for future sessions

- `npm install`, then **`npx tsc --noEmit` + `npx jest` + `npx tsx scripts/validateRecipes.ts`
  must all be green before any commit.** Update this file in the same change when
  behavior or architecture changes.
- `src/data/seed/recipeImported.ts` is **generated** — never hand-edit; change
  `normalize.ts` / `scripts/importRecipes.ts` and re-run. As of M4.2,
  `scripts/importRecipes.ts` regenerates from the **committed fixture**
  `src/data/import/themealdb-raw.json`, not a live fetch — this makes
  regeneration deterministic (a normalize.ts change only changes what that
  change actually changed, not also whatever shifted upstream on TheMealDB
  meanwhile). Refreshing the library with genuinely new upstream recipes is a
  deliberate, separate task: re-fetch, overwrite the fixture, re-run.
- Every push to `claude/weekly-meals-app-eyowlr` deploys the web build.
- Keep changes small and grouped by task; isolate anything touching the plan lifecycle,
  allergy filtering, sync, or seed data.
- **Photos:** openly-licensed sources only (TheMealDB, Wikimedia/Openverse), never
  scraped. Below a confident match, keep the cuisine-tile fallback.
