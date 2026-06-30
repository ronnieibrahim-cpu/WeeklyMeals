# Weekly Meals

A polished, Apple-like mobile app that **eliminates weekly dinner planning**. Every
Sunday it asks a few quick questions, then generates a full week of dinners — recipes,
a cooking schedule, a leftover plan, and one consolidated **H-E-B** shopping list with
an estimated cost — and **gets smarter every week** from your ratings.

Built with **Expo + React Native + TypeScript**, targeting **native iOS and web** from a
single codebase.

## Status

Built incrementally. Current progress:

- ✅ **Step 1 — Product Requirements** (`docs/PRD.md`)
- ✅ **Step 2 — UX Wireframes** (`docs/WIREFRAMES.md`)
- ✅ **Step 3 — Folder Architecture & Data Model** (`docs/ARCHITECTURE.md`)
- ✅ **Step 4 — Project scaffold** (themed, navigable 4-tab app; typechecks and builds for web)
- ⏳ **Step 5 — Features** (intake → meal generation → shopping list → schedule → weekly learning)

## Run it

```bash
npm install
npm run web      # open in a browser (and "Add to Home Screen" on iPhone)
npm run ios      # open in Expo Go on an iPhone
npm run typecheck
```

## Project layout

```
app/        Expo Router screens (tabs, plan modal, meal detail, settings)
src/
  domain/   Pure types + constants (Recipe, Profile, WeeklyPlan, …)
  engine/   Recommendation, shopping-list, cost, schedule, learning (pure logic)
  data/     Local storage + H-E-B pricing + seed recipes (swappable behind interfaces)
  stores/   Zustand state
  ui/       Theme (light/dark) + reusable components
docs/       PRD · Wireframes · Architecture
```

See `docs/` for the full product and engineering design.
