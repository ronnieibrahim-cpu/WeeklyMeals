# MILESTONE-3 — The Family's Daily App (v3.0)

Prerequisite: ALL of MILESTONE-2 complete (including the M2.2b recipe content
pass at 230/230 with validateRecipes green) and verified by the Product Owner's
full-milestone review. Do not start M3 work before that gate.

Same rules as always: one task per session, plan first in plain English, stop
at task boundaries and wait for go-ahead, typecheck + assertion scripts green,
PROJECT.md updated when behavior changes.

Product decisions below are ✅ DECIDED by Ronnie (ranked by him).

---

## [ ] M3.0 — Carry-over cleanups (one small commit)
- Fast-intake path (`app/plan/index.tsx`) selects wizard steps by hardcoded
  array index (`steps[0], steps[5], steps[10]`) — brittle. Give steps stable
  `key` names and select by key.
- Tighten re-roll ingredient matching: exact normalized-name match first,
  substring only as fallback, and never let a shorter available name match a
  longer required name in the reverse direction ("cream" must not satisfy
  "coconut cream"). Extend the reroll cases in the assertion scripts.
- Housekeeping: `scripts/checkSyncMerge.ts` was dead code (assertions already
  migrated to `src/engine/syncMerge.test.ts` at M2.5) — confirmed already
  deleted, and `MILESTONE-2.md`'s references to it are accurate historical
  record of when it existed, so nothing further to change there.
- Add a test asserting each learned dial's contribution to scoring
  (`learnedDialsFit()` in `scoring.ts`) is bounded/clamped to ±1 and that
  `WEIGHTS.learnedDials`'s maximum possible contribution stays below
  `WEIGHTS.preference` and `WEIGHTS.affinity`, so learning can nudge picks but
  structurally can never dominate the explicit profile.
**Accept when:** behavior identical except stricter matching; scripts green.

## [ ] M3.0b — Real photos for curated recipes (licensed sources only)
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
**Accept when:** typing "shak" surfaces Shakshuka in <2 keystrokes of feeling
instant; ingredient search "cabbage" returns every recipe using it; pinning
replaces the chosen day, propagates across two devices via existing merge
rules, and provably never mutates the shopping list without the explicit add
button; typecheck + merge script green.

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
