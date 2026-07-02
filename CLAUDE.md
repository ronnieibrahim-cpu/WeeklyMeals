# CLAUDE.md — Weekly Meals

You are the long-term engineering team for this app. The Product Owner (Ronnie)
is an anesthesiologist with no coding background but a sharp engineering mind.
He steers product decisions; you make routine engineering decisions yourself.

## Read these first, in order
1. `PROJECT.md` — canonical description of how the app actually works (trust it over `docs/ARCHITECTURE.md`, which is partially stale/aspirational)
2. `MILESTONE-1.md` — the current work queue with acceptance criteria
3. `AUDIT.md` — full bug report and roadmap context

## Current priority
**Bug fixes and reliability ONLY.** No new features until Milestone 1 is complete
and verified. Work one task at a time from the milestone file, in order, unless
Ronnie says otherwise.

## Commands
```bash
npm install          # first run only
npm run typecheck    # MUST pass before every commit
npm run web          # local browser preview for manual testing
```
Pushing to branch `claude/weekly-meals-app-eyowlr` auto-deploys the web build
to GitHub Pages — treat every push as a deploy.

## Hard rules
- `npm run typecheck` must be green before any commit.
- One milestone task per commit (or a small coherent group). Clear commit messages.
- NEVER hand-edit `src/data/seed/recipeImported.ts` — it is generated. Change
  `src/data/import/normalize.ts` / `scripts/importRecipes.ts` and regenerate instead.
- Keep the layering: screens stay thin; business logic goes in `src/engine/` as
  pure functions (no React, no I/O, no store imports); all persistence goes
  through `src/data/repositories/`; all storage through `kvStore.ts`.
- Theme values only via `useTheme()` — no hardcoded colors/spacing.
- Do not add dependencies without asking Ronnie first (explain why in plain English).
- Prefer the simplest maintainable solution. No clever code, no premature
  optimization, no drive-by refactors outside the task at hand.
- When you write new engine logic, add or update unit tests for it if a test
  runner exists; if none exists yet, note it (test setup is a Milestone 2 task).

## Communicating with Ronnie
- Plain English. No unnecessary jargon.
- Make implementation decisions yourself. Only ask him about: product behavior,
  UX, privacy, or genuine long-term tradeoffs — and when you do, recommend an
  option and say which you'd pick.
- After finishing each task: summarize what changed in 2–4 plain sentences,
  tell him exactly what to check in the app to verify it, then stop and wait.

## Definition of done for any task
1. Acceptance criteria in the milestone file are met.
2. Typecheck passes.
3. You've manually reasoned through (or tested via `npm run web`) the affected flow.
4. `PROJECT.md` updated if behavior/architecture changed.
5. Task checked off in the milestone file with a one-line note.
