# MILESTONE-5 — Look Back, Look Better

> **Status (July 2026 — PARKED here):** M5.0 (6-week archive), M5.2 (bug
> sweep), and M5.3 (Vercel previews) are **shipped and deployed**. M5.1
> (photos) is **live but partially done** — 66 photos are wired and on the
> family's phones (55 exact-match + 11 Ronnie-approved on 2026-07-23); the
> remaining 9 "plausible" in `PHOTO-REVIEW-2.md` are held on the tile, and any
> wrong live photo is one line to revert.
> **M5.4 (household-synced user recipes) shipped 2026-07-23** (advisor gate
> waived; owes the independent audit). Everything under "Candidates" is a proposed pipeline; Ronnie
> picks the order, nothing there starts without his explicit go-ahead.
>
> **The single most important open item is NOT a feature: it is the
> independent advisor close-out audit of the entire M4.3–M4.7 + M5.0–M5.1
> range** (`ADVISOR-HANDOFF.md` Part 6). That whole range was implemented in
> one orchestrated worker session that also acted as its own reviewer — the
> exact setup this project's rules warn against. An adversarial sweep (M5.2)
> was run and its findings fixed, but a sweep is not the audit. Do the audit
> in a fresh advisor chat; the audit now also owes M5.4 + the Phase-4
> redesign + the stale-week fix.
>
> Same rules as every milestone: all three checks green before every commit
> (`npm run typecheck`, `npx jest`, `npx tsx scripts/validateRecipes.ts` —
> currently **422 tests**), product laws in `PROJECT.md` §7 are binding,
> sync/allergy/shopping-list changes carry their extra scrutiny.

---

## [x] M5.0 — Past six weeks, at a glance (SHIPPED)

**Done:** rolling per-device 6-week archive (`src/engine/planHistory.ts`
`archivePlan` + `planHistoryStore` + `LocalPlanHistoryRepository`); the
outgoing plan is archived on `approve()` and on adopting a different-id week
via `hydrateFromSync()`; "Past weeks" collapsible section on the Schedule tab
with a quiet empty-state hint until the first rollover. Not synced (per-device,
like cook-mode progress). Note: the archive starts capturing at the first
approval AFTER it shipped — weeks approved before then were already overwritten
and are unrecoverable (there was only ever one stored plan pre-M5.0).

**User request (verbatim intent):** *"an archive of the last 6 weeks of cooking
in a collapsible format just so we can go back and look at/reflect on what
we've eaten. Rolling 6 weeks — we would favorite and rate anything within that
window we want to see more often anyway."*

- On approval of a new week (or adopting a week-replacement via sync), the
  outgoing plan joins a rolling, per-device, 6-entry archive (per-device like
  cook-mode progress — both phones build equivalent archives from the same
  transitions; not added to the sync payload).
- Schedule tab gains a "Past weeks" section below the current week: collapsed
  rows ("Week of {date} · {n} dinners"), expanding to day-by-day dishes +
  sides + read-only ratings + cooked markers; rows open the recipe read-only.
- Strictly a reflection surface: no re-plan, no shopping-list interaction, no
  scoring input.

**Accept when:** after approving a second week, the first appears under Past
weeks with its dishes and ratings intact; the archive never exceeds 6; nothing
on the surface can mutate a plan or the list.

## [~] M5.1 — Photos at scale (token-efficient, license-safe)

**Progress (July 2026):** harvested license-clean candidates for the 170
photo-less recipes (88 had ≥1 candidate; 82 keep the tile). Four parallel
vision agents screened all 223 candidate images against dish + primary
protein. **55 EXACT matches auto-wired** into `src/data/recipeImages.ts`
(52 Wikimedia w/ attribution, 3 TheMealDB); 20 PLAUSIBLE + 13 rejects logged
in `PHOTO-REVIEW-2.md`. Deployed to the Vercel preview first for Ronnie's
visual check (the harvest environment got Wikimedia-rate-limited, so the
preview is the reachability/accuracy gate); every auto-wired photo is
revertible by recipe id. Remaining: Ronnie reviews the 20 PLAUSIBLE and
flags any bad auto-wires, then promote to production.


**Goal:** populate as many of the ~170 photo-less recipes (≈120 curated mains
with no confident match from M3.0b + all 50 sides/sauces) with accurate,
openly-licensed photos as possible. Decision 18 constraints hold: TheMealDB /
Wikimedia-Openverse only, license + attribution recorded, **a wrong photo is
worse than no photo** — below confidence, keep the cuisine tile.

**Gate (Ronnie's call, July 2026 — decision 31):** vision-verified EXACT
matches auto-wire; everything else review-first in `PHOTO-REVIEW-2.md`; every
auto-wired photo listed and revertible by number ("this didn't work" → tile
fallback returns). Pipeline: extend `scripts/importPhotos.ts` candidate search
(name variants) → candidate manifest + thumbnails → parallel vision-screening
subagents (protein/dish accuracy, not filename match) → wire EXACT tier +
attribution → review doc for the rest.

## [x] M5.2 — Parking-lot bug sweep (DONE)

Adversarial read-only sweep over the unaudited M4.3–M4.7 range ran July 2026.
**No P0s.** All findings resolved: three P1s (F1 Law #1 disclosure retrofit
for merged lines, F6 stale servings-prompt keying, F7 waste-fit
self-double-count in `generate()`), three P2s (F4 rename revive-stamp, F8a
archive hydration race, F5 re-roll commit-path cooked/identity guards), and
the name-fold audit gap (`checkIngredientConsistency.ts` now performs the
collision check `ingredientKey.ts` references). Four edges knowingly accepted
(see `PROJECT.md` §8: sub-0.01-unit swallow, offline-approve reconcile,
double-approval archive, notes-tombstone growth). **Does not replace the
independent advisor audit** (`ADVISOR-HANDOFF.md` Part 6).

## [x] M5.3 — Branch preview deploys (Vercel), production stays on GitHub Pages (SHIPPED)

**Done:** `vercel.json` builds the Expo web export zero-config; Ronnie
connected the repo in his Vercel dashboard, so every branch push now gets a
phone-viewable preview URL (Vercel dashboard → Deployments → the branch row).
**Production deliberately stays at the GitHub Pages URL** (`git push … :claude/
weekly-meals-app-eyowlr` is the production deploy): the app's local data
(AsyncStorage) is origin-bound and the PWA is installed from that URL — a
production origin move would strand un-synced local data (profile, pantry,
ratings history, cook progress) and force re-install on every phone. Revisit
only with a deliberate data-migration plan. Note: a preview is the full app on
a separate origin with blank local data — do NOT enter the real household code
on a preview (it would read/write the family's live synced data); use a
throwaway code to test sync.

---

## [x] M5.4 — Household-synced user recipes (✅ SHIPPED 2026-07-23 — advisor gate waived; owes the independent audit)

Family recipes entered on one phone appear on both. As shipped (2026-07-23):
`userRecipesStore`'s recipe map joins the sync payload with a per-recipe
newer-wins merge (`mergeUserRecipes`, mirroring `mergeManualItems`; deletes are
soft-delete tombstones). Allergy handling was decided and tested: user recipes
flow through the **normal deterministic allergen-label filter** — NOT the
`mealdb-` blanket exclusion (they're hand-entered, not imported) — with
allergy-safety tests (filtered + un-pinnable for a matching allergy) in the same
commit. Extends the standing RLS acceptance (decision 33). Shipped with the sync
advisor gate **waived** by Ronnie — see `ADVISOR-HANDOFF.md` decision 36; owes the
independent audit.

---

---

## [x] M5.5 — Rotation, re-roll pool, two review-flow bugs, Instant Pot nights (✅ SHIPPED 2026-07-25)

One session, four things Ronnie asked for, one commit each. Advisor decisions
recorded as `ADVISOR-HANDOFF.md` 37-39 (two of them reverse earlier recorded
decisions, both with his explicit approval).

- [x] **Two review-flow bugs.** (1) "Already pinned" on a recipe that wasn't:
  the review screen opened the recipe viewer without `pinTarget: 'draft'`, so
  the pin evaluated the still-active PREVIOUS week — whose days are all past —
  and the screen printed "already in this week's plan" for every empty result.
  Fixed the target and split the message into its three real causes
  (`pinBlockReason`, tested). (2) "Regenerate unlocked" only reordered: the
  engine assigns `dayIndex` by array position and returns locked recipes first,
  and near-deterministic scoring re-picked the same dishes. Locked slots are now
  carried over verbatim, only unlocked slots refill, and the outgoing picks are
  passed as `avoidRecipeIds` (a preference — falls back rather than shorten a week).
- [x] **Cross-week rotation** (`src/engine/rotation.ts`) — favorites paced by a
  rest ramp and a per-week crowding taper, a repeat penalty fading over 4 weeks
  (mains only), and learned positive signals scaled by rating volume. Evidence in
  `scripts/checkRotation.ts`: favorites returning to the next week 2.56 → 0.01 of 3.
- [x] **Re-roll pool** — sides composed from on-hand sides only (the big invisible
  shrinker), cap 5 → 8, cuisine diversification, and near-misses alongside a thin
  strict list. `scripts/checkRerollPool.ts`. Note for whoever picks this up next:
  the strict pool is structurally tiny mid-week, so the labeled near-miss list is
  what actually makes a re-roll a choice.
- [x] **Instant Pot nights** — 15 hand-authored pressure-cooker mains
  (`recipeInstantPot.ts`), new `Recipe.equipment`, `intake.instantPotNights`
  (0/1/2), and a reservation pass so the answer is always delivered.
  `scripts/checkInstantPot.ts`. **Open:** `profile.equipment` still isn't editable,
  so the question is asked of every household.

**Accept when:** 475 tests green, 245/245 curated + 50/50 sides validate, and the
three new harnesses pass. Verified. **Owes the same independent advisor audit as
M5.4** — this shipped without an advisor pass on the two law/decision reversals
(Ronnie approved them directly in-session).

---

## M5.6 — Side/sauce pairing that makes culinary sense (shipped 2026-07-26)

Reported by Ronnie: gremolata turning up on chicken piccata. The cause was
structural, not a bad data entry — the second plate slot fell through to
"best-scoring sauce" whenever the plate was already complete, and the only
affinity check was exact cuisine equality (gremolata IS Italian; so is
piccata, which already has a lemon-caper pan sauce).

- [x] **Sauce pairing gate** (`saucePairsWithMain`) — a sauce must clear two
  independent checks: the main isn't already sauced (`mainIsAlreadySauced`,
  derived from existing `techniques`/`categories` so no main needed hand-editing),
  and the main's cuisine is on the sauce's new `pairsWith` allowlist. Fails
  closed; `validateRecipes.ts` requires the allowlist on every sauce.
- [x] **Parallel cook time** — `fitsCombinedTime` sums prep but takes the max of
  cook times. Summing meant a long main rejected every side with any cook time,
  leaving zero-cook sauces as the only eligible candidates on 90 plates.
- [x] **Kept-sauce gate on re-roll** (`reroll.ts` pairing gate (c)) — a kept sauce
  used to pair with any main unconditionally, which reopened the same bug through
  the component-re-roll door (product law #5).

Measured across all 601 mains, default profile: plates with a sauce 431 → 82;
two-sauce plates 274 → 21; plates carrying a vegetable 547 → **577** (the
parallel-cook fix put real sides where only sauces used to fit). Chicken
Piccata now composes to Elote alone; Pesto Gnocchi (complete on its own, and
Pasta) composes to nothing instead of pesto + gremolata.

**Deliberately out of scope** (Ronnie, in session): letting a starch attach to a
main that already provides one — "chana masala should still get rice" is a real
question, but plates that already have a sensible side were left alone.

**Accept when:** 486 tests green, 245/245 curated + 50/50 sides validate. Verified.

---

## Candidates for the M5 pipeline (Ronnie prioritizes; do NOT start unasked)

From the parked list plus M4 follow-ups, with the mission test applied (*does
it reduce decision fatigue for a busy family?*):

- **Leftovers-aware planning** — intake asks about leftovers; the engine could
  actually plan a lighter night around them. High mission fit.
- **Thaw-tonight reminders** — "take the chicken out" is real 6 pm pain. Needs
  a notification story on a web app (Add-to-Home-Screen has no reliable push
  on iOS <16.4; needs investigation first).
- **Quantity-aware re-roll** — strict re-roll currently checks ingredient
  *names*, not amounts. Tightens Law #2 honesty.
- **Household-synced user recipes** — family recipes currently live on one
  phone only.
- **M4.6 hold-to-drag** — only if the family misses it (decision 26).
- **Imported-recipe unit cleanup** — content pass over the 356 imported
  recipes' ~224 messy unit groups (Part 5 item 6).
- **H-E-B Curbside / Instacart export** — shopping list → cart handoff.
- **TestFlight native build (EAS)** — optional distribution upgrade, not a
  rewrite (decision 17).
- **Calendar-aware planning** — still privacy-parked; requires Ronnie's fresh,
  explicit go-ahead (decision 16); the manual "busy night" toggle remains the
  acceptable interim.

## Standing direction (unchanged)
Bug-free beats feature-rich · Sundays trend toward zero effort · the shopping
list and mid-week surfaces carry the highest quality bar · never ask a
question the code ignores · plain English for an engineer-minded,
non-programmer owner.
