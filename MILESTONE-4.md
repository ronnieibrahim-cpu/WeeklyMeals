# MILESTONE-4 — Real Dinners, Right-Sized

Prerequisite: the DEBUG-SWEEP P0/P1/P2 items are closed (verified landed at commit
`c2e8749`: typecheck clean, 178 tests green, 586/586 recipes with canonical
allergen labels). **P0-2 (Supabase Row-Level Security) is a permanent, informed
accepted risk, not a fix in progress — see `PROJECT.md` §8** — it is not, and will
not be, "confirmed done."

This milestone comes from real-world friction, not a backlog. Every task below
traces to something the family actually hit.

Same rules as always: **one task per session**, plan in plain English FIRST and
wait for approval, all three checks green before every commit
(`npm run typecheck`, `npx jest`, `npx tsx scripts/validateRecipes.ts`),
update `PROJECT.md` when behavior changes, check the task off with a one-line
note, **then STOP and wait.**

**Extra review gate:** M4.1, M4.2, M4.3, M4.5 and M4.6 all touch the shopping
list, the plan lifecycle, or sync. For those, Ronnie takes your written plan to
the Advisor BEFORE approving it. Do not skip this — every serious bug in this
project was caught exactly here.

**Nothing in this milestone may violate the product laws in `PROJECT.md` §7.**
In particular: after a plan is approved, *nothing* changes the shopping list
without the user pressing an explicit button that says so.

---

## [x] M4.0 — Three fixes and a real browse list (one small commit each)
**Done:** all three sub-items landed (badge reactivity, view-recipe-from-re-roll, virtualized recipe browse).

### [x] M4.0a — Stale Kids-approved / Favorite badges (BUG, reported live)
**Done:** the four screens now subscribe to `kidApprovedMap`/the favorite Sets and derive the boolean per-render instead of reading the stable `isKidApproved`/`isFavorite` functions.
**Problem:** `app/(tabs)/index.tsx`, `app/(tabs)/schedule.tsx`, `app/plan/review.tsx`
and `app/(tabs)/recipes.tsx` subscribe to the learning store's *functions*
(`useLearningStore((s) => s.isKidApproved)`, `s.isFavorite`). A Zustand selector
that returns a stable function never fires a re-render, so those screens keep
showing whatever the flag was the last time the screen happened to redraw.
The meal detail screen (`app/meal/[id].tsx`) subscribes to the derived arrays and
is correct — which is why "Kids approved" on the week card disagrees with the
recipe when you open it.
**Fix:** subscribe to the data (`kidApprovedMap` / `favoritesMap`, or the derived
`kidApproved` / `favorites` arrays) and derive the boolean in the component. Do
this on every screen that shows either badge.
**Accept when:** toggling Kids-approved (or Favorite) anywhere updates the badge
everywhere without leaving the screen, and the week card and the recipe detail
never disagree.

### [x] M4.0b — Open the recipe from a re-roll suggestion
**Done:** added a "View recipe" link on the candidate card and each near-miss card that pushes `/meal/[id]`; since it's a stack push (not a replace) the re-roll screen stays mounted and its "try another" index survives the round trip via the meal screen's existing Back button.
**Problem:** `app/reroll/[dayIndex].tsx` shows a candidate's name, cuisine and
time, but you cannot read the ingredients or steps before committing to it.
**Fix:** add a "View recipe" action on the candidate card (and on each near-miss)
that opens `/meal/[id]` and returns to the re-roll screen on back, preserving the
candidate the user was looking at (`index` state). Committing still happens from
the re-roll screen.
**Accept when:** you can open, read and back out of any suggested recipe without
losing your place in the "try another" cycle.

### [x] M4.0c — Actually browse all the recipes
**Done:** Recipes tab now renders through a `FlatList` (search/filters/Favorites as its header, main list virtualized, cap removed). Along the way found and fixed a real bug in `Screen.tsx`'s non-scrolling mode: on web, `flexGrow: 1` alone doesn't bound a child's height, so the FlatList kept "growing to fill" its own unbounded box, mounting more cards forever. Added `minHeight: 0` there; verified in a browser that mounted card count now stays flat (~20) all the way through a full scroll of all 586 recipes.
**Problem:** the Recipes tab caps at `MAX_VISIBLE_RESULTS = 40` because it is a
plain `ScrollView` and mounting hundreds of photo cards OOM-crashes mobile Safari.
The comment is honest; the cap is the wrong fix.
**Fix:** render results in a **virtualized list** (`FlatList`/`SectionList` from
React Native core — **no new dependency**) so only on-screen cards are mounted,
and remove the 40-item cap. Keep the Favorites-first section (a `SectionList` or
a list header does this). Keep photos lazy. Sort stays alphabetical.
**Accept when:** all 586 recipes can be scrolled smoothly on an iPhone with no
crash and no "narrow your search" cap; quick-pin and favorite still work from the
cards.

---

## [x] M4.1 — Portions that match who is actually eating
**Landed** (revised 2026-07-16, Product Owner's call): household composition
(plain per-member `ageYears`, no birthdate) → adult-equivalent servings via
`src/engine/portions.ts`; `familySize` is an invisible migration-only fallback
with no visible Profile control; per-meal servings stepper; approved-plan
servings changes never touch the shopping list without an explicit
"Update"/"Reduce shopping list" tap. An earlier pass built this with
birthdate-based aging (computed age-at-read-time, an "ages three years
automatically" test) — simplified back to a plain number for a smaller,
easier-to-reason-about surface.

**User problem:** the family is 2 adults + a 3-year-old (a baby will join later),
but the app treats "people = 3" as three adult portions and over-buys. And there
is no way to say "cook extra tonight" or "cook less."

### Household composition (Profile)
- `Profile.members: HouseholdMember[]` already exists in the model and is **dead
  code — never populated, never read**. Make it real.
- Profile gains an editable "Who are we cooking for?" section: rows of members,
  each `{ name?: string; ageYears?: number; isChild: boolean; eatsLikeAdult?:
  boolean }`. Add/remove rows. **No birthdate field** — age is a plain number the
  user types in and updates by hand as their kids grow (accepted tradeoff for
  simplicity; revisit only if this becomes real friction).
- New pure engine module `src/engine/portions.ts` converting members →
  **adult-equivalent servings**, entirely static (no date/`now` dependency
  anywhere in this module):

  | member | factor |
  |---|---|
  | adult / 10+ | 1.0 |
  | 6–9 | 0.75 |
  | 3–5 | 0.5 |
  | 1–2 | 0.25 |
  | under 1 | 0 |

  A member with `isChild: true` and no `ageYears` set defaults to the 0.5 middle
  bracket. Sum, round to the nearest 0.5. A 2.0 floor applies once there are
  **2+ people** in the household (2 adults + a 3-year-old rounds to **2.5
  servings**, not 3) — but a genuine single-person household is never floored:
  one adult reads as 1.0, not 2.0. The floor exists to stop a real couple/family
  rounding down below 2, not to inflate someone cooking for one. Each member row
  also gets an optional per-person override ("eats like an adult") for the day
  the 3-year-old starts inhaling food.
- `familySize` becomes an **invisible migration fallback only** — no visible
  "Family size" control on the Profile screen anymore (the members list is the
  single source of truth; two competing controls for the same number is worse,
  not better). It's read in exactly one place, `servingsPerMeal()`, when
  `members` is empty, so a profile saved before this shipped (which has
  `familySize` and no members) still computes a sane number the first time it
  loads post-upgrade. The moment the household has any members, `familySize` is
  never read again. On first load with an empty members list, the "Who are we
  cooking for?" section starts empty with an "+ Add person" prompt, and the old
  `familySize` number is used silently (no popup, no confirmation — Law #1 is
  about the shopping list, not this) until the user adds people.
- Intake shows it as one line — "Cooking for: 2 adults + 1 child = 2.5 portions
  (edit)" — not a new wizard step. **Remove clicks, don't add settings.**

### Per-meal portions
- `PlannedMeal.servings` already exists and is set once at generation
  (`LocalRecommendationEngine.ts:76`). Add a **servings stepper** (−/+ in 0.5
  steps, floor 1) on the meal card / meal detail, plus a one-tap
  "**Cook extra for lunches (+2)**" shortcut.
- **On the draft (pre-approval):** changing servings just rescales; the shopping
  list is rebuilt at approval as it always was.
- **On an approved plan (LAW #1 applies):** changing servings **never silently
  touches the shopping list.** Show exactly what changes — "You'll need 0.4 lb
  more chicken thighs" — and an explicit button **"Update shopping list"**. Lower
  the servings and the equivalent is an explicit "Reduce shopping list" button;
  if the user says no, the list is left alone.
- Sync: `servings` is a per-meal field → it merges by `recipeChangedAtISO`'s
  sibling rule. Add a `servingsChangedAtISO?: string` stamp and merge
  newer-wins per meal, exactly like `cookedAtISO` / `ratedAtISO`. Extend the sync
  assertions (both merge orders, idempotence).

**Accept when:** a household of 2 adults + a 3-year-old generates a week scaled to
2.5 portions and the shopping list quantities drop accordingly; a per-meal
servings change on an approved plan updates the shopping list **only** after an
explicit tap; old profiles with no `members` still load and behave as before.

---

## [x] M4.2 — A dinner is a plate, not a dish (THE BIG ONE)

**Done:** Part 1 (data + validation): `Recipe.role`/`Recipe.provides` added to the
model; `provides` authored by hand for all 230 curated mains and derived in
`normalize.ts` for the 356 imported recipes (regenerated from a frozen
`themealdb-raw.json` fixture, not a live re-fetch); new `src/data/seed/recipeSides.ts`
(50 hand-curated sides/sauces, incl. 5 protein-capable ones for gap-filling);
`scripts/validateRecipes.ts` gained a frozen protein-less-main allowlist and a
hard ingredient-plausibility gate on every declared `provides`.

Part 2 (actually composing plates): new pure `src/engine/mealComposition.ts`
(`composeSides`, best-effort, capped at 2, every candidate passing the exact same
hard filters — allergy/diet/dislikes/blocked/combined time budget — a main does);
`scoreSide` in `scoring.ts` reuses every `scoreRecipe` signal except `varietyBonus`
(main-vs-week-scoped, inverts into the wrong signal at plate scope) plus a small
cuisine-fit bonus; `RECIPES` now merges curated + imported + sides into one pool,
split by the new `isMain()` wherever "a main" is picked (generation, re-roll, swap,
the Recipes browse tab — sides stay out of browse, as approved); `PlannedMeal`
gains `sideRecipeIds`/`sidesChangedAtISO`, synced the same deterministic
newer-wins pattern as `servings`; shopping list/cost fold sides in through the
existing per-recipe path; `applyShoppingListDelta` gained `removesSource` so
removing a side never strips an ingredient the main still needs; cook mode
composes the main's steps then each side's, sectioned, with content-addressed
progress invalidation (`cookModePlateKey`, sorted ids) so a side change never
leaves cook mode pointing at stale content; meal detail shows the plate (main +
removable, openable sides — a side opened this way is read-only, no pin, no
independent cook-start); strict re-roll evaluates the whole plate and a candidate
carries its composed sides verbatim through to commit, never recomposed; pinning
composes sides through the identical path and re-checks allergy safety on each one
explicitly, with a store-level (not just UI) guard that a side/sauce is never
independently pinnable. Verified live in a browser end to end (generation through
review, approval, This Week/Schedule cards, meal detail plate view, side removal
with the shopping-list prompt, cook mode section labels, and re-roll) — see
PROJECT.md §5–§7 for the full contract.

**User problem, in his words:** *"supposed to be a meal planner app, not a protein
or single-dish app. Grilled steak with chimichurri had zero sides listed."*

**Verified:** 33 of 586 recipes contain neither a vegetable nor a starch; 61 have
no real vegetable (the steak's `vegetables` field is `['parsley']` — a garnish).
The library is a library of *dishes*. Hand-editing 586 recipes is not the answer,
and `recipeImported.ts` is generated and must never be hand-edited anyway.

**The answer: compose dinners from a main + sides.**

### Model
- `Recipe` gains:
  - `role?: 'main' | 'side' | 'sauce'` — absent means `'main'` (every existing
    recipe stays valid).
  - `provides?: Array<'protein' | 'vegetable' | 'starch'>` — what this dish
    actually puts on the plate.
- **Curated mains:** author `provides` by hand for all 230 (the content pass
  precedent from M2.2b). **Imported mains:** derive `provides` in
  `src/data/import/normalize.ts` from ingredients/nutrition and **regenerate** —
  never hand-edit the generated file. Imported `provides` is estimated; treat it
  as such (see the guard below).
- **New seed file `src/data/seed/recipeSides.ts`** — roughly 40–60 hand-written
  sides and sauces, curated quality, cookbook-grade steps like the rest:
  vegetables (roasted broccoli, garlic green beans, simple green salad, sautéed
  cabbage, roasted carrots…), starches (jasmine rice, rice pilaf, mashed
  potatoes, crusty bread, tortillas, buttered noodles…), and sauces
  (chimichurri, salsa verde, tzatziki, peanut sauce, romesco…). Each carries
  real ingredients with departments, real steps, prep/cook minutes, allergens,
  dietTags, `role`, and `provides`. Sides are **cheap, fast, and forgiving** —
  most should be ≤15 minutes.
- `PlannedMeal` gains `sideRecipeIds?: string[]` (0–2) and
  `sidesChangedAtISO?: string` (sync stamp, newer-wins per meal, same pattern).

### Composition rule (new pure engine module `src/engine/mealComposition.ts`)
For each planned main, add sides until the plate satisfies:
1. **Hard minimum:** protein **+** (vegetable **or** starch).
2. **Target:** protein **+** vegetable **+** starch.
Never add a side that duplicates what the main already provides. Prefer sides
that fit the main's cuisine, keep total cook time inside the intake's time limit,
and honor the learned preferences with the usual capped weights. Cap at 2 sides.

### The non-negotiables
- **Sides pass every hard filter the main does** — allergies, diet tags, dislikes,
  blocked recipes. A side is food; it can kill someone just as dead. When any
  profile allergy is set, only hand-curated sides are eligible (the imported
  exclusion rule, unchanged). **Tests in the same commit.**
- Side ingredients flow into the shopping list and the cost total through the
  existing `buildShoppingList()` path — one source of truth, unchanged.
- **Strict re-roll (LAW #2) still holds:** re-roll candidates are evaluated on
  the *whole plate* (main + its sides) against pantry + this week's list +
  staples.
- Cook mode appends the side's steps after the main's, clearly sectioned
  ("**While the steak rests: garlic green beans**"). Timers still parse.
- The meal detail screen shows the plate: main, then sides, each openable, each
  removable ("no sides tonight" is allowed — an explicit choice, not the default).
- `scripts/validateRecipes.ts` gains a check: **every curated main declares
  `provides` and includes a protein**, and the sides file is validated to the same
  content standard.

**Accept when:** a generated week has no protein-only dinners; the steak night
arrives as *Grilled Steak with Chimichurri + garlic green beans + rice pilaf*; the
shopping list contains the sides' ingredients and the cost total still matches the
approval screen exactly; with an allergy set, no imported side or main can ever be
composed onto a plate; re-roll still never requires a store trip.

---

## [ ] M4.3 — Use the whole cabbage (waste-aware planning)

**User problem:** *"told to buy a whole cabbage this week, used half in one recipe,
no other use — half the cabbage is wasted."*

**Approach:** a **scoring bonus**, not a hard rule. New pure engine module
`src/engine/wasteFit.ts`:
- Identify **perishable, whole-unit ingredients** — non-staple items in Produce,
  Meat, Seafood, Dairy bought as an indivisible unit (`head`, `bunch`, `bag`,
  `loaf`, `container`) or in a quantity below one sensible purchase unit.
- When scoring a candidate for a given week, add a modest bonus if it **uses an
  ingredient another meal in that week has already forced you to buy** and the
  first meal doesn't consume the whole unit. The bonus must be small — enough to
  break ties and near-ties, never enough to bury a better dish or beat variety.
  (Same weighting discipline as curated-first and kid-approved.)
- Sides (M4.2) are the natural home for leftovers — a half cabbage becomes
  sautéed cabbage on Thursday. Score sides for waste fit too.
- Surface it: on the shopping list, a whole-unit item used by more than one meal
  gets a quiet "used in 2 meals" line. Where half a unit would go to waste and a
  candidate could use it, that's the bonus's job — no extra UI.
- Add a `scripts/checkWasteFit.ts` harness like the existing weighting scripts:
  generate ~20 weeks, report the average number of whole-unit perishables used by
  only one meal. It must go **down** versus the current engine, and curated-first
  / kid-approved / variety behavior must not regress.

**Accept when:** the harness shows a clear reduction in single-use perishables
across 20 simulated weeks, with no regression in the existing weighting scripts,
and the shopping list shows which items are shared.

---

## [ ] M4.4 — Notes on a recipe (what we liked, how we adapted it)

**User problem:** *"we added a vegetable / we halved the chili / the kids hated the
sauce" — that knowledge currently lives nowhere.*

**Behavior:**
- Free-text note per recipe, edited from the meal/recipe detail screen. One note
  per recipe (not per cooking), shown under the steps and indicated on cards with
  a small "note" glyph.
- New persisted store `recipeNotesStore` + repository, keyed by `recipeId`:
  `{ text: string; updatedAtISO: string }`.
- **Household-synced** (the wife's notes are the whole point), merged per recipeId
  **newer-timestamp-wins**, same deterministic pattern as favorites/kid-approved.
  Note the known limitation in `PROJECT.md`: two people editing the same note in
  the same poll window means the later save wins — acceptable for a two-phone
  household; do not build merge-of-text.
- Notes are **display only** — they do not feed scoring. (Law: never pretend.)

**Accept when:** a note written on one phone appears on the other; a note survives
re-rolls, plan changes, and week rollovers (it belongs to the recipe, not the
plan); merge assertions extended and green.

---

## [ ] M4.5 — Keep the chimichurri, change the meal (component re-roll)

**Depends on M4.2.** Do not attempt before the composition model exists.

**User problem:** *"I want to keep one element of a dish — the chimichurri — and
regenerate a new meal around it."*

**Behavior:**
- Every composed plate is main + sides/sauce. Each part gets a **Keep** toggle
  (a lock, exactly like the existing review-screen lock).
- Re-roll on a plate with something kept:
  - **Keep the sauce/side → re-roll the main:** candidates are mains that pair
    with the kept part (cuisine fit, no `provides` clash), passing all hard
    filters, and — because this is a **strict** re-roll (LAW #2) — cookable from
    pantry + this week's list + staples. Ranked by the existing scorer.
  - **Keep the main → re-roll the sides:** the same, in reverse.
- Same strict rules as today: never touches the shopping list; near-misses are
  shown labeled with exactly what's missing; cooked/past days offer no re-roll.
- Replacement reuses the existing re-roll replacement path — and therefore must
  **re-apply the allergy guard at the point of replacement** (LAW #5: pinning
  bypassed candidate generation once already; do not repeat that bug).

**Accept when:** on steak-with-chimichurri night you can keep the chimichurri and
be offered other mains it belongs on, all cookable from what's already bought,
with the shopping list byte-for-byte unchanged.

---

## [ ] M4.6 — Rearrange the week after it's approved

**User problem:** plans survive contact with Tuesday about as well as anything else.

**Decision (advisor's recommendation — confirm with Ronnie):** **not** drag-and-drop.
Long-press drag is fiddly on a phone, poor for accessibility, and fights the
scroll view. Instead: a **"Move to…" action** on each meal card (swipe-to-reveal,
matching the existing swipe-to-delete on manual shopping items) opening a day
picker. Choosing an occupied day **swaps** the two meals.

**Rules:**
- Only **not-yet-cooked** days can be moved or swapped into. A cooked day is
  history.
- A move carries the **entire meal body** — recipe, sides, servings, rating,
  cooked flag, cook-mode progress — to the new `dayIndex`. Ratings must never
  detach from their dish.
- Never touches the shopping list (same food, different night).
- **Sync (the dangerous part):** the merge is keyed by `dayIndex`. A swap changes
  two days at once. Stamp `recipeChangedAtISO` on **both** affected meals so a
  remote device adopts both whole bodies together, and prove convergence:
  assertions for both merge orders, idempotence, and the specific race — one phone
  swaps Tue↔Thu while the other rates Thursday's dish.

**Accept when:** a meal can be moved or swapped between two uncooked days; ratings,
cooked flags and cook progress travel with the dish; two phones converge on the
same week regardless of merge order; the shopping list is unchanged.

---

## [x] M4.7 — Two live bugs from the family (BUGFIX)
**Reported:** (a) manually entered shopping items sometimes don't clear week to week even after being checked off; (b) duplicate entries appear on the shopping list — the same ingredient shows as multiple lines.
**Diagnosis (verified):** (a) `syncNow()` pushes before pulling; the push records its own `updated_at` as last-synced, so the following pull early-returns as 'already caught up' — the reconcile `onApprove` relies on (app/plan/review.tsx) never merges the partner phone's check-offs, and `clearChecked()` runs against stale state. Also, `manualItemsStore.add()` revives a cleared item with `checkedAtISO: null`, so a stale remote checked=true (real timestamp beats epoch 0) resurrects it pre-checked. (b) `buildShoppingList` dedups by exact lowercased name|unit; the recipe pool uses inconsistent singular/plural spellings and units for the same ingredient across curated/imported/sides sources, so one real-world ingredient becomes several lines.
**Fix:** see commits. **Accept when:** an item checked on either phone is cleared by the next week's approval on either phone; re-adding a cleared item never comes back pre-checked; one week's list shows one line per real ingredient wherever units are convertible; merge assertions cover both orders, idempotence, and the revive race.
**Fix A landed:** `syncNow()` now pulls before it pushes (see comment on `syncNow` in `src/stores/syncStore.ts`); `manualItemsStore.add()` stamps a revive's `checkedAtISO` with `now` instead of `null` so it deterministically beats a stale remote checked=true. Merge-level tests added for the revive race and the clear-vs-late-check case (`src/engine/syncMerge.test.ts`), plus one store-level ordering test (`src/stores/syncStore.test.ts`).
**Fix B landed:** new `src/engine/ingredientKey.ts` — `canonicalIngredientName` (trims/lowercases/folds a trailing plural) + unit-family merge (mass `g/kg/oz/lb`, volume `ml/l/tsp/tbsp/cup`, everything else non-convertible) — wired into `buildShoppingList`, `addIngredientsToShoppingList`, `applyShoppingListDelta` (deltas convert into the existing line's display unit before applying; zero-out/`removesSource` behavior unchanged), and `reroll.ts`'s `loosely()`/`availableIngredients` so "carrots" on the list satisfies a recipe needing "carrot" symmetrically. Hand-aligned 12 real cross-family unit inconsistencies in the curated main/side seed files (mostly fresh-herb sides using tbsp/cup where mains use `bunch`, plus a few lb/piece and cup/can mismatches) — `scripts/checkIngredientConsistency.ts` (new repo-hygiene harness, not wired into CI) now passes clean on curated+sides. Imported (`mealdb-`) recipes' unit inconsistencies (224 cross-family groups, e.g. "onion" as piece/mass/volume) are reported info-only by the same script and are an explicit follow-up, not fixed here — their source text is their fidelity anchor per `validateRecipes.ts`'s own rationale, and normalizing them is real editorial work, not a bugfix-scope change.

---

## Parked / future (unchanged — do NOT start)
Photo accuracy QA (M3.6, deferred polish) · leftovers-aware planning ·
thaw-tonight reminders · quantity-aware re-roll · household-synced user recipes ·
H-E-B Curbside / Instacart export · other stores ·
**calendar-aware planning (deferred on privacy grounds)** · optional TestFlight
native build (EAS cloud build, **not** a rewrite).

## Standing product direction (unchanged)
Bug-free beats feature-rich · Sundays trend toward zero effort · the shopping list
and mid-week surfaces get the highest quality bar · never ask a question the code
ignores, and never promise in UI copy what the app can't do · plain English for an
engineer-minded, non-programmer owner.
