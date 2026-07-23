# ADVISOR-HANDOFF.md — Weekly Meals

> **Purpose:** This document exists so that a *new Claude instance, with no memory
> of any prior conversation, possibly a less capable model*, can pick up the role of
> Technical Advisor to this project and continue with **zero loss of context,
> rationale, or progress**.
>
> It is written to be read cold. It assumes you know nothing. It is deliberately
> long: fidelity beats brevity here. If you are that new instance — read this file
> completely before responding to the Product Owner about anything substantive.
>
> **Last updated:** July 2026, at the PARK point after Milestone 4 (all of
> M4.0–M4.7) shipped and Milestone 5 was started (M5.0 archive, M5.2 sweep, and
> M5.3 Vercel previews shipped; M5.1 photos live-but-partial; M5.4 not started).
> **This update was written by the implementing session's architect, not by an
> independent advisor — see Part 4 item 25 and Part 6: the next advisor's first
> job is the M4.3–M4.7 + M5.0–M5.1 close-out audit, and this file's claims are
> among the things to verify.**

---

## PART 1 — WHO IS WHO, AND WHAT YOUR JOB IS

### The Product Owner

**Ronnie.** A practicing anesthesiologist in Houston, Texas. He is **not a
programmer** and has no computer-science background. He is, however, sharply
engineer-minded: he reasons about systems, tradeoffs, and failure modes well,
and he genuinely wants to steer the product. He does not want to be shielded
from decisions — he wants to be shielded from *jargon*.

He is building this app for one household: himself, his wife, and two young
children. They shop at H-E-B. The app is not a startup, has no users beyond his
family, and is not intended to be commercialized. Its entire purpose is to
reduce the mental load of weekly meal planning for two busy parents.

**How to communicate with him (this is not optional — it is the working
contract):**
- Plain English always. No unexplained jargon. When a technical concept genuinely
  matters to a decision, explain it in one sentence with a concrete analogy.
- Reduce his cognitive load. That is literally the app's mission and it is also
  your mission in talking to him.
- **Make engineering decisions yourself.** Do not ask him "which pattern should
  we use?" Ask him "what should happen when the family re-rolls a meal they've
  already bought food for?"
- When a real product decision *is* needed: explain it briefly, recommend one
  option, say why, offer at most 2–3 genuine alternatives, and tell him which
  you would personally choose. He has explicitly asked to be asked *more*
  questions about product vision, not fewer.
- Be honest and push back when he's wrong. He has responded well to this every
  time (e.g., he proposed a Swift/iOS rewrite; the correct answer was "don't,
  here's why," and he accepted it immediately).
- Never flatter. Never pad. He notices.

### You (the Advisor)

You are the **Lead Staff Engineer / Principal Architect / Technical Product
Manager / long-term Technical Advisor**. You do not write production code
directly. You:
1. **Audit** the repository at milestone gates (independently, by actually
   reading and running the code — never by trusting documentation).
2. **Write specifications** — plain-English task specs with acceptance criteria,
   which become the milestone `.md` files in the repo.
3. **Produce copy-pasteable prompts** that Ronnie feeds to the implementation
   worker (see below). This is your primary deliverable format. He copies them
   verbatim; write them to be pasted, not paraphrased.
4. **Hold the product's memory and rationale** — the *why* behind every decision.
   That is the thing that is hardest to reconstruct and easiest to lose. It is
   preserved in Part 4 of this document.

### The Implementation Worker

A **Claude Code thread running Sonnet**, working directly in the GitHub repo.
Ronnie pastes your prompts into it. It implements, runs checks, commits, and
pushes. It reads `CLAUDE.md` in the repo root automatically at the start of
every session.

### The Triangle (the working methodology — preserve it)

```
   Ronnie (Product Owner)  ——  steers product, verifies in the live app
        ↑                ↓
   You (Advisor, chat)   ——  audits, specs, writes prompts, holds the "why"
        ↑                ↓
   Sonnet (Claude Code)  ——  implements, tests, commits
```

**The critical rule: the auditor must never be the implementer.** A thread that
wrote a feature cannot reliably see its own blind spots. This has been proven
twice on this project:
- The Sonnet thread that built both the re-roll feature *and* the pin-to-week
  feature could not see that pinning bypassed the allergy filter that re-roll's
  candidate generation had passed through. The advisor (fresh eyes, full product
  history) caught it in review before it shipped.
- A separate adversarial debug-sweep thread later found a live tree-nut allergy
  filter failure that the 169-test suite could not see, because the tests
  validated the *filter* and the *data* separately but never against each other.

So: **advisor finds, worker fixes, advisor re-verifies at the next gate.** If the
auditor also fixes, then at the next gate it is reviewing its own patches and the
independence is gone.

---

## PART 2 — WHAT THE APP IS AND WHERE IT STANDS

**Weekly Meals** is a React Native / Expo app (TypeScript, Zustand, AsyncStorage,
optional Supabase household sync). It runs as a **web app** deployed to GitHub
Pages, installed on the family's iPhones via Safari → Add to Home Screen.

**Repo:** `github.com/ronnieibrahim-cpu/WeeklyMeals`
**Working branch:** `claude/weekly-meals-app-eyowlr` (every push auto-deploys the
web build — treat every push as a deploy).

**The weekly loop:** Sunday intake (now with a "same as last week" fast path) →
engine generates a week of dinners from ~541 recipes → review/lock/swap → approve
→ consolidated H-E-B shopping list with prices → during the week: cook mode,
mid-week re-roll from ingredients already bought, rate-as-you-go, one shared
grocery list → ratings feed a learning loop that shifts future recommendations.

**Milestones completed:**
- **M1 — Trust & Safety:** theme persistence, single cost source, one-review-per-plan,
  real calendar dates ("Tonight" means tonight), allergy guard for imported
  recipes, per-item shopping-list sync merge, correctness cleanups.
- **M2 — Finish what's started:** strict mid-week re-roll, rate-as-you-go, fast
  intake, curated-first weighting, **the engine test suite**, learning loop wired,
  and a full cookbook-grade content pass on all 230 curated recipes.
- **M3 — The family's daily app (v3.0):** recipe browser with search/autocomplete/
  pin-to-week, synced family favorites, kids-approved badge, manual grocery items
  (one true list), cook mode with timers, family recipe entry.

**Then:** a one-time adversarial debug sweep (read-only, separate Fable thread in
Claude Code) produced `DEBUG-SWEEP.md`, finding two P0s plus P1/P2 items. **All are
now closed except P0-2 (Supabase RLS), which is an accepted risk — see Part 5.**

**Current state: Milestone 4 ("Real Dinners, Right-Sized," `MILESTONE-4.md`) is
COMPLETE — all of M4.0–M4.7 shipped and deployed (July 2026). It was written
from the Product Owner's friction journal, not a speculative backlog:**
- **M4.0** — three bug fixes + virtualized recipe browse list. Shipped.
- **M4.1** — household composition → adult-equivalent servings. Shipped, then
  revised (plain editable age, no birthdate; `familySize` demoted to an invisible
  fallback). See Part 4's decision log for why.
- **M4.2 — "a dinner is a plate, not a dish."** Shipped, both parts, and merged to
  `claude/weekly-meals-app-eyowlr` (deployed). Part 1 (data model + validation):
  `Recipe.role`/`Recipe.provides`, the 50-recipe `recipeSides.ts` library, the
  content/allergen/plausibility validator gates. Part 2 (actually composing
  plates): `src/engine/mealComposition.ts` (`composeSides`), `scoreSide`, the
  unified `RECIPES` pool split everywhere by the new `isMain()`, sides flowing
  through the shopping list/cost/cook mode/meal detail/strict re-roll/pin, and
  sync merge for `sideRecipeIds`. See Part 4 items 21 and 23 for the design and
  the corrections the advisor required before approving part 2.
- **M4.3 — waste-fit scoring ("use the whole cabbage").** Shipped: pure
  `src/engine/wasteFit.ts`, `WEIGHTS.wasteFit = 0.5` (evidence-swept, see Part 4
  item 27), wired into `scoreRecipe` AND `scoreSide`, `scripts/checkWasteFit.ts`
  harness (seeded/deterministic A/B, ~2.6% fewer single-use perishables),
  shopping-list "used in N meals" caption (display-only).
- **M4.4 — per-recipe family notes.** Shipped: `recipeNotesStore` + repository,
  synced per-recipeId newer-wins with empty-text-as-tombstone clears, editor
  under the steps on meal detail, quiet glyph on cards. Display-only, never
  feeds scoring.
- **M4.5 — component re-roll.** Shipped: `rerollCandidates(..., keep?)` with
  keep-sides→re-roll-main and keep-main→re-roll-sides modes, kept parts carried
  verbatim, strict whole-plate coverage both modes, store commit paths
  (`commitComponentReroll`/`rerollSidesOnly`) re-applying the allergy guard at
  the point of replacement (Law #5), Keep lock toggles on the re-roll screen.
- **M4.6 — rearrange the approved week.** Shipped SWIPE-ONLY (see Part 4 item
  26): pure `src/engine/rearrange.ts` `moveMeal` swaps whole meal bodies
  between uncooked days stamping `recipeChangedAtISO` on BOTH, swipe
  "Move to…" + day-picker sheet on This Week/Schedule, per-device cook-mode
  progress travels via `cookModeStore.swapProgress`. Race semantics: Part 4
  item 30.
- **M4.7 — two live bugfixes (from Ronnie's reports, mid-milestone).**
  (a) `syncNow()` reordered pull-before-push — the old push-first order made
  the approve-time reconcile a structural no-op, so manual items checked on
  the other phone survived `clearChecked()` week after week; plus revived
  items now stamp `checkedAtISO` so a stale remote check can't resurrect
  them pre-checked. (b) Shopping-list dedup by ingredient IDENTITY:
  `src/engine/ingredientKey.ts` (plural fold + mass/volume unit-family
  conversion), threaded through build/add/delta paths and re-roll coverage
  matching; 12 curated cross-family unit conflicts hand-aligned;
  `scripts/checkIngredientConsistency.ts` guards regressions. See Part 4
  items 28–29.

**Then Milestone 5 ("Look Back, Look Better") began and is PARKED mid-flight:**
- **M5.0** — rolling 6-week per-device "Past weeks" archive on Schedule. Shipped.
- **M5.1** — recipe photos at scale. Live but PARTIAL: harvested license-clean
  candidates for 170 photo-less recipes (88 had candidates), four parallel
  vision agents screened all 223 images against dish + primary protein, 55
  EXACT matches auto-wired into `recipeImages.ts` (52 Wikimedia w/ attribution,
  3 TheMealDB), 20 PLAUSIBLE + 13 rejects in `PHOTO-REVIEW-2.md` pending Ronnie.
- **M5.2** — adversarial bug sweep of the whole M4.3–M4.7 range. Done: no P0s;
  P1s F1/F6/F7 and P2s F4/F8a/F5 fixed, name-fold audit gap closed, four edges
  accepted (`PROJECT.md` §8).
- **M5.3** — Vercel branch previews (production stays on GitHub Pages). Shipped.
- **M5.4** — household-synced user recipes. Confirmed-next, not started.
- A **Basil green retheme** (separate design session) merged and deployed too.

**Verified state at last push (by the implementing session, pending advisor
audit):** typecheck clean, **398 tests passing**, 230/230 curated mains +
50/50 sides pass the content validator, 636/636 recipes carry canonical
allergen labels and plausible `provides`, and all four harness scripts
(`checkWasteFit`, `checkIngredientConsistency`, `checkCuratedWeighting`,
`checkKidApprovedWeighting`) PASS.

**⚠️ Process note the next advisor must not skip:** everything from M4.3
onward — through M5.1 — was implemented in ONE orchestrated worker session
that ALSO acted as its own reviewer and ran its own bug sweep (M5.2). That is
precisely the auditor-is-the-implementer setup Part 1 and decision 25 warn
against. The sweep found and fixed three P1s, which is evidence the code was
NOT clean on the first pass — treat the whole range as unaudited until an
independent advisor gate clears it.

---

## PART 3 — DOCUMENT HIERARCHY: WHAT TO READ, IN WHAT ORDER, AND HOW MUCH TO TRUST IT

**`ADVISOR-START-HERE.md` (repo root) is the cold-start entry point** — a new advisor
chat reads it first; it orients you and hands off to this file. It exists so a brand
new advisor has one obvious place to begin instead of guessing at reading order, and
is deliberately short and slow-changing — this file is still where the real state,
rationale, and open items live.

Documents can rot. Code cannot lie. The order below is a **trust hierarchy**, not
just a reading order.

| Priority | Source | What it gives you | Trust level |
|---|---|---|---|
| **0** | **The live repo itself** (clone it, read it, run it) | Ground truth | **Absolute.** Everything else is a claim about this. |
| **1** | **This file (`ADVISOR-HANDOFF.md`)** | Roles, methodology, decision rationale, open items | High — but verify its "current state" claims against the repo, since it may lag |
| **2** | **`PROJECT.md`** (repo root) | Canonical description of how the app actually works: architecture, data flow, stores, engine, known debt | High — it is maintained at every gate |
| **3** | **`MILESTONE-4.md`** (and `-1`, `-2`, `-3`) | The task specs and their acceptance criteria; what's shipped, active, and parked. `M4-PROMPTS.md` holds the ready-to-paste worker prompts for it | High for *intent*; check checkboxes against the code for *status* |
| **4** | **`DEBUG-SWEEP.md`** | The adversarial audit findings from the v3 gate | Historical — closed except P0-2 (accepted risk); see Part 5 |
| **5** | **`AUDIT.md`** (repo root) | The original full audit (July 2026). Historical: many items are now fixed | Medium — historical context, not current state |
| **6** | **`CLAUDE.md`** (repo root) | The worker's standing rules (binding on Sonnet, not on you) | High — but it's written *for the worker*, not for you |
| **7** | `RECIPE-CONTENT.md`, `PHOTO-REVIEW.md`, `scripts/` | Progress checklists and validation tooling | Medium |
| **8** | `docs/ARCHITECTURE.md`, `docs/PRD.md`, `docs/WIREFRAMES.md` | **STALE AND PARTIALLY FICTIONAL.** Describes modules that never existed. | **Low. Do not trust. `PROJECT.md` wins on every conflict.** |

### The verification-first protocol (do this at every gate — never skip it)

Before you make **any** claim about the state of this project, run the checks
yourself. Documentation lags; commits happen without you. Concretely:

```bash
git clone https://github.com/ronnieibrahim-cpu/WeeklyMeals.git
cd WeeklyMeals && git checkout claude/weekly-meals-app-eyowlr
npm install
npx tsc --noEmit                      # typecheck must be clean
npx jest                              # engine test suite must be green
npx tsx scripts/validateRecipes.ts    # 230/230 curated recipes must pass
git log --oneline -20                 # what actually happened recently
```

Then read the code in the areas you are about to opine on. **Auditing by reading
`PROJECT.md` is not auditing.** Every genuine finding this project has produced
came from reading the actual implementation. Also check `git log` for *unspecced*
commits — Ronnie sometimes steers the worker directly, and those commits are
where surprises live (they have all been fine so far, but they must be checked,
especially anything touching scoring, filters, or sync).

### How to synthesize the documents

- **State questions** ("is X done?") → answer from the **repo**, cross-checked
  against milestone checkboxes. Never from memory or from a doc alone.
- **Rationale questions** ("why is re-roll strict?") → answer from **Part 4 of
  this file**. This is the layer that is otherwise unrecoverable.
- **What's-next questions** → `MILESTONE-3.md`'s parked section + Part 5 below +
  Ronnie's friction journal (see Part 6).
- **If this file and the repo disagree: the repo is right, and you must then fix
  this file** in the same session (see Part 7, Maintenance).

---

## PART 4 — THE DECISION LOG (the irreplaceable part)

These are settled decisions with their reasoning. **Do not silently reverse any of
them.** If new evidence suggests one is wrong, say so explicitly to Ronnie, explain
what changed, and let him decide.

### Product-defining laws

1. **"Never silently modify the shopping list."** The list is the app's most-touched
   surface and the family's trust anchor. Features may *tell* the user "you'll need
   X, Y" and offer an **explicit** button to add items — but nothing may add,
   remove, or alter list items without the user asking. Applies to re-roll, pinning,
   and everything after.
   *Rationale: a surprise store trip destroys trust permanently; an explicit button
   costs one tap.*

2. **Strict mid-week re-roll.** Re-rolling Wednesday's dinner may only offer meals
   cookable from pantry + what's already on this week's shopping list (assumed
   bought) + staples. If nothing fully qualifies, show near-misses **labeled with
   exactly what's missing** rather than dead-ending.
   *Rationale: Ronnie's explicit call — "nobody is going back to H-E-B on a
   Wednesday." Strict is the whole point of the feature.*

3. **Never ask the user a question the code doesn't act on.** Two intake questions
   (leftovers, special occasions) were collected for months and never read by any
   code. They were removed. The Schedule screen's copy promising "leftover days"
   is being corrected for the same reason.
   *Rationale: fake questions and fake promises teach the user not to trust the app.*

4. **Allergy filtering is deterministic and safety-critical. Never delegate it to a
   model.** Any change to allergy/diet filtering ships with tests in the same commit.
   *Rationale: a false "safe" is the worst possible failure this app can produce.*

5. **Bug-free beats feature-rich. Always.** Reliability work precedes new features,
   every time. This was Ronnie's instruction from day one and it has held.

6. **Sundays trend toward zero effort.** The end state is the app opening with a
   drafted week and one question: "anything different?" Every intake change should
   move toward that.

7. **Remove clicks rather than add settings.** The best feature is the one the user
   never has to think about.

### Architecture laws (worth defending)

8. **The layering is an asset — preserve it.** `app/` screens are thin (no business
   logic). `src/stores/` orchestrate and persist. `src/engine/` is **pure**: no
   React, no I/O, no store imports — everything passed as arguments. `src/domain/`
   depends on nothing. All persistence flows through `src/data/repositories/` and
   all storage through `kvStore.ts`.
   *Rationale: this purity is exactly what made a 169-test engine suite possible,
   and it is why swapping H-E-B for another store, or local storage for a real
   backend, would not touch the UI.*

9. **The sync merge design.** Household sync (two phones, Supabase, ~20s poll,
   600ms debounced push) merges **per item / per meal** rather than
   whole-payload-last-write-wins. Rules that must hold:
   - Merges are **deterministic, commutative, and idempotent** (both phones must
     compute the same result regardless of order, or they ping-pong forever).
   - Newer timestamp wins per field; a missing timestamp = epoch 0; ties resolve
     deterministically.
   - `recipeChangedAtISO` gates meal-body divergence: if two devices hold different
     recipes for the same day, the newer one wins the **entire meal body** —
     ratings and cooked flags must never attach to a dish that was replaced.
   - Manual grocery items use **tombstones** (deletion markers) so a delete on one
     phone isn't resurrected by a phone that hasn't caught up, and are keyed by
     **normalized name** so two people adding "milk" converge to one row.
   *Rationale: every one of these rules exists because it was a real bug we caught
   in review before it shipped. This is the most subtly dangerous code in the app.*

10. **Generated files are never hand-edited.** `src/data/seed/recipeImported.ts` is
    generated by `scripts/importRecipes.ts` via `src/data/import/normalize.ts`.
    Change the generator and re-run.

11. **No new dependencies without asking Ronnie.** Exceptions granted so far:
    `jest-expo` (test suite), `expo-keep-awake` (cook mode).

### Decisions Ronnie made personally (do not re-litigate without him)

12. **Ratings:** one shared **family rating** (stars) plus a per-recipe
    **"Kids approved"** badge. *Not* per-person ratings.
13. **Favorites are shared/household-synced**, labeled "Family Favorites" in the UI —
    not "his" and "hers."
14. **Imported recipes when an allergy is set: EXCLUDE, don't warn.** The family
    currently has no allergies, but the guard is armed for the future (a diagnosis, a
    visiting relative). Imported recipes carry an "allergen info estimated" note on
    their detail screen regardless.
15. **Manual grocery items default to a bare name, no quantity** (a paper-list
    default). Quantity is available via edit.
16. **Calendar-aware planning: NOT YET.** Ronnie explicitly deferred it (it means the
    app reads the family calendar — a privacy shift). A manual "busy night" toggle is
    an acceptable interim if he ever asks. **Do not build calendar integration
    without his explicit, fresh go-ahead.**
17. **Stay a web app.** A Swift/native rewrite was considered and **rejected** — it
    would discard the test suite, the sync logic, and the whole workflow to gain
    nothing a family app needs. React Native already *is* native; the app is
    installed via Add-to-Home-Screen. A future TestFlight build (requires a $99/yr
    Apple Developer account, built via EAS in the cloud, no Mac needed) remains a
    legitimate *optional* upgrade path — not a rewrite. **Never propose a rewrite.**
18. **Photos: real, openly-licensed images only** (TheMealDB, Wikimedia/Openverse),
    never scraped from food blogs or image search. **A wrong photo is worse than no
    photo** — anything below a confident match keeps the clean cuisine-tile fallback.
    A human review gate (`PHOTO-REVIEW.md`) precedes wiring any photo in.
19. **Birthdate-based aging, rejected (M4.1).** The first M4.1 pass computed a
    child's age from a stored birthdate, so the app auto-advanced them into the
    next portion band. Reverted in favor of a plain number the user types in and
    updates by hand. *Rationale: a household crosses a portion band roughly once
    every few years — the "ages automatically" behavior solved a problem that
    barely exists, at the cost of date-parsing complexity and a birthdate field
    that itself carries more privacy weight than the number it replaces. Simplicity
    won.*
20. **`familySize` is now an invisible migration-only fallback (M4.1).** The
    Profile screen has no visible "Family size" control anymore. The members list
    (`Profile.members`) is the single source of truth once populated;
    `familySize` is read in exactly one place (`servingsPerMeal()`) so pre-M4.1
    profiles still compute a sane number on first load. *Rationale: two competing
    controls for the same number (a headcount field and a members list) is worse
    than one, even during a migration window.*
21. **A dinner is a composed plate, not a single dish (M4.2 direction).** Rather
    than hand-editing 586 recipes to force every one to carry a protein + vegetable
    + starch, dinners are assembled at generation time from a main recipe plus 0–2
    curated sides/sauces. *Rationale — the test is "meal vs. dish":* the recipe
    library is honestly a library of dishes, and a vegetable is a **preference**,
    not a **gate** — sides are purely additive, never a hard requirement that
    would shrink the candidate pool or break existing recipes. This keeps the 586
    recipes valid as-is and avoids a content-rewrite project.
22. **Week rearrange ships both interaction patterns (M4.6 direction), swipe
    guaranteed.** A "Move to…" swipe action (matching the existing swipe-to-delete
    on manual shopping items) is the guaranteed baseline; hold-to-drag is added
    alongside it, not instead of it. *Rationale: swipe is reliable on a phone and
    accessible; drag is nice-to-have and must not become the only path if it turns
    out fiddly in practice.*
23. **M4.2 part 2 corrections the advisor required before approving the plan
    (all shipped as specified):**
    - **`isMain()` is the single, canonical main/side split** — one function in
      `src/domain/models/recipe.ts`, not scattered ad-hoc filters. Every real
      consumer of the recipe pool was enumerated and classified (main-only /
      all-recipes / doesn't-care) before writing code, so standalone diagnostic
      scripts that import `RECIPES` directly are protected for free.
    - **`scripts/validateRecipes.ts`'s "curated mains" bucket had a real bug**
      (pre-merge, sides lack the `mealdb-` prefix just like curated mains do, so
      the old filter would run the protein-gate check on every vegetable-only
      side and fail all of them, and a separate `recipeSides` import would then
      double-count them against the now-unified `RECIPES` pool). Fixed by
      deriving `curatedMains`/`sides`/`allRecipes` from `isMain()` over the
      single unified pool.
    - **`varietyBonus` is dropped from side-scoring entirely, not rescoped.**
      The first proposal was to rescope it to the plate (pass the plate's own
      `selected` sides instead of the week's), but the advisor caught that this
      *inverts* the signal at plate scope: a side that fits the main's cuisine
      would be scored as a "repeat" and penalized for the exact thing that makes
      it a good pairing, and a legitimate second vegetable side would eat the
      same penalty a genuinely repetitive week-level pick should. `scoreSide`
      reuses every other `scoreRecipe` signal, plus a small standalone
      `cuisineFitBonus` against the main's cuisine.
    - **Re-roll candidates carry their composed sides through to commit,
      never recomputed.** `RerollCandidate`/`RerollNearMiss` now hold
      `{ recipe, sideRecipeIds }`; whatever `rerollCandidates()` composed and
      scored is exactly what gets committed — recomposing at commit time could
      silently pick a different (and unvetted-at-commit-time) set of sides.
    - **Side removal from an approved plan needs its own, separate shopping-list
      removal step**, computed via the existing `computeServingsDelta(recipe,
      servings, 0, pantry)` path (a full removal is just "servings → 0") plus a
      new `removesSource` flag on `applyShoppingListDelta`, so removing a side
      never strips an ingredient another recipe on the same plate still needs
      (e.g. two recipes sharing non-staple olive oil — removing one must not
      zero out the list entry the other still requires).
    - **Cook-mode progress invalidation is content-addressed, not
      timestamp-addressed:** `cookModePlateKey(recipeId, sideRecipeIds)` sorts
      the side ids before joining them, so a sync/recomposition ordering
      difference between two devices can never spuriously reset a family
      member's cook-mode progress.
    - **The pin-to-week / pin-to-draft guard is enforced at the store level**,
      not just by omitting a UI button — `isMain()` gates which recipes are
      pinnable at all, and composed sides at pin time are re-checked against the
      allergy guard explicitly, one at a time, mirroring Law #5 (pinning bypasses
      candidate generation, so the pin action itself must re-enforce every guard
      candidate generation would otherwise have applied).
    - **`composeSides` is best-effort, with no error states or nagging UI.** A
      plate that can't reach the vegetable-or-starch hard minimum still ships
      with whatever sides *did* qualify (possibly zero) — sides are additive,
      never a blocking gate (see decision 21).
    *Rationale for capturing these here individually, not just as "M4.2 shipped":*
    every one of these was a real correction the advisor caught before
    implementation, in the same spirit as decision 21 and the hard-won-lessons
    list below — a future advisor re-touching this code should not have to
    rediscover any of them from scratch.
24. **Deferred, not forgotten:** side-name deduping in `scripts/importRecipes.ts`
    (an imported side/sauce sharing a name with a hand-curated one) was
    explicitly declined for the M4.2 part 2 commit — noted as a follow-up, not
    silently dropped. No imported sides exist yet (the sides library is 100%
    hand-curated), so this has no live impact today; revisit if/when imported
    sides are ever added.

25. **M4.3–M4.7 were implemented in one orchestrated session WITHOUT per-task
    advisor gates (Ronnie's explicit call, July 2026).** Ronnie directed a
    Fable architect session to plan the remainder of M4, delegate
    implementation to Sonnet subagent workers, act as its own review gate,
    and deploy per finished task. The triangle's auditor-independence step
    was knowingly deferred, not forgotten — *rationale: speed, with the
    audit batched at the end instead of per task.* **Consequence for the
    next advisor: the M4.3–M4.7 range has had NO independent audit. That
    audit is the next gate, and the session's own docs (this file included)
    are claims to verify, not findings.**
26. **M4.6 ships swipe "Move to…" only; hold-to-drag deferred (Ronnie,
    July 2026 — amends decision 22).** Drag remains a possible follow-up if
    the family misses it. *Rationale: drag on iPhone-Safari-as-web-app is
    meaningfully more code and fiddlier; bug-free beats feature-rich.*
27. **`WEIGHTS.wasteFit = 0.5`, chosen by evidence sweep, hard-capped by the
    weight-discipline test.** Swept 0.35/0.5/0.7/1.0 on the seeded harness:
    0.5 roughly doubled 0.35's effect (consistent across 8 seed bases);
    0.7/1.0 reduced waste further but FAIL the untouched test asserting
    `wasteFit < variety/2`. *Rationale: the bonus exists to break ties, never
    to bury variety — the test is the contract, tuning happens under it.*
28. **Shopping-list identity: canonical name (plural fold) + unit-family
    conversion; never merge across families (M4.7).** "2 pieces" vs "1 lb"
    of chicken stay separate lines — merging them would require guessing a
    piece's weight, and a wrong guess corrupts the list silently. Imported
    recipes' 224 messy internal unit groups are a deferred CONTENT cleanup
    (reported info-only by `checkIngredientConsistency.ts`), not a bug.
    *Rationale: fix identity where it's provable; refuse to guess where it
    isn't.*
29. **`syncNow()` is pull-before-push, and that ordering is load-bearing.**
    Push-first stamps our own write as last-synced, making the following
    pull early-return — which silently defeated the approve-time reconcile
    `clearChecked()` depends on (the M4.7 bug). One narrow store-level test
    (`src/stores/syncStore.test.ts`, a documented `jest.config.js`
    exception) guards the ordering. *Rationale: the merge functions were
    always correct; the bug lived in the call order, so the regression test
    must too.*
30. **Week-rearrange race semantics (M4.6).** A swap stamps
    `recipeChangedAtISO` on BOTH affected meals so a remote device adopts
    both whole bodies together. Accepted deterministic outcomes, asserted in
    `syncMerge.test.ts`: a rating racing a swap of that day is dropped (same
    class as the re-roll-vs-rate race — the merge resolves per dayIndex and
    never migrates fields across days); two phones swapping overlapping days
    in the same window converge deterministically but NOT atomically (a
    "torn" week with one dish duplicated is possible — rare for two phones,
    fixable by hand, and determinism, not cross-day atomicity, is what the
    merge guarantees).

31. **Photo gate amended for the M5.1 bulk round (Ronnie, July 2026 — amends
    decision 18's PROCESS, not its substance).** Vision-screened EXACT matches
    (dish + protein visually confirmed, clean license) wire in directly;
    everything below that tier stays review-first in `PHOTO-REVIEW-2.md`.
    Non-negotiable condition Ronnie attached: **every auto-wired photo must be
    listed and one-line revertible** ("this didn't work" → reject by number →
    tile fallback returns). Licensed sources only and
    wrong-photo-worse-than-none remain fully in force.
32. **Production origin stays on GitHub Pages; Vercel is previews-only
    (Ronnie, July 2026).** Browser storage is origin-bound and the PWA is
    installed from the Pages URL — moving production would strand un-synced
    per-phone data (profile, pantry, ratings, cook progress) and force
    re-installs. `vercel.json` exists solely so branch pushes get
    phone-viewable preview URLs (e.g. for rethemes). Revisit only with a
    deliberate data-migration plan.
33. **M5 next confirmed feature: household-synced user recipes (Ronnie's
    pick, July 2026).** Leftovers-aware planning, quantity-aware re-roll, and
    thaw reminders were offered and NOT selected this round — they stay
    candidates, not commitments. User-recipe sync lands on the same unsecured
    household row under the standing RLS acceptance (decision on P0-2).
34. **Redesign Phase 4 — IA consolidation; the interim "Today" segment was axed
    for a single This Week view (Ronnie, July 2026).** The four-phase visual
    redesign (retheme → photo-forward cards → chrome unification → IA
    consolidation) closed with Phase 4: five tabs collapsed to four (**This Week
    · Recipes · Shopping · Profile**), the old Schedule tab folded into This
    Week, app Settings moved behind a NavHeader gear on Profile, and web ≥1024px
    gained a left sidebar. Phase 4 first shipped This Week as a "Today / Full
    week" segmented control; on device review Ronnie judged that toggle
    logically inconsistent (the "Full week" segment was also the *only* path to
    the Past-weeks archive) and carrying too little unique function to justify
    the confusion, so the toggle was removed. **This Week is now a single,
    always-visible full-week view with a "Past weeks" section collapsed at the
    bottom.** No capability was dropped: the draft/review banner, week-complete
    state, review/rating card, "plan a new week", and per-meal re-roll all fold
    into the single view, and `/schedule` deep links redirect to This Week.
    Presentation/navigation only — engine, store, selectors, allergy/household
    logic, product laws, and the full suite (398 tests) untouched. The redesign
    still owes an independent advisor pass, same as the M4.3–M5.1 range (Part 6).

### Hard-won lessons (the "how we got burned" list)

- **A pure engine plus a well-specced task is why Sonnet works here.** Vague specs
  produce drift. Every task spec must carry explicit **acceptance criteria**.
- **The worker drifts toward momentum.** It has started the next task without a
  check-in more than once. Every prompt must end with an explicit **"then STOP and
  wait."**
- **Test suites create false confidence.** 169 green tests did not catch a live
  allergy-filter failure, because the tests validated the filter and the recipe data
  *separately*. When you fix a bug, also **fix the blind spot that hid it** (in that
  case: add allergen validation to the recipe validator).
- **Reuse of a code path silently reuses its assumptions.** Pin-to-week reused
  re-roll's replacement function — and thereby skipped the hard filters that
  re-roll's *candidate generation* had already applied. When a feature reuses a
  path, ask what invariant the original caller was enforcing upstream.
- **Sync bugs hide in races nobody simulates.** Every sync change needs assertions
  for: convergence from both merge orders, idempotence, and the specific race the
  feature introduces.

---

## PART 5 — CURRENT OPEN ITEMS (verify each against the repo before acting)

> ⚠️ **This is the section most likely to be stale.** Check the repo and ask Ronnie
> what's landed since. But do not assume an item is done just because it's old.

### Debug-sweep status

**P0-1, P1-1, P1-2, P2-1, P2-2, P2-3 are all confirmed closed** (verified against
the code: allergen comparison is now normalized in
`src/engine/recommendation/filters.ts`, `scripts/validateRecipes.ts` checks
canonical allergen labels on all 586 recipes, the schedule screen no longer
promises leftover days, cook mode re-acquires the wake lock on
`visibilitychange`, `weekStartISO` is a local date string, `kvStore.getJSON` has a
shape guard). See `DEBUG-SWEEP.md` for the original findings; treat that file as
historical.

### Accepted risk (permanent — not open, not fixed, not to be re-flagged)

1. **P0-2 — Supabase has no Row-Level Security.** An anonymous client (using the
   publishable key that ships in the web bundle) can enumerate every household
   code, equivalent to full read/write of every family's plan, shopping list, and
   dietary data. The 6-character household code is the only intended secret and
   RLS was always assumed but never configured. **This is declined as a standing,
   informed choice by the Product Owner (Ronnie, July 2026) — not a bug to be
   fixed or a risk to be periodically reassessed.**
   **Rationale (verbatim):** "the only data in household sync is one family's meal
   plan, shopping list, manual items, favorites and kid-approved flags; the owner
   judges the exposure of that data — and the vandalism risk from anonymous write
   access — to be beneath the cost of acting on it. The app is used by two phones
   in one household and is not shared."
   **Profile-sync is a planned, knowingly-accepted extension of this same
   exposure, not a new decision point:** when household composition (members'
   abbreviated names and ages) starts syncing, that data lands on the same
   unsecured database under the same rationale. There is no reopen trigger tied to
   that milestone — this is the standing decision.

### Live sync notes (surfaced by M4.1)

2. **Household composition does not sync.** `Profile.members` (M4.1: name/age/
   isChild/eatsLikeAdult) is local-only today — the sync payload
   (`src/data/sync/householdApi.ts`) has no `members` field. Profile-sync (see the
   accepted-risk note above) is the planned next step for this.
3. **A newly-approved plan sometimes doesn't appear on the second phone** —
   resolved after the M4.1 updates. If it recurs, investigate as a merge race.

### Deferred by decision

4. **M3.6 — Photo accuracy QA.** A model pass to verify every matched photo actually
   depicts its dish (flag mismatches; a wrong photo is worse than none), ending in a
   flag list for Ronnie's human judgment. **Explicitly deferred as polish.**
5. **Side-name deduping in `scripts/importRecipes.ts` (M4.2 follow-up).** See
   decision 24 in Part 4. No live impact today (the sides library is entirely
   hand-curated, no imported sides exist yet) — revisit only if imported sides
   are ever added.
6. **Imported-recipe ingredient-unit cleanup (M4.7 follow-up).** The 356
   `mealdb-` recipes carry ~224 same-ingredient cross-family unit groups
   internally (e.g. "onion" as piece/mass/volume across recipes) —
   `scripts/checkIngredientConsistency.ts` reports them info-only. Editorial
   content work via `normalize.ts` + regeneration, not a bug; see Part 4
   item 28.
7. **M4.6 hold-to-drag (deferred by decision 26).** Only if the family
   actually misses it.

---

## PART 6 — WHAT HAPPENS NEXT

Milestone 4 is complete and Milestone 5 ("Look Back, Look Better,"
`MILESTONE-5.md`) is PARKED mid-flight (see Part 2 for the per-task status).
The last stretch — M4.3 through M5.1 — was implemented in one orchestrated
worker session that acted as its own reviewer and ran its own bug sweep, at
Ronnie's explicit direction (Part 4 item 25). The triangle workflow (Ronnie
steers and verifies → Advisor audits, specs, writes prompts → worker
implements) resumes from here.

**The next gate is the FULL M4.3–M4.7 + M5.0–M5.1 close-out audit, and it is
not optional housekeeping — that whole range shipped with no independent
review, and the one sweep that did run (M5.2) was run by the implementing
session itself and still surfaced three P1s.** Same protocol as every prior
gate: clone, run the checks and all four harness scripts, read the code, read
`git log`. Priority reading order for the auditor:
(1) `src/engine/ingredientKey.ts` + the M4.7 changes to `shoppingList.ts`'s
delta paths, and the F1 fix in `previewServingsDelta`/`previewRemoveSideDelta`
(Law #1 territory — cross-unit merged lines must never corrupt an
explicit-button delta or its disclosure copy); (2) `syncStore.ts`'s
pull-before-push and the `clearChecked` reconcile path, plus the F4 rename
revive-stamp in `manualItemsStore.ts`; (3) `planStore.ts`'s M4.5 commit actions
(`commitComponentReroll`/`rerollSidesOnly` — Law #5 re-checks AND the F5
cooked/`expectedRecipeId` guards) and the M4.5 additions to `reroll.ts`;
(4) `rearrange.ts` + the three swap-race assertions in `syncMerge.test.ts`
(verify the "torn week" and dropped-rating outcomes are acceptable to Ronnie,
not just documented); (5) `wasteFit.ts` and whether 0.5 shows any variety
regression in real weeks (the F7 fix changed the measured signal — re-run
`checkWasteFit`); (6) M5.0 `planHistory.ts`/`planHistoryStore.ts` (the F8a
hydration guard) and the M5.1 photo wiring in `recipeImages.ts` (spot-check a
sample of the 55 auto-wired images actually depict their dish — the vision
screen was strict but is not infallible; `PHOTO-REVIEW-2.md` is the record).
Verify Part 5's open items and §8's accepted edges against the repo before
signing off.

**Immediate product to-dos waiting on Ronnie (not the advisor):** review the
20 PLAUSIBLE photos in `PHOTO-REVIEW-2.md`; flag any wrong auto-wired photo
(one-line revert to the tile). **Next confirmed feature after the audit: M5.4
household-synced user recipes** (spec sketch in `MILESTONE-5.md`; sync +
allergy-handling decisions to make BEFORE coding, tests in the same commit —
extra review gate applies). The remaining parked list (leftovers-aware
planning, thaw reminders, quantity-aware re-roll, H-E-B Curbside export,
calendar integration) stays *candidates* — don't start any of it without
Ronnie's explicit go-ahead.

---

## PART 7 — MAINTENANCE: KEEPING THIS HANDOFF LOSSLESS

The single greatest risk to this project is **documentation rot** — it is exactly
what made `docs/ARCHITECTURE.md` worthless (it describes modules that never
existed) and it is why `PROJECT.md` had to be written in the first place.

**Rules for the advisor (you), at every gate:**

1. **After every milestone gate audit**, update:
   - `PROJECT.md` — if behavior or architecture changed (the worker should do this,
     but *you verify it*).
   - **This file (`ADVISOR-HANDOFF.md`)** — Part 2 (state), Part 4 (any new
     decision, with its rationale), Part 5 (open items), Part 6 (what's next).
2. **Every product decision Ronnie makes goes into Part 4 immediately, with its
   reasoning.** A decision without its rationale will be re-litigated by a future
   instance, and that is exactly the kind of loss this document exists to prevent.
3. **Every bug found in review goes into Part 4's "hard-won lessons"** if it teaches
   a general principle — the point is that the *class* of bug becomes catchable.
4. **When a fix prompt is handed to Ronnie, record it in Part 5 as open** until it's
   verified landed. Prompts get lost between chat sessions; open items must survive.
5. **Never delete rationale to save space.** Compress *status*, never *why*.
6. If you are a new instance and you find this file contradicts the repo: **trust the
   repo, then fix this file in the same session, and tell Ronnie you did.**

---

## PART 8 — QUICK REFERENCE

**Standing prompt pattern for the Sonnet worker** (Ronnie pastes these verbatim —
always end with the stop instruction):

> Read `CLAUDE.md` and `MILESTONE-N.md`. Implement task X exactly as specified.
> Propose your plan in plain English FIRST and wait for approval. Then implement;
> run `npm run typecheck`, `npx jest`, and `npx tsx scripts/validateRecipes.ts`
> (all must be green); update `PROJECT.md` if behavior changed; check the task off
> with a one-line note; give a 2–4 sentence plain-English summary plus exactly what
> to verify in the live app; **then STOP and wait.** Do not start the next task.

**Check-in cadence that has worked:**
- Any task that touches **sync, allergy filtering, or the shopping list** → Ronnie
  pastes the worker's *plan* to the advisor **before** approving it. This is where
  every serious bug has been caught.
- Self-contained UI tasks → Ronnie verifies solo against the acceptance criteria.
- **Every milestone close → full advisor audit gate** (clone, run the checks, read
  the code, read `git log` for unspecced commits).

**The verification commands** (run them; don't trust docs):
```bash
npm install && npx tsc --noEmit && npx jest && npx tsx scripts/validateRecipes.ts
```

**The mission test for every proposed feature:**
> *Does this meaningfully reduce decision fatigue for a busy family?*
> If not, question whether it belongs.
