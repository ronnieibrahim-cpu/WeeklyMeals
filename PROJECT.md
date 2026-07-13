# PROJECT.md — Weekly Meals

> **The canonical reference for every development session (human or AI).**
> Read this before touching code. It describes how the app *actually* works,
> verified by reading the implementation. Where `docs/ARCHITECTURE.md` disagrees
> with reality, **this file wins** (that file is stale and partly fictional).
> If reality and this file disagree, **fix this file in the same change.**
>
> **State:** Milestones 1, 2, and 3 complete (v3.0). Post-v3 adversarial debug
> sweep complete (`DEBUG-SWEEP.md`) — its P0/P1/P2 fixes are in progress.
> **Last verified:** July 2026 · typecheck clean · 169 tests green ·
> 230/230 curated recipes pass content validation.
>
> **Advisor context, decision rationale, and current open items live in
> `ADVISOR-HANDOFF.md`. Read that too.**

---

## 1. What this app is

A meal-planning app for one family (2 adults, 2 young kids, Houston TX, shops at
H-E-B). Each week it asks a short questionnaire (or a one-tap "same as last week"),
generates a week of dinners from a ~541-recipe library, and produces one
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
  phones; publishable key committed by design, **access must be governed by RLS**
  (see §8 — currently an open security item)
- **Jest / jest-expo** — engine test suite (**169 tests**); `npx jest` must stay green
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

src/domain/       models (Recipe, Profile, IntakeAnswers, WeeklyPlan, ShoppingList,
                  ManualItem, RatingEvent, PreferenceProfile) + constants
                  (cuisines, H-E-B dept order, canonical allergen list, chips)
src/engine/       recommendation/ (filters · scoring · LocalRecommendationEngine)
                  shoppingList · cost · learning · season · schedule · reroll ·
                  rating · syncMerge · manualItems · recipeSearch · cookMode ·
                  userRecipes    (+ a .test.ts beside almost every module)
src/data/seed/    230 hand-curated recipes (batches 1–8, cookbook-grade content) +
                  recipeImported.ts (~311 TheMealDB imports, GENERATED — never hand-edit)
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
2. **Review** (`plan/review`): lock / swap / regenerate / **pin a favorite** →
   `approve()` → status `approved`; shopping list built (scaled by servings,
   deduped by `lowercase(name)|unit`, pantry staples + on-hand items excluded,
   priced by the H-E-B provider) and persisted. **Cost shown at approval equals the
   shopping tab's total** (single source of truth).
3. **During the week:** meals map to **real calendar dates** ("Tonight" means
   tonight). Cook mode, cooked toggles, shopping check-offs, **rate-as-you-go**
   (stars on any meal any time, visible on cards), **strict mid-week re-roll**,
   **manual grocery items**, favorites, kids-approved badges.
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
  recipes for the same day, the newer stamp wins the **entire meal body** — a rating
  or cooked flag must never attach to a dish that was replaced by a re-roll or a pin.
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

## 8. Known issues (from `DEBUG-SWEEP.md`, July 2026 — verify status before acting)

**P0**
1. **Tree-nut allergy filter fails on a spelling mismatch.** The canonical allergy
   string is `'Tree Nuts'` (with a space); three curated recipes label the allergen
   `'TreeNuts'`, so the comparison in `passesAllergySafety` lets them through. Root-cause
   fix: canonicalize the seed data **and** normalize the comparison **and** add allergen
   validation to `scripts/validateRecipes.ts` so the bug class becomes self-detecting.
2. **Supabase `households` has no Row-Level Security.** Confirmed live: an anonymous
   client using the bundled publishable key can enumerate every household code —
   equivalent to full read/write of every family's plan and dietary data. **Fix is a
   Supabase dashboard action, not code:** anon select/upsert must only match a row
   whose `code` is supplied as a filter.

**P1/P2**
3. `validateRecipes.ts` has no allergen check (the blind spot that hid #1).
4. Schedule screen copy promises "leftover days" and a per-plan prep tip that don't
   exist (violates law #3).
5. Cook mode's keep-awake doesn't re-acquire the wake lock after the browser releases
   it (tab switch / dim), so the screen sleeps mid-recipe.
6. `weekStartISO` is stored as a UTC instant → wrong day offset on a device in another
   timezone. Store as a plain `YYYY-MM-DD` local date string.
7. `kvStore.getJSON` guards unparseable JSON but not valid-JSON-wrong-shape → can
   white-screen a tab on hydration.

**P3 (parked):** dead `reset`/`clear` store actions with no UI · no keyboard-avoidance
around the inline manual-item editor · `docs/ARCHITECTURE.md` drift.

## 9. Roadmap

- **Now:** close the debug-sweep P0/P1/P2 items above.
- **Deferred polish:** photo accuracy QA (`M3.6` — verify every matched photo actually
  depicts its dish; a wrong photo is worse than none).
- **Milestone 4 — deliberately unplanned.** The app now covers every moment of the
  family's week. The next milestone is to be written from the Product Owner's
  **friction journal** (real-world snags observed over several weeks of use), not from
  a speculative backlog.
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
  `normalize.ts` / `scripts/importRecipes.ts` and re-run.
- Every push to `claude/weekly-meals-app-eyowlr` deploys the web build.
- Keep changes small and grouped by task; isolate anything touching the plan lifecycle,
  allergy filtering, sync, or seed data.
- **Photos:** openly-licensed sources only (TheMealDB, Wikimedia/Openverse), never
  scraped. Below a confident match, keep the cuisine-tile fallback.
