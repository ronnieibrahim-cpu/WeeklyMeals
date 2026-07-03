# MILESTONE-3 — The Family's Daily App (v3.0)

Prerequisite: ALL of MILESTONE-2 complete (including the M2.2b recipe content
pass at 230/230 with validateRecipes green) and verified by the Product Owner's
full-milestone review. Do not start M3 work before that gate.

Same rules as always: one task per session, plan first in plain English, stop
at task boundaries and wait for go-ahead, typecheck + assertion scripts green,
PROJECT.md updated when behavior changes.

Product decisions below are ✅ DECIDED by Ronnie (ranked by him).

---

## [x] M3.0 — Carry-over cleanups (one small commit) — done: `app/plan/index.tsx`
steps now carry a stable `key` and the M2.3 fast path (`FAST_STEP_KEYS =
['dinners', 'proteins', 'pantry']`) selects by key instead of hardcoded array
index; `reroll.ts`'s `loosely()` now matches exact-normalized first, then
substring only when the available name is as long or longer than the
required name (blocks "cream" satisfying "coconut cream"), with
`reroll.test.ts` updated to the correct match direction plus a new case for
the blocked reverse direction; confirmed `scripts/checkSyncMerge.ts` was
already deleted at M2.5 with `MILESTONE-2.md` already accurate, so no further
change needed there; added two tests in `LocalRecommendationEngine.test.ts`
asserting `WEIGHTS.learnedDials` is structurally below
`WEIGHTS.preference`/`WEIGHTS.affinity` and that its score contribution is
bounded by `WEIGHTS.learnedDials` even at maximally extreme learned dials.
`npm run typecheck`, `npx jest` (96/96), and `validateRecipes.ts` (230/230)
all green; sanity-checked the web bundle still builds clean via `expo start
--web`.

## [x] M3.0b — Real photos for curated recipes (licensed sources only) — done:
`scripts/importPhotos.ts` matched 80 more curated recipes (TheMealDB first,
then Wikimedia Commons via Openverse, licensed CC0/PDM/BY/BY-SA/BY-ND only,
with a protein-keyword sanity check) on top of the 30 already hand-matched in
Stage 1 — 110/230 curated recipes now show a real photo, the rest keep the
tile fallback. Per Ronnie (photo URLs aren't practical to eyeball from a
markdown list), skipped the text-based pre-review gate and wired matches
directly into `RECIPE_IMAGE_URLS`/new `RECIPE_IMAGE_ATTRIBUTION`
(`src/data/recipeImages.ts`); Wikimedia photos get a small credit line on the
meal detail screen (license requires it), TheMealDB photos rely on the
existing Settings note. `PHOTO-REVIEW.md` and `scripts/photoCandidates.json`
are still in the repo as a record of every match and its confidence — Ronnie
reviews live in the app and will flag specific recipes to revert if a photo
looks wrong. Typecheck, `npx jest` (96/96), and `validateRecipes.ts`
(230/230) all green.
GOAL: photo-realistic, ACCURATE images for as many of the 230 curated recipes
as possible. A wrong photo is worse than no photo.
RULES:
- Licensed/open sources ONLY: (1) TheMealDB API name/dish matching first; (2)
  Wikimedia Commons via the Openverse API (capture license + attribution per
  image). NEVER scrape food blogs, Google Images, or any source without clear
  licensing.
- Build it as a script (`scripts/importPhotos.ts`) in the style of
  `importRecipes.ts`, writing results to the existing recipeImages/images
  mapping with source, license, and attribution fields recorded.
- Confidence gating: only auto-assign a photo on a strong name/dish match.
  Everything uncertain goes UNASSIGNED (keeps the existing tile fallback).
- Human review gate: generate `PHOTO-REVIEW.md` listing every proposed match
  (recipe id, recipe name, image URL, source, license, match confidence).
  STOP and wait for the Product Owner to review it before wiring any photos
  into the app. He will reply with rejections; apply them, then commit.
- Attribution must be viewable in-app where required by the license (a small
  credit line on the meal detail screen is acceptable).
- If the sandbox blocks these API domains, stop and tell the Product Owner
  exactly which domains to allow rather than working around it.
**Accept when:** the review file exists and was approved, matched curated
recipes show real photos on cards/detail/browser, unmatched recipes still
show clean tiles, licenses/attribution are stored, typecheck + tests green.

## [ ] M3.1 — Recipe browser with search, autocomplete, and pin-to-week (TOP PRIORITY)
**User problem:** 541 recipes exist but the family can only meet them through
generation. A cooking family needs to FIND a dish ("what can I make with
cabbage?", "that shakshuka from last month") and ACT on it.
**Behavior:**
- New 5th tab: **Recipes**. Client-side search over name, cuisine, protein,
  and ingredient names, with as-you-type autocomplete suggestions (recipe
  names, cuisines, ingredients). Instant/debounced; no network.
- Filters: cuisine, protein, max total time, difficulty, categories
  (Vegetarian, OnePot, …), Favorites, Kid-approved (from M3.2), Curated-only.
- Result cards: existing image/tile treatment, name, total time, difficulty,
  favorite toggle, kid-approved badge.
- Detail screen gains two actions when a current-week plan exists:
  - **Pin to this week** → day picker → replaces that day's meal. Reuse the
    reroll replacement path exactly: stamps `recipeChangedAtISO`, clears
    cooked/rating for the day, syncs identically, and NEVER silently edits the
    shopping list. If the pinned recipe needs ingredients not covered by
    pantry + this week's list, show "You'll need: X, Y" on confirm, with an
    explicit optional button "Add these to shopping list" (explicit = allowed;
    silent = never). Also usable from the draft review screen.
  - **Favorite** toggle (existing favorites store).
- Allergy guard consistency: when any profile allergy is set, imported
  (mealdb-) recipes are excluded from pinning with a brief explanation, per
  M1.5. They may still appear in browse results with their "allergen info
  estimated" note.

**Addition 1 — Favorites as a first-class surface:**
- The Recipes tab opens with a **Favorites** section at the top (before/
  alongside search), so family standbys are one tap away without typing
  anything. The same search + autocomplete applies within it (i.e. Favorites
  is a starting view, not a separate mode you have to leave to search).
- New entry point on the plan review (draft) screen: **"Swap in a favorite"**
  opens the Recipes browser pre-filtered to Favorites, feeding the same
  pin/replace flow described above.

**Addition 2 — Synced family favorites:**
- Favorites become household-synced instead of per-device. Add a `favorites`
  map to the household sync payload, keyed by `recipeId` with a
  `toggledAtISO` timestamp per entry, merged with the same deterministic
  newer-timestamp-wins pattern as `kidApproved` (M3.2) — extend
  `src/engine/syncMerge.test.ts` accordingly: two devices favoriting
  different recipes converge to the union; an unfavorite with a newer
  timestamp beats an older favorite.
- **Migration:** a device's existing per-device favorites (`learningStore`'s
  plain `string[]`) seed the synced map the first time that device syncs,
  rather than being discarded.

**Accept when:** typing "shak" surfaces Shakshuka in <2 keystrokes of feeling
instant; ingredient search "cabbage" returns every recipe using it; pinning
replaces the chosen day, propagates across two devices via existing merge
rules, and provably never mutates the shopping list without the explicit add
button; favorites are visible as the top section of the Recipes tab;
favoriting a recipe on one device appears on the other within a poll cycle;
a favorite can go from search result → pinned into the week in ≤3 taps;
typecheck + merge script green.

## [ ] M3.2 — Kids-approved flag
**✅ DECIDED:** one family rating (existing stars) PLUS a per-recipe
"Kids approved" badge. No per-person ratings.
**Behavior:**
- Toggleable badge on meal detail (and long-press or affordance on cards):
  "Kids approved ✓". Stored per recipeId with a toggledAtISO timestamp.
- SYNC: include a `kidApproved` map in the household sync payload, merged
  per recipeId by newer timestamp (same deterministic pattern as M1.6;
  extend the sync-merge tests in `src/engine/syncMerge.test.ts`, M2.5).
- Recommendation: modest scoring bonus for kid-approved recipes — enough to
  break ties, never enough to override profile settings or variety. Add to
  the browser as a filter (M3.1).
**Accept when:** badge toggles, persists, displays in browser + week cards,
syncs between devices, and measurably nudges (not dominates) generation in a
quick 10-week simulation.

## [ ] M3.3 — Manual items: one true grocery list
**User problem:** milk, bananas, and dish soap live on some other list. The
family should have exactly one grocery list, and it's this app's.
**Behavior:**
- "Add item" on the Shopping tab: name (autocomplete from known ingredient
  names + previously used manual items), optional quantity, department
  auto-guessed from the existing ingredient→department mapping (editable).
- Manual items are NOT plan-scoped: they live in their own persisted store,
  render merged into the department-grouped list, and use the same per-item
  checked/checkedAtISO merge machinery for sync.
- Lifecycle: when a new week's plan is approved, checked manual items are
  cleared (they were bought); unchecked manual items carry over to the new
  list. Manual items are individually editable/deletable.
**Accept when:** two devices adding/checking manual items converge without
losses; plan replacement preserves unchecked manual items and clears checked
ones; manual items are visually indistinguishable in flow (same list, same
grouping) but survive plan changes; merge script extended and green.

## [ ] M3.4 — Cook mode
**User problem:** cooking from a phone with wet hands means scrolling a wall
of text. The upgraded cookbook-grade steps deserve a purpose-built mode.
**Behavior:**
- "Start cooking" on meal detail → full-screen step-by-step: one step per
  screen, large type, tap/swipe to advance, progress indicator, quick-access
  ingredient sheet (pull-down or button).
- Screen stays awake during cook mode. SANCTIONED new dependency for this:
  `expo-keep-awake` (already part of the Expo ecosystem). No other new deps.
- Auto-detect durations in step text ("simmer 3–4 minutes" → a tappable
  timer chip preset to the upper bound) with a simple running countdown +
  notification-free in-app alert (sound/vibration if trivially available on
  web+native; otherwise visual is fine — note the limitation).
- Final step screen: "Mark cooked" + the existing star row (rate-as-you-go).
- Exiting cook mode remembers the current step for that meal that day.
**Accept when:** a full recipe can be cooked without the screen sleeping or
any pinch/scroll; timers parse from at least the common patterns in the
upgraded recipe corpus ("X minutes", "X–Y minutes"); marking cooked + rating
from the final screen behaves identically to doing it from the detail screen.

## [ ] M3.5 — Our own family recipes (stretch — only after M3.1–M3.4 verified)
**User problem:** the family's real recipes live outside the app; the library
should become the family cookbook.
**Behavior (simple v1):**
- "Add recipe" from the Recipes tab: form with name, cuisine, protein,
  servings, prep/cook minutes, ingredients (name/qty/unit/department rows),
  steps (reorderable multiline rows), optional description/tips.
- Saved to a new persisted userRecipes store; ids prefixed `user-`.
- User recipes appear in browser, search, generation, pinning, and shopping
  like any curated recipe. Excluded from validateRecipes (that script guards
  the seed corpus only) but the form enforces: ≥1 ingredient, ≥3 steps.
- Editable and deletable. NOT synced in v1 (per-device, like profile) — note
  this visibly in the UI ("saved on this device"); household recipe sync is a
  future milestone decision.
**Accept when:** a family recipe entered on the form can be searched, pinned,
planned, shopped, cooked in cook mode, rated, and kid-approved.

---

## Parked / future (v4 candidates — do NOT start)
- Calendar-aware planning — Ronnie says NOT YET (privacy shift; revisit v4).
  A manual "busy night" toggle remains an acceptable interim if requested.
- Leftovers-aware planning (`desiredLeftovers` is wired-ready; leftoverNotes
  fields exist on recipes now).
- Thaw-tonight reminders / notifications; H-E-B Curbside or Instacart export;
  quantity-aware re-roll; household-synced user recipes & learning.

## Standing product direction (unchanged)
Bug-free beats feature-rich · Sundays trend toward zero effort · the shopping
list and mid-week surfaces get the highest quality bar · never ask a question
the code ignores · plain English for an engineer-minded, non-programmer owner.
