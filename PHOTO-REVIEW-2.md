# PHOTO-REVIEW-2.md — M5.1 bulk photo pass

Generated 2026-07-22 by the M5.1 vision-screening pipeline (4 parallel agents viewed every candidate image against the dish + primary protein).

Scope: the 170 curated mains + sides that had no photo. 88 had at least one license-clean candidate; 82 had none and keep the cuisine-tile fallback.

- **66 wired** (55 EXACT tier + 11 PLAUSIBLE approved by Ronnie this round). All live in `src/data/recipeImages.ts`.
- **9 held** (PLAUSIBLE — Ronnie did not approve; kept the cuisine tile).
- **13 rejected** (no confident match; keep the tile).

## Reverting an auto-wired photo

If any auto-wired photo is wrong, tell me the recipe id (or say "photo for X didn't work") and I delete that one line from `RECIPE_IMAGE_URLS` (and its `RECIPE_IMAGE_ATTRIBUTION` entry) — the recipe falls straight back to its clean cuisine tile. No other photo is affected.

## Auto-wired (EXACT) — 55

| Recipe (id) | Source | License | Why it matched |
|---|---|---|---|
| Breakfast Burritos for Dinner (`am-breakfast-burrito`) | wikimedia | CC BY 2.0 | Sliced burritos showing scrambled egg, potato, and red bell pepper filling with tomato garnish - matches protein and vegetables. |
| Buffalo Chicken Wraps (`am-buffalo-chicken-wraps`) | wikimedia | CC0 1.0 | Clearly a wrap with buffalo chicken and greens visible, wrapped in flatbread - matches dish exactly. |
| Crispy Chicken Sandwich (`am-fried-chicken-sandwich`) | wikimedia | CC BY-SA 3.0 | Bun sandwich with visible fried chicken patty, lettuce and tomato - clear match for a crispy chicken sandwich. |
| Baked Mac & Cheese (`am-mac-and-cheese`) | wikimedia | CC BY-SA 4.0 | Baked macaroni and cheese in a dish with browned top and herb garnish, no extraneous protein - matches a plain baked mac and cheese. |
| Loaded Potato Soup (`am-potato-soup`) | wikimedia | CC BY 2.0 | Creamy chunky potato soup topped generously with crispy bacon bits and parsley -- unmistakably a 'loaded' style potato soup. |
| Sheet-Pan Salmon & Asparagus (`am-sheet-pan-salmon`) | wikimedia | CC0 1.0 | Cooked salmon fillet with grill marks, asparagus spears, and grilled lemon over rice — matches all listed ingredients. |
| Sloppy Joes (`am-sloppy-joes`) | wikimedia | CC BY 2.0 | Classic homemade sloppy joe sandwich with meat sauce on a bun and coleslaw side — iconic, unambiguous. |
| Oven Baby Back Ribs (`bq-baby-back-ribs`) | wikimedia | CC BY 2.0 | A full rack of glazed pork ribs on the grill grate — clean, unmistakable baby back ribs shot. |
| Oven BBQ Brisket (`bq-bbq-brisket`) | wikimedia | CC BY 2.0 | Sliced beef brisket with BBQ sauce/bark clearly visible on a plate with sides. |
| Grilled BBQ Chicken Thighs (`bq-grilled-chicken`) | wikimedia | CC BY-SA 4.0 | Four glazed, charred chicken thighs on a plate — unmistakably grilled/BBQ-style chicken thighs. |
| BBQ Grilled Salmon (`bq-grilled-salmon`) | wikimedia | CC BY-SA 4.0 | A grilled salmon fillet plated with lemon wedges and roasted potatoes -- correct protein and matching lemon garnish. |
| Grilled Portobello Burgers (`bq-portobello-burgers`) | wikimedia | CC BY 2.0 | Dark glossy round mushroom cap clearly shaped as a portobello cap on a bun, with arugula and sides - correctly shows no meat. |
| Slow Cooker Pulled Pork (`bq-pulled-pork`) | wikimedia | CC BY-SA 3.0 | Whole pork roast being pulled apart with a fork, clearly shredded pork - unmistakable dish identity. |
| Smoked Chicken Wings (`bq-smoked-wings`) | themealdb | TheMealDB (free tier, attribution required) | A pile of charred, glazed chicken wings garnished with lemon and herbs -- correct protein and smoked/grilled appearance. |
| Grilled Steak with Chimichurri (`bq-steak-chimichurri`) | wikimedia | CC BY 2.0 | Sliced grilled steak topped with green chimichurri sauce, plated with fries - clear, confident match. |
| Weeknight Cassoulet (`fr-cassoulet`) | wikimedia | CC BY-SA 3.0 | Classic bowl of white beans with pork/meat pieces in earthenware — textbook cassoulet. |
| Herb Roast Chicken (`fr-herb-roast-chicken`) | wikimedia | CC BY-SA 3.0 | Classic whole roasted chicken with browned herbed skin on a plate - clearly the right dish and protein. |
| Salad Niçoise (`fr-nicoise-salad`) | wikimedia | CC BY 2.0 | Clean plated Nicoise-style salad with visible seared tuna slices, green beans, potatoes, tomatoes and olives -- matches protein and vegetables precisely. |
| Greek Chicken Bowls (`gr-chicken-bowls`) | wikimedia | CC BY-SA 4.0 | Grilled chicken souvlaki, fries, tomato and red onion on a plate - matches protein and listed vegetables well. |
| Coconut Salmon Curry (`in-coconut-salmon-curry`) | wikimedia | CC BY-SA 4.0 | Fish steak clearly submerged in an orange/red Indian-style curry sauce - matches fish protein and Indian curry presentation. |
| Pesto Gnocchi (`it-pesto-gnocchi`) | wikimedia | CC BY-SA 4.0 | Bowl of gnocchi clearly coated in green pesto sauce with cheese - correct dish, no protein present as expected. |
| Shrimp Udon (`jp-shrimp-udon`) | wikimedia | CC0 1.0 | Bowl of udon noodles in broth with visible shrimp and green herb garnish - clear match for shrimp udon. |
| Teriyaki Salmon Rice Bowls (`jp-teriyaki-salmon`) | wikimedia | CC BY-SA 4.0 | Glazed salmon pieces over rice with sprouts/greens garnish, a clear teriyaki salmon rice bowl. |
| Tuna Poke Bowl (`jp-tuna-poke-bowl`) | wikimedia | CC BY-SA 4.0 | Diced raw ahi tuna cubes with green onion garnish - unmistakable poke bowl base matching the correct fish protein. |
| Garlic Butter Shrimp (`md-garlic-butter-shrimp`) | wikimedia | CC BY-SA 4.0 | Shell-on shrimp glistening in garlic butter sauce, clean focused plate -- unmistakably garlic butter shrimp. |
| Spiced Lamb Pita (`md-spiced-lamb-pita`) | wikimedia | CC BY 2.0 | Pita topped with visible lamb chunks, hummus, cucumber and cherry tomatoes - matches dish and vegetables. |
| Beef Barbacoa (`mx-beef-barbacoa`) | wikimedia | CC BY 2.0 | Shredded beef tacos with visible tender shredded beef, cilantro, avocado and lime -- clearly the correct protein and dish family. |
| Slow Cooker Pork Carnitas (`mx-pork-carnitas`) | wikimedia | CC BY-SA 4.0 | Clearly shows shredded/chunked pork carnitas filling tacos with lime wedge visible, matching protein and Mexican presentation. |
| Braised Red Cabbage (`sd-braised-red-cabbage`) | themealdb | TheMealDB (free tier, attribution required) | Glossy, shredded, clearly cooked/braised red cabbage on a plate — matches the dish directly. |
| Chimichurri (`sd-chimichurri`) | wikimedia | CC BY 2.0 | Clean bowl shot of vivid green, herby, oily chimichurri sauce — textbook appearance. |
| Cucumber Tomato Salad (`sd-cucumber-tomato-salad`) | wikimedia | CC BY-SA 1.0 | Sliced tomatoes and cucumbers plated together with light dressing - direct match for the dish name and ingredients. |
| Fried Egg (`sd-fried-egg`) | wikimedia | CC BY 2.0 | An actual sunny-side-up fried egg in a pan - direct, unambiguous match. |
| Garlic Naan (`sd-garlic-naan`) | wikimedia | CC BY-SA 4.0 | Charred, herb-flecked naan bread stack — a clean, classic garlic naan shot. |
| Garlicky Roasted Mushrooms (`sd-garlicky-roasted-mushrooms`) | wikimedia | CC BY-SA 4.0 | Roasted mushroom pieces with herb garnish on a plate - direct match for a roasted mushrooms side dish. |
| Gremolata (`sd-gremolata`) | wikimedia | CC0 1.0 | Clean bowl of finely chopped parsley with lemon zest — classic, unambiguous gremolata. |
| Grilled Zucchini (`sd-grilled-zucchini`) | wikimedia | CC BY 2.0 | Zucchini slices with clear grill marks, plated - unmistakable match. |
| Jasmine Rice (`sd-jasmine-rice`) | wikimedia | CC BY-SA 2.0 | Plain white steamed rice plated (alongside a curry) -- clean, correct simple rice side. |
| Mashed Potatoes (`sd-mashed-potatoes`) | wikimedia | CC BY 2.0 | Bowl of smooth mashed potatoes garnished with chives, raw potatoes beside for context - clean, unmistakable match. |
| Peanut Sauce (`sd-peanut-sauce`) | wikimedia | CC BY-SA 4.0 | Large bowl of peanut sauce with visible peanuts is the dominant subject of the shot - clearly represents the sauce itself. |
| Quinoa Pilaf (`sd-quinoa-pilaf`) | wikimedia | CC BY 2.0 | Plated quinoa pilaf with chickpeas, visible quinoa grains - clear match, no unexpected protein visible. |
| Roasted Asparagus (`sd-roasted-asparagus`) | wikimedia | CC BY-SA 2.0 | Plate of roasted asparagus spears with visible char - unmistakable match. |
| Roasted Baby Potatoes (`sd-roasted-baby-potatoes`) | wikimedia | CC BY-SA 4.0 | Focused bowl of roasted/fried baby potatoes with onion garnish -- clean unmistakable side-dish shot. |
| Roasted Brussels Sprouts (`sd-roasted-brussels-sprouts`) | wikimedia | CC BY-SA 2.0 | Tray of clearly roasted, browned brussels sprouts halves - unmistakable match. |
| Roasted Cauliflower (`sd-roasted-cauliflower`) | wikimedia | CC BY 2.0 | Dry-roasted cauliflower florets with charred edges in a bowl -- clean, unmistakable match. |
| Romesco (`sd-romesco`) | wikimedia | CC BY 2.0 | Traditional Catalan calçotada with small bowls of authentic orange-red romesco sauce clearly visible. |
| Salsa Roja (`sd-salsa-roja`) | wikimedia | CC BY 2.0 | Bowl of red salsa with chips, sauce is clearly the focal subject - unmistakable match. |
| Salsa Verde (`sd-salsa-verde`) | wikimedia | CC BY-SA 2.0 | Chunky green tomatillo-based salsa in a bowl - direct match for Mexican salsa verde. |
| Seared Tofu (`sd-seared-tofu`) | wikimedia | CC BY 2.0 | Golden, pan-seared tofu slabs plated with salad — clean, correct match for the dish and (absent) protein-free vegetable side context. |
| Sesame Cucumber Salad (`sd-sesame-cucumber-salad`) | themealdb | TheMealDB (free tier, attribution required) | TheMealDB's own 'Sesame Cucumber Salad' image - sliced cucumber tossed with visible sesame seeds and herb garnish, direct title match. |
| Simple Shredded Chicken (`sd-shredded-chicken`) | wikimedia | CC0 1.0 | Plain shredded cooked chicken in a bowl with no sauce or extra ingredients - exact match for 'simple' shredded chicken. |
| Steamed Broccoli with Lemon (`sd-steamed-broccoli-lemon`) | wikimedia | CC BY-SA 4.0 | Plain steamed broccoli florets on a plate — clean, unambiguous match for the simple side. |
| Stir-Fried Bok Choy (`sd-stir-fried-bok-choy`) | wikimedia | CC BY-SA 4.0 | Cooked, glossy bok choy plated with visible garlic bits -- clean unmistakable match. |
| Tahini Sauce (`sd-tahini-sauce`) | wikimedia | CC0 1.0 | A bowl of tahini sauce garnished with lemon slice - direct match for the dish name. |
| Tzatziki (`sd-tzatziki`) | wikimedia | CC BY-SA 3.0 | A full bowl of creamy white tzatziki dotted with paprika and herbs -- clean, unmistakable sauce shot. |
| Panang Beef Curry (`th-panang-beef`) | wikimedia | CC BY-SA 2.0 | Bowl of orange-red panang curry with visible beef chunks — matches dish name and color exactly. |

## Approved this round — 11

Reviewed and approved by Ronnie (2026-07-23). Now wired in `src/data/recipeImages.ts` — same revert path as the EXACT tier above (give the recipe id and the line comes out).

| Recipe (id) | Source | License | Reviewer note |
|---|---|---|---|
| Classic Beef Burgers (`am-beef-burgers`) | wikimedia | CC0 1.0 | Real beef burger with lettuce and fries, but a second (possibly vegan) burger sits in the same frame, creating ambiguity about which is the beef one. |
| Avgolemono (Lemon Chicken Soup) (`gr-lemon-chicken-soup`) | wikimedia | CC BY-SA 2.0 | Pale creamy soup consistent with avgolemono and captioned as such, but no chicken visibly identifiable in the smooth soup itself. |
| BBQ Tofu Bowls (`bq-bbq-tofu-bowls`) | wikimedia | CC BY 2.0 | Baked tofu in a red BBQ-style sauce -- correct protein and sauce style, but just a plate of tofu, no bowl components (corn/cabbage). |
| Creamy Lemon Salmon Pasta (`it-creamy-salmon-pasta`) | wikimedia | CC BY-SA 2.0 | Farfalle pasta in cream sauce with spinach and pink/orange chunks that could be salmon, but the protein is not unambiguously identifiable. |
| Orzo Pilaf (`sd-orzo-pilaf`) | wikimedia | CC BY-SA 4.0 | Grains in a pot look more like plain rice than orzo pasta at this resolution; captioned as orzo pilav but visual confirmation is uncertain. |
| Coconut Rice (`sd-coconut-rice`) | wikimedia | CC BY-SA 4.0 | Garnished rice with carrot, parsley, olive in a bowl - no visible coconut texture/flakes to confirm it is specifically coconut rice. |
| Basmati Rice (`sd-basmati-rice`) | wikimedia | CC BY-SA 3.0 | Cooked white rice spilling from a basket on a stylized red background - plausible but unusual, non-standard presentation. |
| Batata Harra Bowl (`me-batata-harra-bowl`) | wikimedia | CC BY-SA 2.0 | Fried spiced potatoes with roasted red pepper clearly visible matching the potato/pepper veg, but no beans (the recipe's primary protein) are visible. |
| Simple Green Salad (`sd-simple-green-salad`) | wikimedia | CC BY 2.0 | Mixed greens with tomato and cucumber visible, but also olives, feta and red onion not in this simple recipe - a fancier composed salad variant. |
| Herbed Couscous (`sd-herbed-couscous`) | themealdb | TheMealDB (free tier, attribution required) | A grain salad with herbs and pomegranate that could pass for herbed couscous, but grain identity and aubergine ingredient are uncertain. |
| Creamy Polenta (`sd-creamy-polenta`) | wikimedia | CC BY-SA 2.0 | A smooth, creamy polenta base is visible and matches the texture, but it's topped with braised ribs and greens not part of this side dish. |

## Held — kept the tile (dish/subject mismatch) — 9

Ronnie did not approve these; nothing wired, tile fallback stays. Reply "wire N" any time to reconsider one, or ignore.

| Recipe (id) | Best candidate image | License | Reviewer note |
|---|---|---|---|
| Garlic Yogurt Sauce (`sd-garlic-yogurt-sauce`) | [image](https://upload.wikimedia.org/wikipedia/commons/7/7f/Dolma_with_garlic_yogurt_sauce.jpg) | CC BY-SA 4.0 | Yogurt-garlic sauce visible drizzled over stuffed dolma, but the sauce is a minor garnish on an unrelated dish rather than the focus. |
| Honey Garlic Shrimp (`cn-honey-garlic-shrimp`) | [image](https://upload.wikimedia.org/wikipedia/commons/9/9b/Buttered_Garlic_Shrimp_Viand_at_Night.jpg) | CC BY 4.0 | Buttered garlic shrimp, right protein, but no honey glaze or broccoli, different (Filipino) style. |
| BBQ Chicken Sandwiches (`bq-bbq-chicken-sandwiches`) | [image](https://upload.wikimedia.org/wikipedia/commons/6/60/Fast_Food_Fried_Chicken_Sandwiches.jpg) | CC BY-SA 4.0 | Assorted fast-food fried chicken sandwiches - right format and protein but not clearly BBQ-sauced, no cabbage. |
| Chicken Shawarma Bowls (`md-chicken-shawarma-bowl`) | [image](https://upload.wikimedia.org/wikipedia/commons/9/90/Chicken_Shawarma.jpg) | CC BY-SA 4.0 | Shawarma-spiced chicken wrapped in pita bread — right protein/flavor, but a wrap not a bowl. |
| Chicken Kofta (`me-chicken-kofta`) | [image](https://upload.wikimedia.org/wikipedia/commons/f/f5/Arabic_Chicken_Kofta_Rice_with_Grilled_Chicken.jpg) | CC BY 2.0 | Middle Eastern chicken platter with rice, salad, and sauces, but the visible chicken piece is a leg quarter, not kofta shape. |
| Charred Green Beans with Chili (`sd-charred-green-beans-chili`) | [image](https://upload.wikimedia.org/wikipedia/commons/9/90/Green_bean_dishes_of_Turkey.jpg) | CC BY-SA 4.0 | Green beans in a tomato/chili-tinted stew — right main ingredient but stewed rather than charred/stir-fried. |
| Cilantro Lime Rice (`sd-cilantro-lime-rice`) | [image](https://upload.wikimedia.org/wikipedia/commons/5/57/Cilantro_Lime_Chicken_with_Rice.jpg) | CC0 1.0 | Full plate of chicken and vegetables with a plain-looking rice mound — rice itself doesn't clearly show cilantro/lime flecking. |
| Sheet-Pan Lemon Chicken & Potatoes (`md-sheet-pan-chicken`) | [image](https://upload.wikimedia.org/wikipedia/commons/e/e8/0959Filipino_chicken_adobo_with_potatoes_in_lemon_grass_06.jpg) | CC0 1.0 | Chicken and whole potatoes present but this is a dark braised Filipino adobo stew, not a sheet-pan roasted lemon chicken; no lemon or roasting visible. |
| Oyakodon (Chicken & Egg Bowl) (`jp-oyakodon`) | [image](https://upload.wikimedia.org/wikipedia/commons/0/04/Tokyo_Tokyo%27s_%22Chicken_Oyakodon_Donburi_Bowl%22_Meal.jpg) | CC BY-SA 4.0 | Rice bowl with chicken and green onion visible, matching donburi format, but no visible egg (the signature element of oyakodon). |

## Rejected (keep the tile) — 13

- Tuscan Chicken Skillet (`it-tuscan-chicken`)
- Sheet-Pan Sausage & Veggies (`am-sheet-pan-sausage`)
- Charred Bell Peppers (`sd-charred-bell-peppers`)
- Buttered Egg Noodles (`sd-buttered-egg-noodles`)
- Herbed White Beans (`sd-herbed-white-beans`)
- Elote Corn Bowl (`bq-elote-bowl`)
- Roasted Broccoli (`sd-roasted-broccoli`)
- Spiced Chickpeas (`sd-spiced-chickpeas`)
- Baja Fish Tacos (`mx-fish-tacos`)
- Garlic Green Beans (`sd-garlic-green-beans`)
- Garlic Bread (`sd-garlic-bread`)
- Cheese Chile Rellenos (`mx-chile-relleno`)
- Warm Tortillas (`sd-warm-tortillas`)
