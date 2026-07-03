# RECIPE-CONTENT — curated recipe quality pass (M2.2b)

Checklist of all 230 hand-curated recipes (`src/data/seed/recipes.ts` +
`recipeBatch2..8.ts`). The 311 `mealdb-` imported recipes are OUT of scope.

Quality bar, validator, and process are defined in the M2.2b task spec (see
`MILESTONE-2.md`). Work in batches of ~20: re-read the spec, upgrade the
batch, run `npm run typecheck` and
`npx tsx --tsconfig ./tsconfig.json scripts/validateRecipes.ts`, commit.

**Done when:** every box below is checked AND `validateRecipes.ts` passes
on the full curated library with zero exceptions.

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
- [ ] it-chicken-parmesan
- [ ] it-baked-ziti
- [ ] it-shrimp-risotto
- [ ] mx-fish-tacos
- [ ] mx-chile-relleno
- [ ] mx-beef-barbacoa
- [ ] gr-lamb-moussaka
- [ ] gr-chicken-souvlaki-skewers
- [ ] gr-fasolada
- [ ] in-chicken-vindaloo
- [ ] in-rajma
- [ ] in-fish-curry
- [ ] th-shrimp-pineapple-rice
- [ ] th-khao-soi
- [ ] th-pad-see-ew
- [ ] jp-beef-teriyaki
- [ ] jp-agedashi-tofu-rice
- [ ] jp-chicken-curry-rice

## Batch 9 — recipeBatch5.ts part B (18)
- [ ] cn-cashew-chicken
- [ ] cn-dan-dan-noodles
- [ ] cn-veg-fried-rice
- [ ] fr-herb-roast-chicken
- [ ] fr-cassoulet
- [ ] fr-onion-soup
- [ ] md-chicken-kabobs
- [ ] md-shrimp-saganaki
- [ ] md-quinoa-bowl
- [ ] am-philly-cheesesteak
- [ ] am-tomato-soup-grilled-cheese
- [ ] am-fried-chicken-sandwich
- [ ] me-chicken-kabsa
- [ ] me-freekeh-bowl
- [ ] me-lamb-tagine
- [ ] bq-smoked-wings
- [ ] bq-portobello-burgers
- [ ] bq-bbq-brisket

## Batch 10 — recipeBatch6.ts (6) + recipeBatch7.ts part A (14)
- [ ] it-lentil-bolognese
- [ ] mx-lentil-tacos
- [ ] in-coconut-lentil-curry
- [ ] am-lentil-shepherds-pie
- [ ] md-lentil-herb-salad
- [ ] fr-lentil-goat-cheese-salad
- [ ] it-penne-vodka
- [ ] it-chicken-marsala
- [ ] it-seafood-linguine
- [ ] mx-enchiladas-suizas
- [ ] mx-bean-tostadas
- [ ] mx-shrimp-ceviche
- [ ] gr-briam
- [ ] gr-baked-feta-pasta
- [ ] gr-grilled-swordfish
- [ ] in-palak-paneer
- [ ] in-chicken-biryani
- [ ] in-egg-curry
- [ ] th-tom-yum-shrimp
- [ ] th-pad-krapow

## Batch 11 — recipeBatch7.ts part B (22)
- [ ] th-yellow-curry
- [ ] jp-chicken-karaage
- [ ] jp-soba-salad
- [ ] jp-tuna-poke-bowl
- [ ] cn-mongolian-beef
- [ ] cn-chicken-chow-mein
- [ ] cn-hot-sour-soup
- [ ] fr-sole-meuniere
- [ ] fr-chicken-fricassee
- [ ] fr-potato-leek-soup
- [ ] md-garlic-butter-shrimp
- [ ] md-vegetable-paella
- [ ] md-lamb-meatballs
- [ ] am-meatball-sub
- [ ] am-chili-mac
- [ ] am-breakfast-burrito
- [ ] me-chicken-kofta
- [ ] me-lamb-shawarma-plate
- [ ] me-batata-harra-bowl
- [ ] bq-grilled-salmon
- [ ] bq-beer-brats
- [ ] bq-elote-bowl

## Batch 12 — recipeBatch8.ts (20)
- [ ] in-palak-tofu
- [ ] in-tofu-tikka-masala
- [ ] cn-kung-pao-tofu
- [ ] th-tofu-pad-see-ew
- [ ] jp-teriyaki-tofu-donburi
- [ ] mx-tofu-sofritas-bowls
- [ ] me-tofu-shawarma-bowls
- [ ] am-crispy-tofu-buddha-bowl
- [ ] am-sheet-pan-salmon
- [ ] in-coconut-salmon-curry
- [ ] th-salmon-red-curry
- [ ] mx-chipotle-salmon-tacos
- [ ] it-creamy-salmon-pasta
- [ ] me-harissa-salmon
- [ ] gr-fish-plaki
- [ ] it-tuna-puttanesca
- [ ] am-blackened-tilapia
- [ ] cn-steamed-ginger-fish
- [ ] fr-trout-amandine
- [ ] md-herb-branzino
