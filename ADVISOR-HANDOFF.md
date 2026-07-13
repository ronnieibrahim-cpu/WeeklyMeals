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

**Verified state at last gate:** typecheck clean, **169 tests passing**, 230/230
curated recipes pass the content validator.

**Then:** a one-time adversarial debug sweep (read-only, separate Fable thread in
Claude Code) produced `DEBUG-SWEEP.md`. It found two P0s. **Their status is in
Part 5 — CURRENT OPEN ITEMS. Read that section before doing anything else.**

---

## PART 3 — DOCUMENT HIERARCHY: WHAT TO READ, IN WHAT ORDER, AND HOW MUCH TO TRUST IT

Documents can rot. Code cannot lie. The order below is a **trust hierarchy**, not
just a reading order.

| Priority | Source | What it gives you | Trust level |
|---|---|---|---|
| **0** | **The live repo itself** (clone it, read it, run it) | Ground truth | **Absolute.** Everything else is a claim about this. |
| **1** | **This file (`ADVISOR-HANDOFF.md`)** | Roles, methodology, decision rationale, open items | High — but verify its "current state" claims against the repo, since it may lag |
| **2** | **`PROJECT.md`** (repo root) | Canonical description of how the app actually works: architecture, data flow, stores, engine, known debt | High — it is maintained at every gate |
| **3** | **`MILESTONE-3.md`** (and `-1`, `-2`) | The task specs and their acceptance criteria; what was decided and what's parked | High for *intent*; check checkboxes against the code for *status* |
| **4** | **`DEBUG-SWEEP.md`** | The adversarial audit findings from the v3 gate | High for findings; **status may be stale — verify each finding is still live** |
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

### Blocking / safety

1. **P0-1 — Tree-nut allergy filter failure.** The canonical allergy list uses
   `'Tree Nuts'` (with a space); three curated recipes label the allergen
   `'TreeNuts'` (no space), so the string comparison in
   `src/engine/recommendation/filters.ts` (`passesAllergySafety`) lets them through
   when a Tree Nuts allergy is set. **A fix prompt was written and handed to Ronnie**
   (root-cause fix: canonicalize the data *and* normalize the comparison, plus add
   allergen validation to `scripts/validateRecipes.ts` so the bug class becomes
   self-detecting). **Verify whether it landed.** Test for it: set a Tree Nuts
   allergy and confirm `fr-trout-amandine` cannot be generated, swapped, re-rolled,
   or pinned.

2. **P0-2 — Supabase has no Row-Level Security.** *This is not a code fix — it is a
   settings change in Ronnie's Supabase dashboard.* The debug sweep confirmed live
   that an anonymous client (using the publishable key that ships in the web bundle)
   can enumerate every household code, which is equivalent to full read/write of
   every family's plan, shopping list, and dietary data. The 6-character household
   code is the only intended secret and RLS was always assumed but never configured.
   **Status: Ronnie was asked whether the app has been shared beyond his and his
   wife's phones (which determines urgency, not whether to fix). Follow up on this.**
   The fix: an RLS policy on the `households` table so anonymous select/upsert only
   match a row whose `code` is supplied as a filter — never a bare `select *`.

### Queued fixes from the debug sweep (see `DEBUG-SWEEP.md` for full detail)

3. **P1-1** — `scripts/validateRecipes.ts` has no allergen validation (this is the
   safety net that would have caught P0-1). Bundled with the P0-1 fix prompt.
4. **P1-2** — `app/(tabs)/schedule.tsx` empty-state copy promises "leftover days and
   a meal-prep tip" that don't exist, and shows a hardcoded generic "tip" on every
   plan. Violates law #3. Remove the promises; don't build leftovers now.
5. **P2-1** — Cook mode's keep-awake doesn't re-acquire the wake lock after the
   browser releases it (tab switch, screen dim), so the screen sleeps mid-recipe
   after the first interruption. Needs a `visibilitychange` re-acquire.
6. **P2-2** — `weekStartISO` is stored as a UTC instant, so a device in another
   timezone computes the wrong day offset. Store as a plain `YYYY-MM-DD` local date
   string. (Latent today — both phones are in Houston — real the moment they travel.)
7. **P2-3** — `kvStore.getJSON` guards against unparseable JSON but not valid-JSON-
   wrong-shape, which can white-screen a tab on hydration. Needs a light shape guard.
8. **P3 (parked)** — dead store actions with no UI (`reset`/`clear`), no
   keyboard-avoidance around the inline manual-item editor, `docs/ARCHITECTURE.md`
   drift.

### Deferred by decision

9. **M3.6 — Photo accuracy QA.** A model pass to verify every matched photo actually
   depicts its dish (flag mismatches; a wrong photo is worse than none), ending in a
   flag list for Ronnie's human judgment. **Explicitly deferred as polish** — do
   after the sweep fixes, not before.
10. **Milestone 4 — deliberately unplanned.** See Part 6.

---

## PART 6 — WHAT HAPPENS NEXT (and why "nothing" is the right answer for now)

At the close of v3, the recommendation was: **stop building and start watching.**
The app now covers every moment of the family's week (Sunday planning, the store
trip, mid-week re-rolls, cooking, rating). Everything remaining on the backlog is
speculative until real use proves it matters.

**Ronnie was asked to keep a friction journal** — a note on his phone, one line
whenever anyone in the family hits a snag ("wife typed milk, it was already there,"
"kids fought the cook-mode timer," "wanted to plan around a birthday and couldn't").
**Three weeks of that is better product input than any feature brainstorm.** When he
returns with it, that journal — not the parked list — should be the raw material for
Milestone 4.

**If he asks "what's in M4?" the honest answer is: it should be written by his
Tuesdays, not by us.** The parked list (leftovers-aware planning, thaw reminders,
quantity-aware re-roll, H-E-B Curbside export, household-synced user recipes,
calendar integration) exists as *candidates*, not a plan.

The first thing to do when he returns, before any M4 talk: **confirm the P0 items
from Part 5 are actually closed.**

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
