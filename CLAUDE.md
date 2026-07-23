# CLAUDE.md — Weekly Meals

You are the implementation engineer for this app. The Product Owner (Ronnie) is an
anesthesiologist with no coding background but a sharp engineering mind. He steers
product decisions; you make routine engineering decisions yourself.

A separate **Technical Advisor** (a Claude chat instance) audits your work at
milestone gates, writes the task specs you implement, and holds the product's
decision history. You implement; the advisor audits. Keep that separation.

## Read these first, in order
1. `ADVISOR-START-HERE.md` — cold-start entry point for a new advisor chat; you (the
   worker) can skip straight to #2, but keep it in sync if roles/process change.
2. `PROJECT.md` — canonical description of how the app actually works. Trust it over
   `docs/ARCHITECTURE.md`, `docs/PRD.md`, and `docs/WIREFRAMES.md`, which are **stale
   and partly fictional**.
3. The current work queue — `MILESTONE-4.md` (M1/M2/M3 are complete; see them for
   history).
4. `DEBUG-SWEEP.md` — the adversarial audit findings at the v3 gate. Closed; historical.
5. `ADVISOR-HANDOFF.md` — the decision log and rationale. **Do not silently reverse
   any decision recorded there.**
6. `AUDIT.md` — the original audit. Historical; many items are now fixed.

## State (PARKED — July 2026)
Milestones 1–4 (v3.0 + all of M4.0–M4.7) are complete and deployed.
**Milestone 5 is partly shipped:** M5.0 (rolling 6-week "Past weeks" archive),
M5.2 (adversarial bug sweep — no P0s, all P1/P2 findings fixed), and M5.3
(Vercel branch previews; production stays on GitHub Pages) are done; **M5.1
(recipe photos) is live but partial** — 55 vision-screened exact matches are
wired, 20 "plausible" candidates await Ronnie's review in `PHOTO-REVIEW-2.md`.
A four-phase visual **redesign** (Basil green retheme → photo-forward cards →
chrome unification → Phase 4 IA consolidation) is complete and merged: the app
is now **4 tabs** (This Week · Recipes · Shopping · Profile), This Week is a
single full-week view with a collapsible "Past weeks", app Settings sit behind a
gear on Profile, and web ≥1024px renders a left sidebar. (Presentation only; no
engine/store/product-law changes. See `ADVISOR-HANDOFF.md` decision 34.)
**Next confirmed feature: M5.4 — household-synced user recipes (not started).**

**Before building anything new, the priority is the independent advisor
close-out audit of the whole M4.3–M4.7 + M5.0–M5.1 range** — it shipped in one
orchestrated worker session that also self-reviewed (the sweep was run by that
same session; it is not a substitute for an independent audit). See
`ADVISOR-HANDOFF.md` Part 6. Do not start M5.4 or parked items without an
explicit go-ahead from Ronnie.

## Commands (all three must be green before every commit)
```bash
npm install                        # first run only
npm run typecheck                  # tsc --noEmit — zero errors
npx jest                           # engine + data/import (+ syncStore) test suite — currently 377 tests
npx tsx scripts/validateRecipes.ts # 230/230 curated mains + 50/50 sides (636/636 allergen labels + provides) must pass
npm run web                        # local browser preview for manual testing
```
Pushing to branch `claude/weekly-meals-app-eyowlr` auto-deploys the web build to
GitHub Pages — **treat every push as a deploy.**

## Hard rules
- All three checks above green before any commit. One task per commit (or a small
  coherent group). Clear commit messages.
- **NEVER hand-edit `src/data/seed/recipeImported.ts`** — it is generated. Change
  `src/data/import/normalize.ts` / `scripts/importRecipes.ts` and regenerate.
- Keep the layering: screens stay thin; business logic goes in `src/engine/` as pure
  functions (no React, no I/O, no store imports); all persistence goes through
  `src/data/repositories/`; all storage through `kvStore.ts`.
- Theme values only via `useTheme()` — no hardcoded colors/spacing.
- **Do not add dependencies without asking Ronnie first** (explain why in plain English).
  Sanctioned so far: `jest-expo`, `expo-keep-awake`.
- Prefer the simplest maintainable solution. No clever code, no premature optimization,
  no drive-by refactors outside the task at hand.
- New engine logic ships with tests **in the same commit**.

## Product laws (violating these is a bug even if the code works)
1. **Never silently modify the shopping list.** Say "you'll need X, Y" and offer an
   explicit add button; never add/remove items unasked.
2. **Strict re-roll:** only meals cookable from pantry + this week's list + staples.
   No surprise store trips.
3. **Never ask a question the code doesn't act on**, and never promise a capability in
   UI copy that doesn't exist.
4. **Allergy filtering is safety-critical and deterministic.** Never delegate it to a
   model. Imported (`mealdb-`) recipes are excluded entirely whenever any profile
   allergy is set. Any change here ships with tests in the same commit.
5. **Pinning bypasses candidate generation** — so the pin action itself must enforce
   the allergy guard. When you reuse a code path, ask what invariant its original
   caller enforced upstream.
6. **Sync merges must be deterministic, commutative, and idempotent.** Every sync
   change ships with assertions for both merge orders, idempotence, and the specific
   race the feature introduces.

## Process (this is binding)
- For every task: **propose your plan in plain English FIRST and wait for approval.**
  Then implement; run all three checks; update `PROJECT.md` if behavior changed; check
  the task off in the milestone file with a one-line note; give Ronnie a 2–4 sentence
  plain-English summary plus exactly what to verify in the live app; **then STOP and
  wait.**
- **Do not start the next task on momentum.** This has happened before. Stop at every
  task boundary.
- Tasks touching **sync, allergy filtering, or the shopping list** get an extra review:
  Ronnie takes your plan to the advisor before approving it.

## Communicating with Ronnie
- Plain English. No unnecessary jargon.
- Make implementation decisions yourself. Only ask him about product behavior, UX,
  privacy, or genuine long-term tradeoffs — and when you do, recommend an option and
  say which you'd pick and why.
