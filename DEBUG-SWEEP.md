# DEBUG-SWEEP.md — Weekly Meals read-only audit

*Prepared: 2026-07-09 · Scope: one-time, read-only debug sweep. **No application code was changed.** This document is the only file written.*

This sweep deliberately targets the surfaces the 169-test engine suite does **not**
cover: screens and their states, date/time edges, sync/storage failure modes, the
web platform, code health, and performance. Every finding below was reproduced or
traced to specific code; anything I could not confirm is in the honestly-labelled
**Unconfirmed** section at the end.

---

## 0. Health checks (all requested commands)

| Check | Result |
|---|---|
| `npm install` | ✅ clean (exit 0) |
| `npm run typecheck` (`tsc --noEmit`) | ✅ 0 errors |
| `npx jest` | ✅ **169 passed**, 14 suites, ~4.6 s |
| `npx tsx scripts/validateRecipes.ts` | ✅ **230/230 curated recipes pass** |

The green baseline is real. The findings below are about the code paths those
checks don't exercise.

---

## Findings, ranked P0 → P3

### P0-1 — Tree-nut allergy filter silently passes a curated almond recipe (SAFETY)

- **Severity:** P0 (physical safety)
- **Where:** `src/data/seed/recipeBatch8.ts:786` (recipe `fr-trout-amandine`, "Trout Amandine", id at `:751`); `src/domain/constants/options.ts:51`; matched against `src/engine/recommendation/filters.ts:46-57` (`passesAllergySafety`).
- **User impact:** A family that sets a **Tree Nuts** allergy can still be served "Trout Amandine," which contains ½ cup **sliced almonds**. It can be auto-generated into a week, offered as a swap/re-roll candidate, and pinned — the allergy filter does not stop it.
- **Repro / trace:** The profile allergy chip is the string `'Tree Nuts'` (with a space). `fr-trout-amandine` declares `allergens: ['Fish', 'Dairy', 'TreeNuts']` (no space). `passesAllergySafety` compares `recipe.allergens.some(a => allergies.includes(lower(a)))`, i.e. `'treenuts'` vs `'tree nuts'` — no match, so the recipe passes. Because this recipe is **curated** (`estimated` is unset), the M1.5 "exclude imported recipes when any allergy is set" guard does **not** cover it. I confirmed by loading the real `RECIPES` array and cross-checking nut ingredients against allergen labels:
  - **`fr-trout-amandine` is the only curated recipe** with a tree-nut ingredient whose allergen label doesn't canonically say "Tree Nuts." (The other curated nut dishes — `in-chicken-korma`, `cn-cashew-chicken`, `cn-dan-dan-noodles`, all peanut dishes — are labelled correctly.)
  - 9 **imported** recipes also use `'TreeNuts'` (e.g. `mealdb-52784`, `mealdb-53240`) and several imports with pine-nut/walnut ingredients have empty allergen arrays — but all imports carry `estimated: true`, so the M1.5 guard already excludes them whenever any allergy is set. The misspelling is only *reachable-dangerous* on the one curated recipe.
- **Note:** This is exactly the "still open" item called out in `PROJECT.md` §7 #1 — it was never fixed. `Fish` and `Dairy` on the same recipe are spelled correctly, so a fish/dairy allergy *does* block it; only the tree-nut path is broken.

### P0-2 — Supabase household table is world-readable: any anonymous client can enumerate every household and read/write its data (PRIVACY / TRUST)

- **Severity:** P0 (privacy of health-adjacent data; full account takeover of any household)
- **Where:** `src/data/sync/config.ts:6-8` (public URL + publishable key, by design) → `src/data/sync/householdApi.ts:31-38` (`getHousehold` does `select=*`). The design *depends on* Row-Level Security being configured on the `households` table (`PROJECT.md` §2, AUDIT.md §8 item 15). **It is not.**
- **User impact:** The 6-character code is the only secret protecting a household. With RLS open, that protection is void: anyone holding the bundle's publishable key (public in the shipped web JS) can list **every** household code, then read and overwrite **every** family's weekly plan, shopping list, and — most sensitively — dietary restrictions and allergies.
- **Repro (live, read-only, ran during this sweep):**
  ```
  GET .../rest/v1/households?select=code&limit=3   (anon publishable key)
  → [{"code":"HPGHVS"},{"code":"DPTJ3W"},{"code":"8CZPEK"}]
  Prefer: count=exact → content-range: 0-0/3   (3 rows total, all enumerable)
  ```
  Unauthenticated enumeration of household codes succeeds. Since a known code grants full read/write (`getHousehold`/`upsertHousehold` gate on nothing but the code), this is a complete confidentiality + integrity break. I intentionally did **not** dump the `data` payloads.
- **Fix is server-side (not a code change):** add an RLS policy on `households` so anonymous `select`/`upsert` only match a row whose `code` is supplied as a filter (never a bare `select *`), and rely on Supabase rate limits. This is a Supabase-dashboard action — worth doing before the next share of the app.

### P1-1 — `validateRecipes.ts` has no allergen check, so P0-1's bug class stays invisible

- **Severity:** P1 (it is the safety net that would have caught P0-1 and will catch the next one)
- **Where:** `scripts/validateRecipes.ts:54-89` (validates step count, step length, ingredient-mention coverage, and description — **nothing about allergens**).
- **User impact:** The CI-style gate the team runs before every commit cannot see a mis-spelled or missing allergen label. A future edit that introduces another `'TreeNuts'`, or a nut ingredient with an empty allergen array, ships green.
- **Trace:** Grepping the validator for `allergen`/`Tree` returns nothing; the loop only calls `validateRecipe`, which never inspects `recipe.allergens`. A ~15-line addition (canonical-allergen membership + keyword→allergen coverage for nuts/peanuts/shellfish/etc.) would make the entire P0-1 class permanently self-detecting. `PROJECT.md` §7 #1 lists "a canonical allergen list + CI seed-validation script" as still open — confirmed still absent.

### P1-2 — Schedule empty-state and body copy promise "leftover days" and a tailored prep plan that don't exist

- **Severity:** P1 (trust / "never promise what the code ignores" — a standing product law in `PROJECT.md` §"Standing product direction")
- **Where:** `app/(tabs)/schedule.tsx:37` (empty state: *"your dinners land here day by day — with leftover days and a meal-prep tip"*) and `:95-101` (a single **hard-coded** generic tip shown on every plan regardless of the recipes).
- **User impact:** The app advertises leftover-day scheduling and a meal-prep plan. There is no leftover-day engine — `isLeftoverDay` is never set anywhere in the codebase (AUDIT.md B4), and the "meal-prep tip" is one constant paragraph, not derived from the week. A user who reads the empty state expects a capability the Schedule tab doesn't have.
- **Trace:** The only leftovers logic on this screen is `meals.filter(m => recipeFor(m)?.makesLeftovers)` counting a badge; there is no per-day leftover assignment. The tip text at `:97-100` is a literal string. This is honest to flag now because M3 is "done" and this copy predates it.

### P2-1 — Keep-awake on web silently stops working after the first tab-switch / screen-dim, and is a no-op on older iOS Safari

- **Severity:** P2 (cook-mode reliability on the actual delivery platform — a scoped question)
- **Where:** `app/cook/[dayIndex].tsx:28` (`useKeepAwake()` with no options) → `expo-keep-awake` web impl (`navigator.wakeLock.request('screen')`), activated **once** on mount.
- **User impact:** The Screen Wake Lock API is auto-released by the browser whenever the page loses visibility (switching apps, pulling a notification, the phone auto-locking once). `useKeepAwake()` is called with **no `listener`**, so nothing re-acquires the lock on release. After the first interruption the screen sleeps normally for the rest of the cooking session — exactly the wet-hands moment cook mode exists to prevent. On iOS Safari older than 16.4 (no `wakeLock`), `activate()` rejects and the hook's `.catch(() => {})` swallows it: the screen simply never stays awake, with no indication to the user.
- **Trace:** `expo-keep-awake/src/ExpoKeepAwake.web.ts` requests the lock once; the hook (`index.ts` `useKeepAwake`) only re-runs its effect on `tag` change, and passes no release-listener from the call site. There is no `visibilitychange` re-acquire anywhere in the app. Matches the milestone's own "note the limitation" instruction — the limitation is currently unnoted for keep-awake (only the timer's vibration limitation is documented).

### P2-2 — Cross-timezone devices compute a different "Tonight" / day offset from the same plan

- **Severity:** P2 (correctness of every ISO-vs-local date comparison; low real-world impact for a single-city family, high if the two phones ever travel apart)
- **Where:** `src/stores/planStore.ts:240` stores `weekStartISO = localMidnight(new Date()).toISOString()` (a UTC instant); `src/engine/schedule.ts:8-24` (`localMidnight`/`todayOffset`) re-derive the **local** calendar date from that instant on whatever device reads it.
- **User impact:** `toISOString()` encodes Houston local midnight as e.g. `2026-07-09T05:00:00Z`. A device in a timezone west of the generator parses that instant back to the **previous** calendar day, so `todayOffset` is off by one — "Tonight," "Earlier this week," and the Schedule dates all shift a day. Two Houston phones agree (same offset), so today this is latent, not active. It becomes real the moment the household syncs across timezones (travel).
- **Trace:** Round-tripping `weekStartISO` through `new Date(...)` → `localMidnight(...)` only preserves the intended calendar day when the reader's timezone equals the writer's. The value would be timezone-safe if stored as a plain `YYYY-MM-DD` local date string instead of a UTC instant. Verified adjacent behavior is correct: at 11:59 pm vs 12:01 am **on one device**, `localMidnight(today)` advances at local midnight, so "Tonight" correctly rolls to the next day's meal — that edge is fine; only the cross-device case is wrong.

### P2-3 — Init is resilient to unparseable storage but not to valid-JSON-wrong-shape

- **Severity:** P2 (startup robustness / failure mode)
- **Where:** `src/data/repositories/local/kvStore.ts:9-17` (`getJSON` catches `JSON.parse` and returns `null`); consumers such as `app/(tabs)/index.tsx:76` (`plan.meals.sort(...)`) and `schedule.tsx:44` assume shape.
- **User impact:** Corrupt/partially-written storage that fails to parse is handled gracefully (treated as "no data" — good). But a value that *is* valid JSON yet structurally wrong (e.g. a persisted plan missing `meals`, or an array where an object is expected) passes `getJSON` untouched and reaches a screen that immediately does `plan.meals.sort` / `.map`, throwing and white-screening the tab. No schema/shape guard exists on hydration.
- **Trace:** `getJSON`'s `try/catch` only guards `JSON.parse`; there is no runtime validation of the parsed object against `WeeklyPlan`/`ShoppingList`/etc. before it's `set()` into a store and rendered. Likelihood is low (the app is the only writer), but a mid-write crash or a manual storage edit can produce it, and there's no recovery path.

### P3-1 — Dead store actions never wired to any UI

- **Severity:** P3 (code health)
- **Where:** `src/stores/learningStore.ts:151` (`reset`), `src/stores/profileStore.ts:38` (`reset`), `src/stores/planStore.ts:482` (`clear`).
- **Impact:** These are defined and typed but called from nowhere in `app/` (grep confirms no call sites). They're harmless but are latent "reset my data" affordances with no button — either surface them in Settings or drop them. AUDIT.md P1.6 mentions wiring reset UI; it was never wired.

### P3-2 — No keyboard-avoidance around mid-list text inputs

- **Severity:** P3 (web/mobile polish — a scoped question)
- **Where:** `src/ui/components/Screen.tsx:76` wraps content in a plain `ScrollView` (`keyboardShouldPersistTaps="handled"`, but **no** `KeyboardAvoidingView`). The manual-item inline edit fields (`app/(tabs)/shopping.tsx:381-410`) render mid-list.
- **Impact:** On mobile web, focusing the manual-item name/quantity inputs when the row sits low on screen can leave them under the on-screen keyboard with no auto-scroll. The two primary inputs (Recipes search, Shopping "Add an item…") both live at the top of their screens, so they're unaffected — this is only the inline editor. Minor.

### P3-3 — `docs/ARCHITECTURE.md` still references modules/stores that don't exist

- **Severity:** P3 (doc drift — already acknowledged)
- **Where:** `docs/ARCHITECTURE.md:99-127,382` reference `schedule.ts`, `units.ts`, `__tests__/`, `RatingRepository`, `reviewStore` — none of which exist (some, like `schedule.ts`, now exist under a different meaning).
- **Impact:** `CLAUDE.md` and `PROJECT.md` already warn this file is stale/aspirational and that `PROJECT.md` wins, which largely defuses it. Flagged for completeness; the risk is a future session "restoring" a phantom module. Consider deleting or stamping the stale sections.

---

## Performance notes (scoped question: 541+ recipes + photos in a browser tab)

- **Startup parse cost is acceptable.** `src/data/seed/recipeImported.ts` is a 1.2 MB / ~44k-line generated object literal (356 imported recipes) shipped in the JS bundle. It parses once at module load; `recipesById` is built with a plain `for` loop (`src/data/seed/recipes.ts:1099-1103`), so the old O(n²) build (AUDIT B15) is genuinely fixed. This is the single largest bundle contributor but not a runtime hotspot.
- **The Recipes tab is already defended against the real risk.** `app/(tabs)/recipes.tsx:112` caps mounted result cards at `MAX_VISIBLE_RESULTS = 40` (each card can load a remote photo; it's a plain `ScrollView`, not a virtualized list) and uses `useDeferredValue` on the query (`:41`) so typing doesn't re-filter 586 items per keystroke. Good calls, both with explanatory comments. `filterRecipes` recomputes only when filters change (memoized), `searchRecipes` only on the deferred query.
- **Image 404s degrade cleanly.** `RecipeImage` (`src/ui/components/RecipeImage.tsx:87-95`) renders the deterministic cuisine tile underneath and swaps to the photo only on load, falling back to the tile on `onError`. A dead photo URL shows the tile, never a broken image.
- **No re-render hotspot found** in the screens read. Stores use fine-grained Zustand selectors; the heaviest list (Recipes) is capped and deferred as above.

## Layering / architecture spot-check

- `src/engine/**` imports only `@/domain` types and one `@/data/grocery/GroceryProvider` **type** (`shoppingList.ts:1`) — no React, no store imports, no I/O. Clean.
- The only `AsyncStorage` reference outside `kvStore.ts` is a **comment** in `ProfileRepository.ts:5`, not a call. Persistence still funnels through `kvStore`.
- No store logic that obviously belongs in the engine was found; stores orchestrate and persist, engine stays pure — as documented.

---

## Unconfirmed (plausible, not reproduced here)

- **Two-device sync convergence under real races.** The merge functions (`syncMerge.ts`) are pure and unit-tested, and I traced `syncStore.pull/push` for ping-pong avoidance (stable-key stringify) and `applying`-guarded re-entrancy — all look correct. But I could not run two live clients against Supabase in this sandbox, so genuine wall-clock races (e.g. both phones approving different new weeks within one 20 s poll while offline-then-online) are reasoned-about, not observed. Consistent with the M3.1/M3.2/M3.3 "unit-level only" caveats in the milestone.
- **Storage-quota behavior on web.** `persist()` calls are fire-and-forget (`void repo.save(...)`); a `QuotaExceededError` from localStorage would become an unhandled rejection and silently drop that one write, with the in-memory state still correct until reload. Stored payloads are small (the big recipe file is in the bundle, not storage), so I judge this very unlikely to trigger — hence unconfirmed rather than ranked.
- **`approve()` not pushed synchronously.** After `onApprove` (`app/plan/review.tsx:62-71`) reconciles then approves, the newly-approved plan reaches the server only via the 600 ms-debounced subscription push, not an awaited push. Closing the tab within that window delays the partner seeing the new week until the next sync. No data loss (persisted locally); flagged as a plausible latency wart, not verified as user-visible.

---

## Overall health verdict

Weekly Meals is a genuinely well-built app: strict-typecheck clean, 169 green engine tests, honest layering (pure engine, orchestrating stores, thin screens), and screens that handle their empty / first-run / mid-week / week-complete / past-plan states thoughtfully, with resilient image and storage-parse fallbacks. The serious problems are two and they are both **trust** problems rather than crashes: a single curated recipe (`fr-trout-amandine`) can defeat a tree-nut allergy filter because of a one-character data spelling (`TreeNuts` vs `Tree Nuts`), and the household sync table appears to lack the Row-Level Security the whole design assumes — I confirmed an anonymous client can enumerate every household's codes, which is equivalent to full access to every family's plan and dietary data. Both are known-and-documented-as-open in `PROJECT.md`/`AUDIT.md` yet still live. Fix those two first (plus the tiny allergen-validation guard that would have caught the first), and everything else here is P2/P3 polish — timezone-safe date storage, a keep-awake re-acquire on web, honest Schedule copy, and some dead code. This is a solid foundation with two sharp edges that happen to sit exactly on the app's safety-and-trust promise; neither is a rewrite, both are a focused afternoon.
