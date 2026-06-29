# Weekly Meals — Product Requirements Document (PRD)

> **Status:** Draft v1.0 · **Owner:** Ronnie Ibrahim · **Date:** 2026-06-29
> **Platform:** iOS (primary) via Expo / React Native · **Language:** TypeScript

---

## 1. Vision

**Weekly Meals exists to completely eliminate the weekly chore of "what's for dinner?"**

Every Sunday, the app asks a short series of questions, then produces a full week
of dinners: recipes, a cooking schedule, a leftover plan, and a single H-E-B
shopping list with an estimated cost. After the week, the app asks how the meals
went and **gets smarter every week**, learning the household's tastes so future
weeks need less input and produce better meals.

### Guiding principle
The app should feel like a calm, confident personal chef — not a database.
The user should be able to go from "I have no idea what to cook" to "the week is
planned and the groceries are listed" in **under three minutes**.

---

## 2. Target User

- **Primary:** A busy home cook / parent who plans dinners for a household of
  2–6 people, shops primarily at **H-E-B**, and wants to reduce decision fatigue,
  food waste, and overspending.
- **Tech level:** Comfortable using consumer apps (Instagram, Apple Reminders),
  not technical.
- **Emotional job-to-be-done:** "Take the mental load of dinner off my plate and
  make me feel like a competent, organized cook."

---

## 3. Goals & Non-Goals

### 3.1 Goals (v1)
1. Generate **7 personalized dinner recommendations** from a short Sunday intake.
2. Produce **one consolidated H-E-B shopping list** organized by department.
3. Estimate **total grocery cost** and **cost per serving**.
4. Produce a **cooking schedule** and a **leftover plan** across the week.
5. Provide complete **recipes** (ingredients, steps, nutrition, freezing/leftover notes).
6. Run a **weekly review** and use ratings to improve future weeks.
7. Maintain a **long-term preference profile** for the household.
8. Work **offline**, store data **locally**, with a clean path to cloud sync later.
9. Feel **polished enough to ship on the App Store**.

### 3.2 Non-Goals (v1 — explicitly deferred)
- No live grocery ordering / checkout (Instacart, HEB Curbside) — *architected for, not built*.
- No multi-store optimization (Costco, Whole Foods, Kroger, Walmart, Amazon Fresh) — *one store: H-E-B*.
- No account system / cloud login — *local-first; migration path designed in*.
- No photo recognition, barcode scanning, voice input, Apple Health/Watch/Widgets — *future*.
- No real-time third-party recipe API in v1 — *seeded recipe library + deterministic engine*.

---

## 4. Success Metrics

| Metric | Target |
| --- | --- |
| Time to complete Sunday intake | < 3 minutes |
| Weeks where user approves the plan without major edits | > 70% |
| Weekly review completion rate | > 50% |
| Recommendation quality (avg meal rating trending up over time) | Upward week-over-week |
| Cost estimate accuracy vs. real receipt | Within ±15% |
| App cold-start to interactive | < 2 seconds |
| Crash-free sessions | > 99.5% |

---

## 5. Core User Flows

### 5.1 The Sunday Plan (primary loop)
1. **Prompt:** "Let's plan this week's dinners."
2. **Intake questionnaire** (smart defaults pre-filled from profile; most answers are one tap):
   - How many dinners? (default 7)
   - How many people?
   - Budget?
   - Maximum prep time?
   - Maximum cook time?
   - Desired cuisines? (multi-select)
   - Healthy ↔ comfort food? (slider)
   - Dietary restrictions / allergies?
   - Ingredients already at home?
   - How adventurous this week? (slider)
   - Special occasions?
   - Desired leftovers?
3. **Generation:** App produces 7 dinners with the recommendation engine.
4. **Review & swap:** User can swap any individual meal (regenerate one slot),
   lock meals they like, and regenerate the rest.
5. **Approve.**
6. **Outputs unlocked:** shopping list, cost estimate, cooking schedule, leftover plan.

### 5.2 The Weekly Review (learning loop)
For each cooked meal, ask:
- Did you cook it?
- How much did you enjoy it? (1–5)
- Would you cook it again?
- Would your family eat it again?
- Too much prep? · Too expensive? · Too spicy? · Too bland? · Too many leftovers?

Results feed the preference profile and adjust future scoring.

### 5.3 Profile Setup (one-time, editable anytime)
Family size, children & ages, allergies, favorite/disliked cuisines, preferred/disliked
proteins & ingredients, kitchen equipment, cooking skill, budget, available cooking time,
preferred shopping day, meal-prep day, nutrition priorities, desired leftovers,
target calories & protein, favorite store (default H-E-B).

---

## 6. Functional Requirements

### 6.1 Meal generation
- Produce N dinners (default 7) honoring all intake constraints (hard filters) and
  ranked by the scoring engine (soft preferences).
- **Hard filters:** allergies, dietary restrictions, max prep/cook time, disliked ingredients.
- **Soft scoring:** ratings history, cuisine/protein/vegetable rotation, season, budget fit,
  nutrition goals, ingredient overlap (waste reduction), leftover reuse, cooking fatigue,
  adventurousness, "healthy vs comfort" balance.
- Guarantee **variety**: avoid repeating the same cuisine/protein back-to-back within a week.
- Each meal carries full detail (see Data Model §8).

### 6.2 Each dinner includes
Meal name · photo · difficulty · prep time · cook time · calories · protein · carbs · fat ·
recipe · cooking steps · ingredient list · leftover notes · freezing notes.

### 6.3 Shopping list (H-E-B)
- Consolidate ingredients across all 7 meals; **combine duplicates** and **sum quantities**
  with unit normalization (e.g., 2 tbsp + 1/4 cup).
- Subtract "already at home" items.
- Organize by department: **Produce · Meat · Seafood · Bakery · Frozen · Dairy · Dry Goods ·
  International · Spices · Household.**
- Map each ingredient to a representative H-E-B product + realistic price.
- Estimate **total cost** and **cost per serving**.
- Allow check-off while shopping (persisted).

### 6.4 Cooking schedule & leftover plan
- Assign meals to days, respecting prep/cook time vs. the user's available time per day.
- Surface make-ahead and meal-prep opportunities.
- Track which meals intentionally produce leftovers and which days reuse them.

### 6.5 Weekly learning & preference profile
- Persist every rating event.
- Update derived preferences (favorite cuisines, proteins, spice tolerance, complexity, etc.).
- **Down-weight** recipes similar to repeatedly poorly-rated meals (by cuisine, protein,
  technique, spice, prep load).
- **Up-weight** liked attributes.

### 6.6 Settings & data
- Dark mode (follows system, with manual override).
- Offline-first; all data in local storage.
- Export / reset data.

---

## 7. Recommendation Engine (v1 design)

A **deterministic, explainable, on-device scoring engine** over a seeded recipe library.
(No network or LLM dependency required in v1 — keeps it fast, free, and offline.)

```
score(recipe) =
    w1 * preferenceMatch(profile, recipe)      // learned likes/dislikes
  + w2 * ratingsSignal(history, recipe)        // similar past ratings
  + w3 * varietyBonus(weekSoFar, recipe)       // cuisine/protein/veg rotation
  + w4 * budgetFit(budget, recipe)
  + w5 * timeFit(maxPrep, maxCook, recipe)
  + w6 * nutritionFit(goals, recipe)
  + w7 * ingredientOverlap(weekSoFar, recipe)  // waste reduction
  + w8 * seasonFit(date, recipe)
  + w9 * adventurousness(slider, recipe)
  - p1 * fatiguePenalty(recentCuisines, recipe)
  - p2 * dislikePenalty(profile, recipe)
HARD FILTER: drop any recipe failing allergies/diet/time/disliked-ingredient.
```

Weights live in a single config so behavior is tunable and testable. The engine is
pluggable: a future `RemoteRecommendationProvider` (LLM/API) can replace the local one
behind the same interface.

---

## 8. Data Model (high level)

- **Profile** — household + all personalization inputs.
- **Recipe** — name, cuisine, tags, difficulty, prep/cook time, servings, nutrition,
  ingredients[], steps[], leftoverNotes, freezingNotes, photo, baseCostHint.
- **Ingredient** — name, quantity, unit, department, hebProductRef.
- **HebProduct** — name, department, unitPrice, package size (for cost estimation).
- **WeeklyPlan** — week date, intake answers, meals[], schedule, leftoverPlan, status.
- **ShoppingList** — derived from a WeeklyPlan; departments[] → items[] (with checked state).
- **RatingEvent** — per meal: cooked?, enjoyment, repeat?, family?, prep/cost/spice/bland/leftover flags.
- **PreferenceProfile** — derived, evolving weights & affinities used by the engine.

Full TypeScript interfaces are defined in Step 3 (Folder Architecture) and Step 4.

---

## 9. Information Architecture / Screens (v1)

1. **Home / This Week** — current plan at a glance, today's dinner, quick actions.
2. **Plan This Week** — intake questionnaire (multi-step).
3. **Meal Detail** — full recipe, nutrition, steps, leftover/freezing notes, swap/lock.
4. **Shopping List** — by department, check-off, total + per-serving cost.
5. **Schedule** — week calendar with meals + leftover days.
6. **Weekly Review** — rate cooked meals.
7. **Profile** — household & preferences.
8. **Settings** — appearance, data, (future integrations placeholders).

---

## 10. Technical Requirements

- **Framework:** React Native + **Expo** (managed workflow) for easy iOS builds and in-Claude preview.
- **Language:** TypeScript (strict).
- **Navigation:** Expo Router (file-based) or React Navigation.
- **State:** Lightweight store (Zustand) + React Query-style patterns where useful.
- **Storage:** Local (AsyncStorage / expo-secure-store / MMKV) behind a **repository interface**
  so a future swap to **Supabase/Firebase** touches one layer only.
- **Styling:** Centralized theme tokens (color, spacing, type, radius), full **dark mode**.
- **Architecture:** Reusable components, feature folders, clear separation of
  domain/engine/data/UI. **No placeholder code** unless unavoidable.
- **Quality:** Each step must compile/typecheck before moving on. Incremental delivery.

---

## 11. Design Principles

Clean · modern · minimal · fast · Apple-like. References: **Things 3, Carrot Weather,
Apple Reminders, ChatGPT.** Generous whitespace, strong typographic hierarchy, restrained
color, delightful but subtle motion. Avoid clutter; one primary action per screen.

---

## 12. Future-Proofing (architected, not built in v1)

- **Grocery providers:** Costco, Whole Foods, Kroger, Instacart, Walmart, Amazon Fresh,
  HEB Curbside — behind a `GroceryProvider` interface (H-E-B is the first implementation).
- **Recommendation providers:** local engine now; LLM/remote later behind same interface.
- **Capabilities:** recipe importing, AI pantry recognition, photo recognition, voice input,
  barcode scanning, Apple Health, Calendar, family accounts, recipe sharing, push
  notifications, Apple Watch, widgets, meal history, restaurant recs, holiday & party planning,
  automatic pantry inventory.
- **Data layer:** repository pattern + serializable schema → clean migration to cloud sync.

---

## 13. Release Plan (incremental)

| Step | Deliverable | Exit criteria |
| --- | --- | --- |
| 1 | **PRD** (this doc) | Approved |
| 2 | UX wireframes | Approved |
| 3 | Folder architecture | Approved |
| 4 | Project scaffold (compiles, runs, themed) | App boots in Expo |
| 5a | Profile + local storage | Save/load profile |
| 5b | Sunday intake flow | Produces intake object |
| 5c | Recipe library + recommendation engine | Generates 7 meals |
| 5d | Meal detail + swap/lock | Full recipe UX |
| 5e | Shopping list + cost estimate (H-E-B) | Consolidated, priced list |
| 5f | Schedule + leftover plan | Week view |
| 5g | Weekly review + learning | Ratings update profile |
| 5h | Polish, dark mode, empty states | Ship-quality |

Each Step 5 sub-feature is built and verified before the next.

---

## 14. Open Questions (for confirmation, with proposed defaults)

1. **Navigation lib:** Expo Router (proposed) vs. React Navigation. → *Default: Expo Router.*
2. **Recipe imagery:** bundled illustrative photos / emoji-forward cards (offline-safe, proposed)
   vs. remote image URLs. → *Default: offline-safe bundled/gradient cards in v1.*
3. **Cost data:** hand-curated realistic H-E-B price table (proposed) vs. live pricing (future).
   → *Default: curated table.*
4. **Recipe count:** library size for v1 (proposed ~40–60 recipes across all cuisines to
   guarantee variety). → *Default: ~50.*

These defaults will be used unless you say otherwise — no need to answer now.
```
