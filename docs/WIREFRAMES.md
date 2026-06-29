# Weekly Meals — UX Wireframes (Step 2)

> Low-fidelity, layout-accurate wireframes for all v1 screens.
> Aesthetic target: **Things 3 · Carrot Weather · Apple Reminders · ChatGPT** —
> clean, minimal, generous whitespace, one clear primary action per screen.
> These map 1:1 to the screens in PRD §9 and drive the component inventory in Step 3.

---

## 0. Design Language (the "feel")

- **Type:** Large, confident titles (SF Pro / system). Strong hierarchy:
  Title → Section → Body → Caption. Few sizes, used consistently.
- **Color:** Mostly neutral (paper/ink). One warm accent for primary actions
  (proposed: appetizing "Paprika" orange `#FF6B35` light / softened for dark).
  Cuisine tags get subtle tinted chips. Full dark mode.
- **Surface:** Rounded cards (radius ~16–20), soft shadows on light / subtle
  borders on dark. Lots of breathing room. No dense tables.
- **Motion:** Subtle, springy. Cards animate in on generation. Check-offs feel tactile.
- **Voice:** Warm, brief, human. "Let's plan this week's dinners." not "Configure plan."
- **Density:** One primary action per screen. Secondary actions tucked into
  overflow/long-press. Avoid clutter.

Legend for wireframes:
`[ Button ]`  `( ) / (•)` radio  `[ ] / [x]` checkbox  `<──>` slider  `›` chevron/disclosure
`▢` image/photo placeholder  `…` overflow menu

---

## 1. Navigation Model

**Bottom tab bar (4 tabs)** — always visible on main screens:

```
┌───────────────────────────────────────────┐
│                                             │
│              (screen content)              │
│                                             │
├───────────────────────────────────────────┤
│   🍽            📅           🛒          👤   │
│ This Week    Schedule    Shopping    Profile│
└───────────────────────────────────────────┘
```

- **Modal flows** (slide up over tabs): *Plan This Week*, *Weekly Review*.
- **Pushed screens** (slide in, back chevron): *Meal Detail*, *Settings*.
- Settings opens from the top-right of **Profile**.
- The app always opens on **This Week**.

---

## 2. This Week  (Home)

### 2a. Empty state (no plan yet — first run or new week)
```
┌───────────────────────────────────────────┐
│ This Week                              ☀️   │  ← greeting + subtle weather/season
│ Sunday, June 29                             │
│                                             │
│            ╭─────────────────╮              │
│            │       🍽         │              │  ← friendly illustration
│            ╰─────────────────╯              │
│                                             │
│        No plan yet for this week.           │
│   Answer a few quick questions and I'll     │
│      build your whole week of dinners.      │
│                                             │
│        ┌─────────────────────────┐          │
│        │  Let's plan this week   │  ← PRIMARY│
│        └─────────────────────────┘          │
│                                             │
│   Takes about 3 minutes · 7 dinners         │
├───────────────────────────────────────────┤
│  🍽          📅          🛒          👤       │
└───────────────────────────────────────────┘
```

### 2b. Active week (plan approved)
```
┌───────────────────────────────────────────┐
│ This Week                               …  │
│ Jun 29 – Jul 5 · 7 dinners · $112 (~$4/sv) │
│                                             │
│  TONIGHT · Monday                           │
│  ┌─────────────────────────────────────┐   │
│  │ ▢  Sheet-Pan Lemon Chicken        ›  │   │  ← hero card, today
│  │    🕒 15m prep · 30m cook · ★ Easy   │   │
│  │    520 cal · 42g protein            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  LATER THIS WEEK                            │
│  ┌─────────────────────────────────────┐   │
│  │ ▢ Tue · Chicken Tacos (leftovers) › │   │  ← leftover badge
│  │ ▢ Wed · Thai Basil Beef           › │   │
│  │ ▢ Thu · Caprese Pasta             › │   │
│  │ ▢ Fri · Salmon Rice Bowls         › │   │
│  │ ▢ Sat · Greek Sheet-Pan           › │   │
│  │ ▢ Sun · Tortilla Soup             › │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [ View shopping list ]  [ Schedule ]       │
├───────────────────────────────────────────┤
│  🍽          📅          🛒          👤       │
└───────────────────────────────────────────┘
```

### 2c. End-of-week banner (prompts the learning loop)
```
│  ┌─────────────────────────────────────┐   │
│  │ ⭐ How did this week go?             │   │
│  │ Rate your meals to improve next week│   │
│  │                    [ Start review ] │   │
│  └─────────────────────────────────────┘   │
```

---

## 3. Plan This Week  (Intake — modal, multi-step)

One question per screen (ChatGPT-calm, not a wall of form fields). Progress dots
on top, smart defaults pre-selected from Profile, big "Continue" button. ~12 steps,
most are one tap. Back arrow + "Skip" where sensible.

```
┌───────────────────────────────────────────┐
│ ✕                          ● ● ● ○ ○ ○ ○ ○  │  ← close + progress
│                                             │
│  Step 3 of 12                               │
│                                             │
│  What's your budget this week?              │  ← big question
│  We'll keep the shopping list under this.   │
│                                             │
│   ( ) $75      (•) $100     ( ) $125        │
│   ( ) $150     ( ) Custom…                  │
│                                             │
│                                             │
│        ┌─────────────────────────┐          │
│        │       Continue          │          │
│        └─────────────────────────┘          │
│              Skip this question             │
└───────────────────────────────────────────┘
```

**Question screen variants:**
- **Steppers:** dinners, people  → `–  7  +`
- **Single-select cards:** budget, max prep, max cook
- **Multi-select chips:** cuisines, dietary restrictions, special occasions
- **Sliders:** Healthy ↔ Comfort, Adventurousness (Safe ↔ Adventurous)
- **Tag input:** ingredients already at home, desired leftovers

**Final step — Generating:**
```
│            ╭─────────────────╮              │
│            │   ◠ (animated)   │              │
│            ╰─────────────────╯              │
│      Building your week…                    │
│   Balancing variety, budget & nutrition     │  ← rotating status lines
```

---

## 4. Review & Approve  (post-generation, before outputs unlock)

The 7 generated meals as swipeable/lockable cards. User can **lock** keepers and
**regenerate** the rest, or **swap** one slot at a time.

```
┌───────────────────────────────────────────┐
│ ‹ Back        Your Week            …        │
│ 7 dinners · est. $112 · ~$4.00 / serving    │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ ▢  Sheet-Pan Lemon Chicken      🔒 ↻ │   │  ← lock / swap one
│  │    Mediterranean · Easy · 45m       │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ ▢  Thai Basil Beef              🔓 ↻ │   │
│  │    Thai · Medium · 30m              │   │
│  └─────────────────────────────────────┘   │
│            … (5 more cards) …               │
│                                             │
│  [ ↻ Regenerate unlocked ]                  │  ← secondary
│        ┌─────────────────────────┐          │
│        │     Approve this week    │  ← PRIMARY│
│        └─────────────────────────┘          │
└───────────────────────────────────────────┘
```
Tapping a card → **Meal Detail**.

---

## 5. Meal Detail  (pushed)

```
┌───────────────────────────────────────────┐
│ ‹ Back                              🔒  ↻ … │
│  ╭───────────────────────────────────────╮ │
│  │ ▢▢▢   (photo / gradient cuisine card)  │ │
│  ╰───────────────────────────────────────╯ │
│  Sheet-Pan Lemon Chicken                    │  ← large title
│  Mediterranean · ★ Easy                     │
│                                             │
│  ┌──────┬──────┬──────┬──────┐              │  ← stat strip
│  │15m   │30m   │520   │42g   │              │
│  │prep  │cook  │cal   │protein│             │
│  └──────┴──────┴──────┴──────┘              │
│  Carbs 38g · Fat 19g                        │
│                                             │
│  INGREDIENTS                       (4 sv)   │
│  • 1.5 lb chicken thighs                    │
│  • 2 lemons                                 │
│  • 1 lb baby potatoes …            [ + more]│
│                                             │
│  STEPS                                      │
│  1. Preheat oven to 425°F.                  │
│  2. Toss chicken with lemon, oil, herbs…    │
│  3. …                                       │
│                                             │
│  🥡 LEFTOVERS                               │
│  Makes ~2 extra portions → Tue tacos.       │
│  ❄️ FREEZING                                │
│  Freezes well up to 2 months.               │
│                                             │
│  [ Swap this meal ]    [ Add to schedule ]  │
└───────────────────────────────────────────┘
```

---

## 6. Shopping List  (tab)

Grouped by H-E-B department, collapsible sections, check-off persists. Cost summary
pinned at top; "already at home" items are pre-subtracted.

```
┌───────────────────────────────────────────┐
│ Shopping List                          …   │
│ H-E-B · 7 dinners                           │
│  ┌─────────────────────────────────────┐   │
│  │ Estimated total        $112.40      │   │  ← summary card
│  │ Cost per serving        ~$4.01      │   │
│  │ 38 items · 6 checked                │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  PRODUCE                          (9)   ▾   │
│   [x] Lemons ×4                    $1.96    │
│   [x] Baby potatoes 1 lb           $1.48    │
│   [ ] Fresh basil 1 bunch          $2.18    │
│   [ ] Roma tomatoes ×6             $2.34    │
│  MEAT                             (4)   ▾   │
│   [ ] Chicken thighs 3 lb          $8.97    │
│   [ ] Ground beef 1 lb             $5.49    │
│  SEAFOOD                          (1)   ▸   │  ← collapsed
│  DAIRY                            (5)   ▸   │
│  DRY GOODS · INTERNATIONAL · SPICES …       │
│  BAKERY · FROZEN · HOUSEHOLD …              │
│                                             │
│  [ Share list ]              [ Reset ✓ ]    │
├───────────────────────────────────────────┤
│  🍽          📅          🛒          👤       │
└───────────────────────────────────────────┘
```
Departments always shown in fixed order (PRD §6.3). Empty departments hidden.

---

## 7. Schedule  (tab)

Week view assigning meals to days, respecting available cook time. Leftover days
marked. Drag-to-reorder (long-press) in a later polish pass; v1 = tap a day to reassign.

```
┌───────────────────────────────────────────┐
│ Schedule                               …   │
│ Jun 29 – Jul 5                              │
│                                             │
│  MON 29   ┌───────────────────────────┐    │
│           │ Sheet-Pan Lemon Chicken  ›│    │
│           │ 45m · cook night          │    │
│           └───────────────────────────┘    │
│  TUE 30   ┌───────────────────────────┐    │
│           │ Chicken Tacos   🥡 leftover│    │
│           │ 15m · uses Mon extras     │    │
│           └───────────────────────────┘    │
│  WED 1    ┌───────────────────────────┐    │
│           │ Thai Basil Beef          ›│    │
│           └───────────────────────────┘    │
│  THU 2 … FRI 3 … SAT 4 … SUN 5              │
│                                             │
│  🧑‍🍳 Meal-prep tip: cook Mon + Wed proteins│
│     together Sunday to save 25 min.         │
├───────────────────────────────────────────┤
│  🍽          📅          🛒          👤       │
└───────────────────────────────────────────┘
```

---

## 8. Weekly Review  (modal — the learning loop)

One meal at a time. Fast: a 1–5 enjoyment tap, two yes/no toggles, optional quick flags.
Skippable per meal ("Didn't cook this").

```
┌───────────────────────────────────────────┐
│ ✕   Weekly Review            ● ● ○ ○ ○ ○ ○ │
│                                             │
│  ▢  Sheet-Pan Lemon Chicken                 │
│     Mediterranean · cooked Monday           │
│                                             │
│  Did you cook it?     [ Yes ]  [ No ]       │
│                                             │
│  How much did you enjoy it?                 │
│        ★   ★   ★   ★   ☆                    │  ← 1–5
│                                             │
│  Cook again?           ( Yes )  ( No )      │
│  Family eat again?     ( Yes )  ( No )      │
│                                             │
│  Anything off? (optional)                   │
│  [Too much prep] [Too pricey] [Too spicy]   │
│  [Too bland]     [Too many leftovers]       │
│                                             │
│        ┌─────────────────────────┐          │
│        │         Next meal        │          │
│        └─────────────────────────┘          │
│              Didn't cook this               │
└───────────────────────────────────────────┘
```

**Review complete:**
```
│            ╭───────────╮                    │
│            │    ✓      │                    │
│            ╰───────────╯                    │
│       Thanks — noted for next week.         │
│  "More Mediterranean, less spice, watch     │
│   the prep time."   ← what it learned       │
│        [ Done ]   [ Plan next week ]        │
```

---

## 9. Profile  (tab)

Grouped settings list (Apple Settings style). Everything here also has smart defaults
and feeds the engine + intake pre-fill.

```
┌───────────────────────────────────────────┐
│ Profile                              ⚙︎     │  ← gear → Settings
│                                             │
│  HOUSEHOLD                                  │
│   Family size              4            ›   │
│   Children & ages          2 (6, 9)     ›   │
│   Cooking skill            Intermediate ›   │
│                                             │
│  FOOD                                       │
│   Favorite cuisines     Italian, Thai…  ›   │
│   Disliked cuisines        None         ›   │
│   Preferred proteins    Chicken, Fish   ›   │
│   Disliked ingredients     Cilantro     ›   │
│   Allergies                Peanuts      ›   │
│   Spice level              Medium       ›   │
│                                             │
│  PLANNING                                   │
│   Weekly budget            $100         ›   │
│   Avg cooking time         45 min       ›   │
│   Shopping day             Sunday       ›   │
│   Meal-prep day            Sunday       ›   │
│   Favorite store           H-E-B        ›   │
│   Kitchen equipment     Oven, Air Fryer ›   │
│                                             │
│  NUTRITION                                  │
│   Priorities          High protein      ›   │
│   Target calories          ~600 / meal  ›   │
│   Target protein           ~40g / meal  ›   │
│                                             │
│  WHAT I'VE LEARNED ABOUT YOU          ›     │  ← read-only insights
├───────────────────────────────────────────┤
│  🍽          📅          🛒          👤       │
└───────────────────────────────────────────┘
```

**"What I've learned"** (transparency screen — builds trust):
```
│  Favorite cuisine     Mediterranean  ▲      │
│  Top protein          Chicken               │
│  Avoiding             Very spicy, long prep │
│  Sweet spot           ≤45 min, ~$4/serving  │
│  Meals rated          23 · avg ★4.1         │
```

---

## 10. Settings  (pushed)

```
┌───────────────────────────────────────────┐
│ ‹ Profile     Settings                      │
│                                             │
│  APPEARANCE                                 │
│   Theme            System / Light / Dark ›  │
│                                             │
│  DATA                                       │
│   Export my data                        ›   │
│   Reset learning                        ›   │
│   Erase everything                      ›   │
│                                             │
│  COMING SOON                                │  ← future, disabled rows
│   Other stores (Costco, Kroger…)   soon     │
│   Grocery delivery (Instacart…)    soon     │
│   Apple Health · Calendar          soon     │
│   Notifications · Widgets          soon     │
│                                             │
│  ABOUT                                      │
│   Version 1.0.0                             │
└───────────────────────────────────────────┘
```

---

## 11. Cross-cutting States

- **Loading:** skeleton cards (shimmer), never spinners-on-white.
- **Empty:** friendly illustration + one clear action (see 2a).
- **Error:** inline, calm, retry button — never a dead end.
- **Offline:** everything works; only "Coming soon" online features note connectivity.
- **Dark mode:** full parity; tested for both targets (iOS + web).

---

## 12. Screens → Components (preview of Step 3)

| Recurring component | Used by |
| --- | --- |
| `MealCard` (compact / hero / lockable) | This Week, Review&Approve, Schedule |
| `StatStrip` (prep/cook/cal/protein) | Meal Detail, cards |
| `CuisineTag` / chip | everywhere |
| `PrimaryButton` / `SecondaryButton` | every screen |
| `QuestionScaffold` (progress + title + control + continue) | Intake, Review |
| `Stepper`, `OptionCards`, `ChipMultiSelect`, `Slider`, `TagInput`, `StarRating`, `YesNoToggle` | Intake, Review |
| `SectionList` / `SettingsRow` | Profile, Settings |
| `DepartmentSection` + `ShoppingItemRow` | Shopping List |
| `SummaryCard` (cost) | Shopping, Review&Approve |
| `EmptyState`, `SkeletonCard`, `Banner` | cross-cutting |

These become the reusable component library defined in Step 3.
```
