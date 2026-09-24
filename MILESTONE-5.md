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

## [x] M5.7 — Recipe expansion + accuracy pass (September 2026, on branch `claude/recipe-expansion-accuracy-ths4k0`; not yet deployed)

Ronnie's ask: adversarial review and bug fixing, **more recipes and variety
(including beef stroganoff)**, and a review of every recipe for accuracy — does
it actually produce a good dish, with steps an amateur can follow.

- [x] **+65 hand-authored mains** (`recipeBatch9.ts`, `recipeBatch10.ts`,
  `recipeBatch11.ts`): 245 → 310 curated. Weighted to the thinnest proteins
  (turkey 2 → 7, pork 17 → 29, lamb 9 → 11, eggs 8 → 12) and to family staples
  the library lacked (stroganoff, pot roast, chicken noodle soup, lasagna,
  fajitas, chicken tenders, pizza night, Texas chili …). First curated
  `Other`-cuisine dish (Korean bulgogi).
- [x] **Accuracy pass over all 295 existing hand-written recipes.** Fixed:
  food safety (ceviche no longer relies on lime to "cook" raw shrimp);
  undeclared allergens (trout amandine flour, Worcestershire = fish,
  tonkatsu sauce / curry roux = soy); vegetarian tags on dishes made with
  chicken broth or dashi; techniques that fail (katsu without flour, unbaked
  quiche crust, oyakodon/gyudon with a "splash" of liquid, smoked wings at
  250°F for 40 min, raw-chicken biryani, 45-minute lamb stew); and dozens of
  recipes whose key seasonings existed only as asides ("a pinch of sugar
  balances it") and so never reached the shopping list.
- [x] **Diet filter bug:** vegetarian/pescatarian trusted `primaryProtein`, so
  Quiche Lorraine (bacon) and an imported duck dish passed "vegetarian". Now
  tag-based, with a library-wide test (decision 41).
- [x] **Import allergen keywords broadened** (pasta shapes, breads, pastry →
  Gluten; mayo → Eggs; oyster sauce → Shellfish; Worcestershire/dashi →
  Fish; hummus → Sesame; pine nuts/pesto → Tree Nuts). 27 imported pasta
  dishes had been tagged gluten-free. `recipeImported.ts` regenerated;
  membership unchanged.
- [x] **Cook-mode timer** parses "1½ hours" / "2.5 hours" (was: no timer /
  a 5-hour timer).
- [x] Three pre-existing `checkIngredientConsistency` failures (Instant Pot
  units for bacon, pearl onions, curry roux) aligned.
- [x] ~~**Open, needs Ronnie:**~~ (fixed in M5.8) pantry-chip matching on the shopping list is a
  two-way substring ("Onions" drops green onions, "Rice" drops rice vinegar).
  See PROJECT.md §8. Not changed — it alters what lands on the list.

**Accept when:** typecheck clean, 506 tests green, 310/310 curated + 50/50
sides validate, all seven `scripts/check*.ts` harnesses pass. Verified.

---

## M5.8 — Post-M5.7 quality queue (September 2026, branch `claude/lucid-bardeen-ms2dl8`)

One task at a time, each proposed to Ronnie first. Baseline on a fresh
checkout of the live code: typecheck clean, 506 tests, 310/310 + 50/50
validate, all seven harnesses pass, import regeneration byte-identical.

- [x] **1. Shopping-list pantry matching** (shopping-list law; Ronnie approved
  the plan and all three recommended calls; **owes the advisor review**). One
  shared matcher (`src/engine/pantryMatch.ts`) now serves the list, the
  servings prompt, strict re-roll and the pantry score: same item after plural
  fold + allow-listed descriptors, or generic↔specific (chicken ↔ cuts, canned
  tomatoes ↔ crushed/diced). Varieties don't count ("Cheese" ≠ feta). Old vs new
  table in `PANTRY-MATCH-REVIEW.md` (COMMON_PANTRY: 17 still covered, 40 now on
  the list, 6 newly covered). Re-roll, same 60 seeded weeks: fully-cookable
  plates 72 → 89; 7 weeks lost one plate, every loss traced to an old false match
  (peanut butter as butter, egg noodles as eggs, beef broth as beef, cherry
  tomatoes as tomato). 506 → 545 tests.
- [x] **2. Optional ingredients on the shopping list** (Ronnie chose option b,
  content-only; list behaviour unchanged). New `validateRecipes` rule
  (`dietTagConflicts`): a vegan/vegetarian/dairy-free/gluten-free tag may not be
  contradicted by any ingredient (optional included) or declared allergen. It
  caught 3: minestrone + mujadara (garnish moved to a tip, Dairy allergen dropped
  with the ingredient), bolognese (kept the parmesan, lost its `dairy-free` tag).
- [ ] 3. Imported recipe cleanup — Ronnie (2026-09-24): lenient triage (fix
  what we can, drop only what's broken), refill dropped slots from the next
  candidates, ship to the live branch.
  - [x] 3a. British → US ingredient names + step wording (467 ingredient names
    across 71 distinct renames, 160 steps; zero change to allergens, diet
    tags, protein, departments, spice, membership). Unit groups 224 → 217.
  - [x] 3b. Unit spellings: 168 import quantities fixed (122 "tblsp"/"tbls"
    read as pieces → tbsp; splash/knob → tbsp; handfuls → cup; 26 garnish
    herbs pinch → 1 bunch). No other field changed. Unit groups 217 → 202.
  - [ ] 3c. Triage batches of ~30 (keep / fix / drop; refill dropped slots).
    Mechanism: `src/data/import/importOverrides.ts` (fixes patch raw text
    before inference; drops retire the id but keep it resolvable). The frozen
    fixture holds exactly 356 meals, all in use — no spare candidates to
    refill from. Ronnie chose (decision 45): drop without refill now, replace
    the lost variety with hand-written recipes later, alongside task 4.
    - [x] Batch 1 (30 thinnest): 27 fixed (steps split, °F, doneness temps,
      missing seasonings/amounts, 4 cooking bugs); 3 dropped (Sichuan long
      beans, chivito, grilled corn).
    - [x] Batch 2 (next 30): 25 fixed (4 recipes written for 1–2 scaled to 4,
      missing glaze/marinade/slaw ingredients, fridge not room-temp
      marinating, kidneys removed from hotpot); 5 dropped (ezme, flafla,
      avocado dip, salt cod tortilla, air-fryer bravas). 353 → 348 imports.
    - [x] Batch 3: 28 fixed (cannelloni listed cannellini beans instead of
      pasta tubes; rendang lacked its whole spice paste; summer rolls never
      cooked the chicken; bean soaks → canned); 2 dropped (broccoli tempura,
      pork buns). "Egg Plants" spelling falsely tripped the Eggs allergen —
      renamed on 2 recipes (Eggs label removed, ingredient gone). 348 → 346.
    - [x] Batch 4: 22 fixed, 1 kept as is (arroz al horno's dried beans and
      the Spanish spaghetti's 3-minute pasta would not cook; clotted cream →
      heavy cream; pho/fish broth scaled to 4); 7 dropped (veg chilli from
      packets, ramen with only the egg, raw stuffed peppers, arepa pabellón,
      carrot slaw, boxty breakfast, duck confit's 1–2 day cure). 346 → 339.
    - [x] Batch 5: 27 fixed, 1 kept (new `IMPORT_KEPT` list records reviewed
      keeps). Web-page junk steps removed (2); noodle salad listed pork AND
      steak versions (pork kept; Sesame dropped with the steak's seeds); hake's
      unsoaked dried beans → canned; fofos' potatoes never cooked; pad thai
      and prego scaled to 4; borsch's 5.5 lb potatoes → 1 1/4 lb. 2 dropped
      (bitterballen, conch fritters). 339 → 337.
    - [x] Batch 6: 22 fixed (Liège salad's eggs never boiled; plov's "lamb
      50 g" was the raisins; gratin never cooked its chicken; saganaki shrimp
      boiled twice; romesco shrimp served raw as a starter; Big Mac made 2 for
      4; three overnight bean soaks → canned). 8 dropped (silken tofu,
      shopska, croquetas, kadu borani, rice and peas, tamiya, morning glory,
      and a duplicate fettuccine Alfredo). 337 → 329.
    - [x] Batch 7: 17 fixed, 3 kept (kafteji's "24 eggs" → 8; pepitoria's
      eggs never boiled; beef chilli's 120C was mislabeled 225°F; Irish stew's
      overnight wheat berries left out — Gluten label goes with them). 10
      dropped (pork belly missing from its own list; mechado's steps belong
      to a kebob; frog legs tagged vegetarian; conch stew; cassava pizza;
      poutine; egg drop soup; semolina dumpling soup; molasses beans; a
      method-less Sunday roast). 329 → 319.
- [ ] 4. More sides
- [ ] 5. Nutrition refresh
- [ ] 6. Photos for the M5.7 recipes
- [ ] 7. Small content items (paneer twins, branzino count, label-check tips)

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
