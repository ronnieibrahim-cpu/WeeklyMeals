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
> **Last updated:** July 2026, at the close of Milestone 3 (v3.0) and the
> post-v3 adversarial debug sweep.

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
in progress, written from the Product Owner's friction journal, not a speculative
backlog:**
- **M4.0** — three bug fixes + virtualized recipe browse list. Shipped.
- **M4.1** — household composition → adult-equivalent servings. Shipped, then
  revised (plain editable age, no birthdate; `familySize` demoted to an invisible
  fallback). See Part 4's decision log for why.
- **M4.2 through M4.6** — not started. See `MILESTONE-4.md` for the full task specs
  (composed dinners, waste-fit scoring, recipe notes, component re-roll, week
  rearrange).

**Verified state at last gate:** typecheck clean, **224 tests passing**, 230/230
curated recipes pass the content validator, 586/586 recipes carry canonical
allergen labels.

---

## PART 3 — DOCUMENT HIERARCHY: WHAT TO READ, IN WHAT ORDER, AND HOW MUCH TO TRUST IT

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

### Blocking / accepted risk

1. **P0-2 — Supabase has no Row-Level Security. ACCEPTED RISK, not yet fixed.** An
   anonymous client (using the publishable key that ships in the web bundle) can
   enumerate every household code, equivalent to full read/write of every family's
   plan, shopping list, and dietary data. The 6-character household code is the
   only intended secret and RLS was always assumed but never configured. Currently
   accepted because the app is only on Ronnie's and his wife's phones. **Correct
   fix (not a bare dashboard toggle):** lock the `households` table down, add a
   `SECURITY DEFINER` Postgres function that gets/upserts a row by its code (the
   function scopes access, not a client-supplied filter), and repoint
   `src/data/sync/householdApi.ts` at that function. **Reopen trigger — now
   imminent:** syncing household composition (open item #2 below) would put
   children's ages on the wire under this exposure, which voids the acceptance.
   RLS must land before household composition sync is built.

### Live sync issues (surfaced by M4.1, being investigated for/under M4.2)

2. **Household composition does not sync.** `Profile.members` (M4.1: name/age/
   isChild/eatsLikeAdult) is local-only today — the sync payload
   (`src/data/sync/householdApi.ts`) has no `members` field. This is by design for
   now (a per-device profile field), pending a product decision on whether/how to
   sync it — see the P0-2 reopen trigger above; that decision can't ship until RLS
   does.
3. **A newly-approved plan sometimes doesn't appear on the second phone.** Reported
   live; not yet root-caused. Under investigation.

### Deferred by decision

4. **M3.6 — Photo accuracy QA.** A model pass to verify every matched photo actually
   depicts its dish (flag mismatches; a wrong photo is worse than none), ending in a
   flag list for Ronnie's human judgment. **Explicitly deferred as polish.**

---

## PART 6 — WHAT HAPPENS NEXT

At the close of v3, the recommendation was "stop building and start watching," and
Ronnie kept a friction journal — a note on his phone, one line whenever anyone in
the family hit a snag. That journal, not the old parked list, became the raw
material for **Milestone 4 ("Real Dinners, Right-Sized," `MILESTONE-4.md`)**, which
is now the **active milestone**. The triangle workflow (Ronnie steers and verifies →
Advisor audits, specs, writes prompts → Sonnet implements) is unchanged.

**Where M4 stands:** M4.0 (bug fixes + browse list) and M4.1 (household composition
→ adult-equivalent servings, revised) are shipped. M4.2 (composed dinners: main +
sides, "a dinner is a plate, not a dish") is next. M4.3–M4.6 (waste-fit scoring,
recipe notes, component re-roll, week rearrange) are specced in `MILESTONE-4.md`
but not started.

**The next gate is the M4 milestone audit** — same protocol as every prior gate:
clone, run the checks, read the code, read `git log` for unspecced commits, verify
Part 5's open items against the repo before signing off.

The parked list (leftovers-aware planning, thaw reminders, quantity-aware re-roll,
H-E-B Curbside export, household-synced user recipes, calendar integration) remains
*candidates*, not a plan — don't start any of it without Ronnie's explicit go-ahead.

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
