# MILESTONE-4 — Real Dinners, Right-Sized

Prerequisite: the DEBUG-SWEEP P0/P1/P2 items are closed (verified landed at commit
`c2e8749`: typecheck clean, 178 tests green, 586/586 recipes with canonical
allergen labels) **and P0-2 (Supabase Row-Level Security) is confirmed done in the
Supabase dashboard by Ronnie.** Do not start M4 before that confirmation.

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

## [ ] M4.0 — Three fixes and a real browse list (one small commit each)

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

### M4.0b — Open the recipe from a re-roll suggestion
**Problem:** `app/reroll/[dayIndex].tsx` shows a candidate's name, cuisine and
time, but you cannot read the ingredients or steps before committing to it.
**Fix:** add a "View recipe" action on the candidate card (and on each near-miss)
that opens `/meal/[id]` and returns to the re-roll screen on back, preserving the
candidate the user was looking at (`index` state). Committing still happens from
the re-roll screen.
**Accept when:** you can open, read and back out of any suggested recipe without
losing your place in the "try another" cycle.

### M4.0c — Actually browse all the recipes
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

## [ ] M4.1 — Portions that match who is actually eating

**User problem:** the family is 2 adults + a 3-year-old (a baby will join later),
but the app treats "people = 3" as three adult portions and over-buys. And there
is no way to say "cook extra tonight" or "cook less."

### Household composition (Profile)
- `Profile.members: HouseholdMember[]` already exists in the model and is **dead
  code — never populated, never read**. Make it real.
- Profile gains an editable "Who are we cooking for?" section: rows of members,
  each `{ name?: string; ageYears?: number; isChild: boolean }`. Add/remove rows.
- New pure engine module `src/engine/portions.ts` converting members →
  **adult-equivalent servings**:

  | member | factor |
  |---|---|
  | adult / 13+ | 1.0 |
  | child 8–12 | 0.75 |
  | child 4–7 | 0.5 |
  | toddler 1–3 | 0.25 |
  | under 1 | 0 |

  Sum, round to the nearest 0.5, floor at 2.0. (2 adults + a 3-year-old = 2.25 →
  **2.5 servings**, not 3.) Each member row also gets an optional per-person
  override ("eats like an adult") for the day the 3-year-old starts inhaling food.
- `familySize` stays as the plain headcount for display; **`servingsPerMeal` is
  what the engine and shopping list use.** `defaults.ts` maps
  `people: p.familySize` today — that mapping becomes
  `servingsPerMeal: adultEquivalents(profile.members)` with a safe fallback to
  `familySize` when `members` is empty (old profiles must keep working).
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

## [ ] M4.2 — A dinner is a plate, not a dish (THE BIG ONE)

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
