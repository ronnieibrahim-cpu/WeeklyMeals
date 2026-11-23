# CONTENT-REVIEW — adversarial content-integrity review (November 2026)

Scope: recipe accuracy, missing content, and how often recipes repeat.
Reviewed against the live library on `claude/epic-lamport-632c7d` after M5.8
task 4 (619 mains = 334 curated + 285 imported, plus 62 sides/sauces).
**Status (2026-11-23):** Ronnie approved every fix except R2 (the longer
repeat fade), and asked for new cuisine labels (C4). All shipped as M5.9 on
this branch — see "Outcome" at the end and `ADVISOR-HANDOFF.md` decision 47.
The findings below are kept as written at review time.

How the evidence was gathered:
- **Repetition:** a simulation that plans 26 weeks in a row for 5 household
  types, feeding each week's plan back in as history, exactly the way the app
  does (active plan + 6-week archive → `recencyByRecipe`). Four random seeds
  per household.
- **Content:** automated sweeps over all 681 recipes (nutrition math, doneness
  temperatures, protein labels, store aisles, plate composition, duplicate
  dishes, ingredients that steps use but the list leaves out), then reading the
  flagged recipes and a sample of the newest batch by hand.

---

## Severity summary

| # | Finding | Who it hurts | Severity |
|---|---|---|---|
| R1 | Instant Pot nights repeat the same dish almost every week | anyone who asks for Instant Pot nights | **High** |
| R2 | Top dishes come back on a ~4-week cycle | every household, worst with allergies | Medium |
| R3 | Sides: 62 exist, 7–13 ever get used; same side picked every time for a given dish | every household | Medium |
| R4 | 13% of plates get two sauces (salsa verde + salsa roja; pesto + chimichurri on a burger) | every household | Medium |
| R5 | The same dish exists twice under different ids (14 curated/import twins, 7 Instant Pot twins); rotation doesn't know they're the same | mostly hidden today; gets worse if R2 is fixed | Low–Medium |
| C1 | Imported recipes carry the wrong main protein (11), e.g. lamb stews labeled Beef, a goat-cheese dish labeled Lamb | protein preferences, "variety" | **High** (content) |
| C2 | 60 imported broths/stocks are filed in the **Meat** aisle on the shopping list | shopping trip | Medium |
| C3 | 7 curated mains say they have no starch when they do (hoagie rolls, grits, tostadas) → app adds egg noodles to a Philly cheesesteak | plate composition | Medium |
| C4 | Import cuisine mapping: Jamaican / Argentine / Uruguayan → "BBQ"; Vietnamese / Filipino / Malaysian → "Thai" | cuisine preferences, side pairing | Medium (product call) |
| C5 | Oldest curated batch is thin; several steps rely on unlisted "if you have it" items | taste; shopping list | Medium |
| C6 | Smaller data slips (spice level, °C text, hidden 4-hour soak) | — | Low |
| M1 | Missing content: allergy households draw from a much smaller pool; vegan, gluten-free+dairy-free, spring and "Other" cuisines are thin | allergy / diet households | Medium |

No allergy-safety defect was found: allergen labels are already enforced by
`validateRecipes.ts`, and imported recipes are excluded whenever any allergy is
set.

---

## R — Repetition

### R1. Instant Pot nights lock onto one dish (High)
Only 15 Instant Pot mains exist, and at the default 45-minute cook limit only
**6** pass the time filter. The engine reserves Instant Pot nights first, from
that tiny pool, using the normal score. The cross-week repeat penalty (max 1.0)
is smaller than the cuisine-preference edge, so the top scorer wins every week.

Evidence (household favoring Mexican/Indian/French, 2 Instant Pot nights, 26 weeks):
**Instant Pot Chicken Tikka Masala on 25 of 26 weekly plans.** Lengthening the
penalty doesn't fix it (still 24/26).

### R2. Top dishes cycle every ~4 weeks (Medium)
The repeat penalty fades to zero after 4 weeks (`REPEAT_FADE_WEEKS = 4`), and
the archive keeps 6 weeks. With a fixed profile the same top scorers return as
soon as the penalty expires.

| Household (26 weeks) | Different mains used | Most-repeated dish | Top-5 dishes' share |
|---|---|---|---|
| Default (7 dinners) | 78 of 182 | 7× (Creamy Lemon Salmon Pasta) | 16% |
| Asian-leaning | 46 of 130 | 7× | 24% |
| Vegetarian | 52 of 130 | 6× | 18% |
| Nut allergy | 41 of 130 | 8× | 26% |

Tested fix, fade over 6 weeks to match the archive: default 78 → **91**
different dishes, worst repeat 7 → **5**; nut allergy 41 → **49**, 8 → **6**.
Every week still fills.

### R3. Sides barely rotate (Medium)
Side picks have no randomness and no memory: for a given main they pick the
same best-scoring side every time. Across 26 simulated weeks a household sees
only 7–13 of the 62 sides. Vegetarian household: **Orzo Pilaf on 29 of 130
dinners**. Nut-allergy household: Buttered Egg Noodles on 23 of 130. Composing
one plate for every main in the library, **43 of 62 sides are never chosen**
(Roasted Broccoli, Jasmine Rice, Mashed Potatoes, Garlic Bread, Basmati Rice…
never appear); Sautéed Kale (113) and Buttered Egg Noodles (105) take most of
the slots.

Note: `rotation.ts` deliberately treats side repeats as "not a defect" (decision 23).
That holds for *some* repeats, but 43 unused sides is a different problem.

### R4. Two sauces on one plate (Medium)
`MAX_SIDES = 2`, and once the plate has a vegetable and a starch, a second
sauce can fill the last slot. **82 of 619 plates** come out with two sauces:
Salsa Verde + Salsa Roja on tacos, Tzatziki + Tahini on gyros, and **Basil
Walnut Pesto + Chimichurri on a Classic Beef Burger** (pesto allows "American"
mains). Pesto also lands on Chicken Shawarma Bowls and Spiced Lamb Pita
(it allows "Mediterranean").

### R5. Same dish, two ids (Low–Medium)
Rotation remembers recipe *ids*, so a dish and its twin are tracked separately:
Beef & Broccoli (curated) vs Beef and Broccoli (import); Sweet & Sour Pork,
Pad Thai, Carbonara, Orange Chicken, Koshari, Tonkatsu, Gigantes, Green Curry,
Tom Yum, Yaki Udon, Lamb Tagine, Ma Po Tofu, Tomato-Egg Stir-Fry; plus 7
"stovetop vs Instant Pot" pairs (carnitas, barbacoa, tikka masala, chana
masala, risotto, bourguignon, pulled pork). Today twins rarely land within 4
weeks of each other (0–1 per 26 weeks), but with the R2 fix they rise to ~1
per half-year: last month's carbonara comes back as "Spaghetti alla Carbonara".

---

## C — Content accuracy

### C1. Wrong main protein on imported recipes (High)
The importer counts "chicken broth / chicken bouillon" as chicken and
"goat's cheese" as goat (→ Lamb). 11 mains are clearly mislabeled (two more are
close enough); this drives the
protein preferences ("we want beef this week"), the variety rule, and the
dislike filter.

| Recipe | Labeled | Actually |
|---|---|---|
| Irish stew (`mealdb-52781`) | Beef | Lamb |
| Croatian lamb peka (`mealdb-53056`) | Beef | Lamb |
| Rigatoni with fennel sausage (`mealdb-52783`) | Lamb | Pork |
| Croatian bean stew (`mealdb-53058`) | Beef | Pork (chorizo) |
| Roast aubergine with goat's cheese (`mealdb-53273`) | Lamb | None (vegetarian dish; goat cheese also filed under Meat) |
| Syrian rice with meat (`mealdb-53095`) | Chicken | Beef |
| Osso buco (`mealdb-52810`) | Chicken | Beef (veal) |
| Venetian duck ragù (`mealdb-52838`) | Chicken | Duck (no bucket; closest is Chicken, acceptable) |
| Chinese tomato-egg stir fry (`mealdb-53372`) | Chicken | Eggs |
| Sichuan eggplant (`mealdb-53374`) | Chicken | None |
| Porotos granados (`mealdb-53521`) | Chicken | Beans |
| Ma Po Tofu (`mealdb-52947`) | Beef | Tofu |
| Jamaican curry goat (`mealdb-53354`) | Lamb | Goat (Lamb bucket acceptable) |

Fix belongs in `normalize.ts` (ignore broth/stock/bouillon and "goat's cheese"
when inferring protein), then regenerate — never hand-edit `recipeImported.ts`.

### C2. Broth filed in the Meat aisle (Medium)
Department inference checks "chicken"/"beef" before "broth", so **34 chicken
broth, 17 beef broth, 4 fish broth, 2 lamb broth** and 3 seafood stocks land
in Meat/Seafood on the shopping list; goat's cheese lands in Meat. Same
`normalize.ts` fix area.

### C3. Mains that hide their starch (Medium)
`provides` omits "starch" on: Sausage & Peppers, Philly Cheesesteak, Beer Brats
(all on hoagie rolls), Black Bean Tostadas, Chicken Tinga Tostadas, Shrimp &
Cheddar Grits, IP Japanese Beef Curry (potatoes). Result: the app adds a
starch side — e.g. **Buttered Egg Noodles beside a Philly Cheesesteak** (seen
3× in the default simulation), rice next to grits.

### C4. Import cuisine buckets (Medium — your call)
`normalize.ts` maps Jamaican, Argentine and Uruguayan dishes to **BBQ**
(18 recipes: curry goat, escovitch fish, empanadas, milanesa, red peas soup…),
and Vietnamese, Filipino and Malaysian to **Thai** (20). A family that ticks
"BBQ" expecting Texas barbecue gets Jamaican curry shrimp; Salsa Roja gets
paired with Jamaican corned beef. The importer already sends Polish, Dutch,
Norwegian etc. to **Other** for exactly this reason, and the curated jerk
chicken and adobo are already "Other".

### C5. Thin early recipes and unlisted "if you have it" items (Medium)
The M5.7 bar says nothing should depend on an unlisted ingredient to taste
right, and anything a step uses should be on the list (so it reaches the
shopping list). The oldest batch (`recipes.ts`) still misses that bar:
- **Chana Masala:** no garlic, no cumin, no chili, lemon "if you have one".
- **Turkey Chili:** no garlic; toppings (cheese, sour cream, green onion) unlisted.
- **Beef Burrito Bowls:** "finish with cheese, salsa, avocado, lime", none listed.
- **Lentil Bolognese:** "serve with parmesan", not listed.
- **French Lentil & Goat Cheese Salad:** vinaigrette needs vinegar, not listed.
- **Orange Chicken, Gyudon, Tikka Masala, Veg Fried Rice, Gyros, Karaage:**
  garnish/finish items (green onion, cilantro, sesame oil, lemon) unlisted.
- **Basil Beef, Pad Krapow:** "classically topped with a fried egg", egg unlisted.
- **Enchiladas, Quesadillas:** "serve with sour cream", unlisted.

Roughly 30–40 curated mains match this pattern (the sweep flags more, many
of them harmless; each needs a read). Most are fixed by listing the item,
marked optional where it really is optional.

### C6. Smaller slips (Low)
- Spice level "None" while listing red pepper flakes: Baked Feta Pasta, Pasta
  Primavera, White Bean & Kale Soup, Garlic Green Beans (→ "Mild").
- Two imports still show °C in step text (`mealdb-52930`, `mealdb-52975`).
- Smoky Lentil Chili (`mealdb-52784`) says 80 minutes total but its first step
  is "at least 4 hours ahead, soak the cashews".
- Ma Po Tofu exists twice and the curated one has no Sichuan peppercorn.
- Lok Lak (Cambodian) is filed as Chinese.

Checked and found clean: doneness temperatures (one 140 °F pork pull is
correct; it rests to 145 °F), calorie-vs-macro math (no recipe off by >25%),
oven temperatures, meat-per-serving outliers (all explained: whole chicken,
mussels in shell, bacon/chorizo used as seasoning), gluten-free tags on
tortilla dishes (all corn).

---

## M — Missing content

Allergy households can't use any imported recipe, so their pool is the curated
library alone. The nut-allergy household above sees the least variety of any
household tested.

| Restriction (default time limits) | Mains available | Quick (≤15 + 20 min) |
|---|---|---|
| None | 448 | 162 |
| Gluten allergy | 145 | 43 |
| Gluten + dairy allergy | 99 | 32 |
| Vegan | 59 | 15 |
| Vegetarian | 124 | 44 |

Other gaps in the curated library:
- **Instant Pot:** 15 mains, only 6 under 45 minutes (cause of R1).
- **Spring:** 27 spring-tagged mains vs 68–79 for other seasons.
- **"Other" cuisines:** 7 curated (Korean, Vietnamese, Peruvian, Caribbean,
  Filipino are one or two dishes each).
- **Sheet-pan (13) and slow-cooker (4)** dinners, the lowest-effort Sunday
  formats, are under-represented.
- **Thai** has 0 bean/lentil mains; **Indian** quick vegan options are few.

---

## Proposed fixes (awaiting approval; one task per commit)

**Repetition (engine, each with tests in the same commit):**
1. **Instant Pot round-robin.** Among Instant Pot candidates, prefer the one
   least recently planned (score breaks ties). The quota is still always met.
2. **Repeat penalty fades over 6 weeks, not 4**, matching the 6-week archive.
3. **Twin-aware rotation.** Add a `sameDishAs` link on twin recipes so planning
   one counts as planning the other, both within a week and across weeks.
4. **Sides:** at most one sauce per plate; pick among near-tied sides at random
   (same rule mains already use); and a light within-week penalty so one side
   can't fill most of the week.

**Content:**
5. **Importer fixes** (`normalize.ts` + regenerate): protein inference ignores
   broth/stock/bouillon and goat's cheese; broth goes to the dry-goods aisle.
   Fixes C1, C2.
6. **Curated data fixes:** `provides` starch on the 7 mains (C3); spice level on
   4 (C6); narrow Basil Walnut Pesto's pairings (no burgers or shawarma).
7. **Recipe-fidelity pass on the thin curated mains (roughly 30–40)** (C5): list
   every finish/garnish the steps use (marked optional where it is), and fill
   real gaps (garlic and cumin in chana masala, etc.).
8. **New content**, aimed at the thin pools: about 10 Instant Pot mains under 45
   minutes, about 15 mains that are both gluten-free and dairy-free, about 8 vegan,
   about 8 spring, about 6 sheet-pan, about 6 "Other" (Korean/Vietnamese/Peruvian).
   Some recipes will cover several gaps at once, so the target is about 40 new
   mains, each held to the M5.7 bar and the validator.

**Your call:**
- **C4:** move Jamaican/Argentine/Uruguayan imports from BBQ to **Other**
  (recommended; matches how the importer already treats Polish, Dutch, etc.).
  Keep Vietnamese/Filipino/Malaysian in Thai (closest bucket we have).
- Whether R3 overrides decision 23's "side repeats aren't a defect" (recommended:
  yes, in the limited form in item 4).

---

## Outcome (M5.9, 2026-11-23)

| Finding | Result |
|---|---|
| R1 Instant Pot | Round-robin over the most-rested Instant Pot recipes: top dish 25/26 weeks → 9/26; 15 → 25 Instant Pot mains (6 → 16 under 45 minutes). |
| R2 Repeat fade | Not changed (Ronnie). |
| R3 Sides | Distinct sides over 26 weeks: default 13 → 28, Asian-leaning 12 → 25, vegetarian 7 → 19, nut allergy 5 → 11. Never placed on any plate: 43 → 3. |
| R4 Two sauces | 82 → 0 plates. |
| R5 Twins | 21 pairs linked (`dishTwins.ts`); never in one week, rested together. |
| C1 Protein | Inference fixed; 11 live imports corrected, test guards it. |
| C2 Broth aisle | 65 broths/stocks → dry goods; goat cheese → dairy. |
| C3 Hidden starch | 7 mains corrected; test guards it. |
| C4 Cuisines | New Caribbean, Latin American, Southeast Asian. |
| C5 Fidelity | 30 recipes; no allergen or diet tag changed. |
| C6 Small slips | Spice levels, cashew soak and Lok Lak's origin fixed. The two °C mentions show °F alongside and were left. |
| M1 Missing content | 40 new mains. Gluten allergy pool 145 → 174, gluten + dairy 99 → 128, vegan 59 → 70. |
