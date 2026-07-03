# RECIPE-CONTENT — curated recipe quality pass (M2.2b)

Checklist of all 230 hand-curated recipes (`src/data/seed/recipes.ts` +
`recipeBatch2..8.ts`). The 311 `mealdb-` imported recipes are OUT of scope.

Quality bar, validator, and process are defined in the M2.2b task spec (see
`MILESTONE-2.md`). Work in batches of ~20: re-read the spec, upgrade the
batch, run `npm run typecheck` and
`npx tsx --tsconfig ./tsconfig.json scripts/validateRecipes.ts`, commit.

**Done when:** every box below is checked AND `validateRecipes.ts` passes
on the full curated library with zero exceptions.

**STATUS: DONE.** All 230 recipes checked off; `validateRecipes.ts` passes
with zero exceptions as of this commit.

## Batch 1 — recipes.ts (24)
- [x] it-tuscan-chicken
- [x] it-caprese-pasta
- [x] mx-chicken-tacos
- [x] mx-beef-burrito-bowls
- [x] gr-chicken-bowls
- [x] gr-chickpea-salad
- [x] in-tikka-masala
- [x] in-chana-masala
- [x] th-basil-beef
- [x] th-red-curry-tofu
- [x] jp-teriyaki-salmon
- [x] jp-chicken-katsu
- [x] cn-beef-broccoli
- [x] cn-kung-pao-chicken
- [x] fr-dijon-chicken
- [x] fr-ratatouille
- [x] md-sheet-pan-chicken
- [x] md-shrimp-orzo
- [x] am-beef-burgers
- [x] am-turkey-chili
- [x] me-beef-kofta
- [x] me-falafel-bowls
- [x] bq-pulled-pork
- [x] bq-grilled-chicken

## Batch 2 — recipeBatch2.ts part A (18)
- [x] it-sausage-peppers
- [x] it-minestrone
- [x] it-margherita-flatbread
- [x] mx-shrimp-fajitas
- [x] mx-veggie-enchiladas
- [x] mx-pork-carnitas
- [x] gr-pork-souvlaki
- [x] gr-lemon-chicken-soup
- [x] gr-stuffed-peppers
- [x] in-saag-paneer
- [x] in-tandoori-chicken
- [x] in-dal-tadka
- [x] th-pad-thai-shrimp
- [x] th-green-curry-chicken
- [x] th-larb-chicken
- [x] jp-chicken-yakitori
- [x] jp-miso-salmon
- [x] jp-veg-ramen

## Batch 3 — recipeBatch2.ts part B (18)
- [x] cn-chicken-fried-rice
- [x] cn-mapo-tofu
- [x] cn-honey-garlic-shrimp
- [x] fr-salmon-papillote
- [x] fr-croque-monsieur
- [x] fr-lentil-soup
- [x] md-baked-cod
- [x] md-chickpea-stew
- [x] md-chicken-shawarma-bowl
- [x] am-cobb-salad
- [x] am-mac-and-cheese
- [x] am-sheet-pan-sausage
- [x] me-shakshuka
- [x] me-chicken-shawarma
- [x] me-mujadara
- [x] bq-bbq-chicken-sandwiches
- [x] bq-veggie-skewers
- [x] bq-baby-back-ribs

## Batch 4 — recipeBatch3.ts part A (18)
- [x] it-spaghetti-bolognese
- [x] it-eggplant-parmesan
- [x] it-shrimp-scampi
- [x] mx-carne-asada
- [x] mx-tortilla-soup
- [x] mx-huevos-rancheros
- [x] gr-chicken-gyros
- [x] gr-branzino
- [x] gr-gigantes
- [x] in-butter-chicken
- [x] in-aloo-gobi
- [x] in-lamb-curry
- [x] th-tom-kha-gai
- [x] th-drunken-noodles
- [x] th-peanut-tofu-bowls
- [x] jp-gyudon
- [x] jp-tofu-stirfry
- [x] jp-shrimp-udon

## Batch 5 — recipeBatch3.ts part B (18)
- [x] cn-sweet-sour-pork
- [x] cn-veg-lo-mein
- [x] cn-orange-chicken
- [x] fr-coq-au-vin
- [x] fr-quiche-lorraine
- [x] fr-nicoise-salad
- [x] md-halloumi-salad
- [x] md-tuna-white-bean
- [x] md-spiced-lamb-pita
- [x] am-sloppy-joes
- [x] am-buffalo-chicken-wraps
- [x] am-black-bean-burgers
- [x] me-harira
- [x] me-baked-kafta
- [x] me-fattoush-chicken
- [x] bq-sausage-beans
- [x] bq-grilled-shrimp-skewers
- [x] bq-bbq-tofu-bowls

## Batch 6 — recipeBatch4.ts part A (18)
- [x] it-chicken-piccata
- [x] it-pesto-gnocchi
- [x] it-wedding-soup
- [x] mx-chicken-quesadillas
- [x] mx-beef-picadillo
- [x] mx-sweet-potato-tacos
- [x] gr-lamb-gyros
- [x] gr-spanakopita
- [x] gr-salmon-tzatziki
- [x] in-chicken-korma
- [x] in-palak-dal
- [x] in-veg-biryani
- [x] th-panang-beef
- [x] th-thai-fried-rice
- [x] th-massaman-chicken
- [x] jp-oyakodon
- [x] jp-yaki-udon
- [x] jp-pork-tonkatsu

## Batch 7 — recipeBatch4.ts part B (18)
- [x] cn-general-tso
- [x] cn-egg-foo-young
- [x] cn-black-pepper-beef
- [x] fr-beef-bourguignon
- [x] fr-mushroom-risotto
- [x] fr-steak-frites
- [x] md-stuffed-eggplant
- [x] md-lamb-chops
- [x] md-lemon-garlic-salmon
- [x] am-meatloaf
- [x] am-chicken-pot-pie
- [x] am-potato-soup
- [x] me-chicken-tagine
- [x] me-beef-shawarma-plate
- [x] me-cauliflower-shawarma
- [x] bq-steak-chimichurri
- [x] bq-memphis-pork-chops
- [x] bq-corn-bean-salad

## Batch 8 — recipeBatch5.ts part A (18)
- [x] it-chicken-parmesan
- [x] it-baked-ziti
- [x] it-shrimp-risotto
- [x] mx-fish-tacos
- [x] mx-chile-relleno
- [x] mx-beef-barbacoa
- [x] gr-lamb-moussaka
- [x] gr-chicken-souvlaki-skewers
- [x] gr-fasolada
- [x] in-chicken-vindaloo
- [x] in-rajma
- [x] in-fish-curry
- [x] th-shrimp-pineapple-rice
- [x] th-khao-soi
- [x] th-pad-see-ew
- [x] jp-beef-teriyaki
- [x] jp-agedashi-tofu-rice
- [x] jp-chicken-curry-rice

## Batch 9 — recipeBatch5.ts part B (18)
- [x] cn-cashew-chicken
- [x] cn-dan-dan-noodles
- [x] cn-veg-fried-rice
- [x] fr-herb-roast-chicken
- [x] fr-cassoulet
- [x] fr-onion-soup
- [x] md-chicken-kabobs
- [x] md-shrimp-saganaki
- [x] md-quinoa-bowl
- [x] am-philly-cheesesteak
- [x] am-tomato-soup-grilled-cheese
- [x] am-fried-chicken-sandwich
- [x] me-chicken-kabsa
- [x] me-freekeh-bowl
- [x] me-lamb-tagine
- [x] bq-smoked-wings
- [x] bq-portobello-burgers
- [x] bq-bbq-brisket

## Batch 10 — recipeBatch6.ts (6) + recipeBatch7.ts part A (14)
- [x] it-lentil-bolognese
- [x] mx-lentil-tacos
- [x] in-coconut-lentil-curry
- [x] am-lentil-shepherds-pie
- [x] md-lentil-herb-salad
- [x] fr-lentil-goat-cheese-salad
- [x] it-penne-vodka
- [x] it-chicken-marsala
- [x] it-seafood-linguine
- [x] mx-enchiladas-suizas
- [x] mx-bean-tostadas
- [x] mx-shrimp-ceviche
- [x] gr-briam
- [x] gr-baked-feta-pasta
- [x] gr-grilled-swordfish
- [x] in-palak-paneer
- [x] in-chicken-biryani
- [x] in-egg-curry
- [x] th-tom-yum-shrimp
- [x] th-pad-krapow

## Batch 11 — recipeBatch7.ts part B (22)
- [x] th-yellow-curry
- [x] jp-chicken-karaage
- [x] jp-soba-salad
- [x] jp-tuna-poke-bowl
- [x] cn-mongolian-beef
- [x] cn-chicken-chow-mein
- [x] cn-hot-sour-soup
- [x] fr-sole-meuniere
- [x] fr-chicken-fricassee
- [x] fr-potato-leek-soup
- [x] md-garlic-butter-shrimp
- [x] md-vegetable-paella
- [x] md-lamb-meatballs
- [x] am-meatball-sub
- [x] am-chili-mac
- [x] am-breakfast-burrito
- [x] me-chicken-kofta
- [x] me-lamb-shawarma-plate
- [x] me-batata-harra-bowl
- [x] bq-grilled-salmon
- [x] bq-beer-brats
- [x] bq-elote-bowl

## Batch 12 — recipeBatch8.ts (20)
- [x] in-palak-tofu
- [x] in-tofu-tikka-masala
- [x] cn-kung-pao-tofu
- [x] th-tofu-pad-see-ew
- [x] jp-teriyaki-tofu-donburi
- [x] mx-tofu-sofritas-bowls
- [x] me-tofu-shawarma-bowls
- [x] am-crispy-tofu-buddha-bowl
- [x] am-sheet-pan-salmon
- [x] in-coconut-salmon-curry
- [x] th-salmon-red-curry
- [x] mx-chipotle-salmon-tacos
- [x] it-creamy-salmon-pasta
- [x] me-harissa-salmon
- [x] gr-fish-plaki
- [x] it-tuna-puttanesca
- [x] am-blackened-tilapia
- [x] cn-steamed-ginger-fish
- [x] fr-trout-amandine
- [x] md-herb-branzino
