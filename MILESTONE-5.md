# MILESTONE-5 — Look Back, Look Better

> **Status (July 2026 — PARKED here):** M5.0 (6-week archive), M5.2 (bug
> sweep), and M5.3 (Vercel previews) are **shipped and deployed**. M5.1
> (photos) is **live but partially done** — 55 exact-match photos are wired
> and on the family's phones; 20 "plausible" candidates in `PHOTO-REVIEW-2.md`
> await Ronnie's yes/no, and any wrong auto-wire is one line to revert.
> **M5.4 (household-synced user recipes) is the next confirmed feature — not
> started.** Everything under "Candidates" is a proposed pipeline; Ronnie
> picks the order, nothing there starts without his explicit go-ahead.
>
> **The single most important open item is NOT a feature: it is the
> independent advisor close-out audit of the entire M4.3–M4.7 + M5.0–M5.1
> range** (`ADVISOR-HANDOFF.md` Part 6). That whole range was implemented in
> one orchestrated worker session that also acted as its own reviewer — the
> exact setup this project's rules warn against. An adversarial sweep (M5.2)
> was run and its findings fixed, but a sweep is not the audit. Do the audit
> in a fresh advisor chat before building M5.4 or anything new.
>
> Same rules as every milestone: all three checks green before every commit
> (`npm run typecheck`, `npx jest`, `npx tsx scripts/validateRecipes.ts` —
> currently **398 tests**), product laws in `PROJECT.md` §7 are binding,
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

## [ ] M5.4 — Household-synced user recipes (CONFIRMED — Ronnie's pick, July 2026)

Family recipes entered on one phone appear on both. Scope sketch (spec to be
written before implementation): `userRecipesStore`'s recipe map joins the sync
payload with a per-recipe newer-wins merge (same deterministic pattern as
notes/favorites; deletes need tombstones like manual items); imported/user
recipes keep their existing allergy handling (user recipes are hand-entered —
decide and document whether they follow curated or imported rules under the
allergy guard BEFORE coding, with tests in the same commit). Extends the
standing RLS acceptance (decision 33). **Extra review gate applies (sync).**

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
