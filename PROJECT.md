# PROJECT.md — Weekly Meals

> **The canonical reference for every development session (human or AI).**
> Read this before touching code. It describes how the app *actually* works,
> verified by reading the implementation. Where `docs/ARCHITECTURE.md` disagrees
> with reality, **this file wins** (that file is stale and partly fictional).
> If reality and this file disagree, **fix this file in the same change.**
>
> **State:** Milestones 1, 2, and 3 complete (v3.0). Post-v3 adversarial debug
> sweep (`DEBUG-SWEEP.md`) P0/P1/P2 fixes landed. **Milestone 4 is in progress:**
> M4.0 landed; M4.1 (household composition → adult-equivalent servings) landed,
> revised to plain editable age (no birthdate) with `familySize` demoted to an
> invisible fallback — see §5, §6, §7 below. M4.2 part 1 (data model:
> `Recipe.role`/`Recipe.provides` + the `recipeSides.ts` library) landed —
> see §4, §5. M4.2 part 2 (actually composing plates at generation time) is
> next; nothing about generation, scoring, or the shopping list has changed yet.
> **Last verified:** July 2026 · typecheck clean · 247 tests green ·
> 230/230 curated recipes + 50/50 sides/sauces pass content validation,
> 636/636 recipes use canonical allergen labels and plausible `provides`.
>
> **Advisor context, decision rationale, and current open items live in
> `ADVISOR-HANDOFF.md`. Read that too.**

---

## 1. What this app is

A meal-planning app for one family (2 adults, 2 young kids, Houston TX, shops at
H-E-B). Each week it asks a short questionnaire (or a one-tap "same as last week"),
generates a week of dinners from a ~586-recipe library, and produces one
consolidated H-E-B shopping list with estimated prices. The family cooks from the
app, re-rolls meals mid-week from ingredients already bought, rates as they go, and
those ratings nudge future recommendations.

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
- **Jest / jest-expo** — engine + `src/data/import` test suite (**247 tests**); `npx jest` must stay green
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

src/domain/       models (Recipe — now with optional `role`/`provides`, M4.2 —
                  Profile, IntakeAnswers, WeeklyPlan, ShoppingList, ManualItem,
                  RatingEvent, PreferenceProfile) + constants (cuisines, H-E-B
                  dept order, canonical allergen list, chips)
src/engine/       recommendation/ (filters · scoring · LocalRecommendationEngine)
                  shoppingList · cost · learning · season · schedule · reroll ·
                  rating · syncMerge · manualItems · recipeSearch · cookMode ·
                  userRecipes · portions (M4.1: household → adult-equivalent
                  servings)    (+ a .test.ts beside almost every module)
src/data/seed/    230 hand-curated mains (batches 1–8, cookbook-grade content) +
                  recipeImported.ts (356 TheMealDB imports, GENERATED — never
                  hand-edit) + recipeSides.ts (50 hand-curated sides/sauces,
                  M4.2 — NOT yet wired into generation; see §5)
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
                  userRecipesStore
scripts/          validateRecipes · importRecipes · importPhotos ·
                  checkCuratedWeighting · checkKidApprovedWeighting
```

## 5. Key data flow (the weekly loop)

1. **Intake** (`plan/index`): full wizard, or a one-tap **"same as last week"** fast
   path (proteins + what's in the fridge only) → `generate()` → **draft** plan.
   A new draft never destroys the live approved plan until approval.
2. **Review** (`plan/review`): lock / swap / regenerate / **pin a favorite** / adjust
   any draft meal's **servings** (a −/+ stepper, no confirmation needed pre-approval) →
   `approve()` → status `approved`; shopping list built (scaled by servings,
   deduped by `lowercase(name)|unit`, pantry staples + on-hand items excluded,
   priced by the H-E-B provider) and persisted. **Cost shown at approval equals the
   shopping tab's total** (single source of truth).
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
3. **During the week:** meals map to **real calendar dates** ("Tonight" means
   tonight). Cook mode, cooked toggles, shopping check-offs, **rate-as-you-go**
   (stars on any meal any time, visible on cards), **strict mid-week re-roll**,
   **manual grocery items**, favorites, kids-approved badges. A servings change on an
   **approved** plan (Law #1) never touches the shopping list by itself — it shows the
   exact delta ("you'll need 0.4 lb more chicken thighs") behind an explicit "Update
   shopping list" / "Reduce shopping list" button; declining leaves the list untouched.
4. **Learning:** ratings are the source of truth and the `PreferenceProfile` is
   **recomputed from the full rating history** on every change (structurally
   immune to double-counting). Cuisine/protein/technique/vegetable affinities and
   the learned dials (spice, complexity, budget, leftovers) all feed scoring with
   capped weights; hard filters always win.
5. **Sync (optional):** plan, shopping list, manual items, favorites, and
   kid-approved flags sync between two phones (~20s poll, 600ms debounced push)
   with **per-item / per-meal deterministic merging** (see §6).

## 6. The sync merge contract (the most dangerous code in the app)

Merging is **deterministic, commutative, and idempotent** — both phones must compute
the identical result regardless of order, or they ping-pong forever.

- **Per-field newer-timestamp-wins**; a missing timestamp = epoch 0; ties resolve
  deterministically (a real toggle is never silently lost).
- **`recipeChangedAtISO` gates meal-body divergence:** if two devices hold different
  recipes for the same day, the newer stamp wins the **entire meal body** — a rating,
  cooked flag, or servings value must never attach to a dish that was replaced by a
  re-roll or a pin. `servings` (M4.1) merges the same way `rating` does — its own
  `servingsChangedAtISO` stamp, newer-wins, independent of `cooked`/`rating`.
- **Manual items** are keyed by **normalized name** (two people adding "milk"
  converge to one row) and deleted via **tombstones** (a delete is never resurrected
  by a phone that hasn't caught up). They are **not plan-scoped**: on approving a new
  week, checked items clear (bought) and unchecked items carry over.
- Plan-level fields (intake, weekStartISO) remain whole-payload last-write-wins.
- Every sync change ships with assertions for both merge orders, idempotence, and the
  specific race the feature introduces.

## 7. Product laws (violating these is a bug, even if the code "works")

1. **Never silently modify the shopping list.** Features may say "you'll need X, Y"
   and offer an **explicit** add button. Nothing adds/removes items unasked. (Applies
   to re-roll, pin-to-week, and everything after.)
2. **Strict re-roll:** a mid-week re-roll only offers meals cookable from pantry +
   this week's list + staples. No surprise store trips. If nothing qualifies, show
   near-misses labeled with exactly what's missing.
3. **Never ask a question the code doesn't act on** — and never promise a capability
   in UI copy that doesn't exist.
4. **Allergy filtering is deterministic and safety-critical.** Never delegate it to a
   model. Any change ships with tests in the same commit. Imported (`mealdb-`)
   recipes are **excluded entirely** whenever any profile allergy is set (their
   allergen data is keyword-guessed), and always carry an "allergen info estimated"
   note on their detail screen.
5. **Pinning bypasses candidate generation** — so the pin action itself must enforce
   the allergy guard. (Reusing a code path silently reuses its assumptions.)
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

## 9. Roadmap

**Milestone 4 — "Real Dinners, Right-Sized"** (`MILESTONE-4.md`), written from the
Product Owner's friction journal, is the active milestone:

- **M4.0** — three bug fixes + virtualized recipe browse list. ✅ Shipped.
- **M4.1** — household composition → adult-equivalent servings. ✅ Shipped, revised
  (plain editable age, no birthdate; `familySize` demoted to invisible fallback).
- **M4.2** — a dinner is a plate, not a dish (main + sides composition). **Part 1
  (data model: `Recipe.role`/`Recipe.provides`, curated `provides` authored by
  hand, `recipeSides.ts`, validator gates) ✅ shipped. Part 2 (actually
  composing plates at generation time, `mealComposition.ts`, shopping list,
  cook mode, meal detail UI) is next — none of that is wired up yet.**
- **M4.3** — waste-fit scoring bonus (use the whole cabbage). Not started.
- **M4.4** — per-recipe notes, household-synced. Not started.
- **M4.5** — component re-roll (keep a side/sauce, regenerate the rest). Depends on
  M4.2. Not started.
- **M4.6** — rearrange the week after approval (swipe "Move to…" + hold-to-drag).
  Not started.

- **Deferred polish:** photo accuracy QA (`M3.6` — verify every matched photo actually
  depicts its dish; a wrong photo is worse than none).
- **Parked candidates (do not start without an explicit go-ahead):** leftovers-aware
  planning · thaw-tonight reminders/notifications · quantity-aware re-roll ·
  household-synced user recipes & learning · H-E-B Curbside / Instacart export ·
  other stores · **calendar-aware planning (explicitly deferred on privacy grounds)** ·
  an optional TestFlight native build (EAS cloud build; **not** a rewrite).

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
