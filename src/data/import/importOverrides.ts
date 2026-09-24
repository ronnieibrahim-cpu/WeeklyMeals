/**
 * Hand-reviewed triage of the TheMealDB imports (M5.8 task 3c), consumed by
 * scripts/importRecipes.ts. Checked in so every keep/fix/drop is reviewable.
 *
 * DROPS: recipe id → why it can't be fixed. Dropped recipes leave the
 * planning pool (generation, re-roll, search, browse) BEFORE the per-cuisine
 * cap, so the next-best candidate from the frozen fixture refills the slot.
 * They are still emitted as `recipeImportedRetired`, so a saved plan, rating,
 * favorite or note that points at one keeps resolving — ids are never reused.
 *
 * FIXES: recipe id → corrections applied to the RAW TheMealDB record before
 * normalize(), so allergens, diet tags, protein, spice and departments are
 * re-inferred from the corrected text (same British-keyword rules). Write
 * fix text in the fixture's own words; the US renames run on output.
 */

export interface ImportFix {
  /** One line: what was wrong. */
  note: string;
  /** Replaces strInstructions. One step per line. */
  instructions?: string;
  /** Replaces the whole ingredient list. */
  ingredients?: { name: string; measure: string }[];
  /** Raw ingredient name → corrected measure (first match, case-insensitive). */
  measures?: Record<string, string>;
  /** Raw ingredient names to remove, one occurrence each (duplicates, junk). */
  removeIngredients?: string[];
  /** Appended to the ingredient list (a seasoning a step uses, etc.). */
  addIngredients?: { name: string; measure: string }[];
  /** Replace the technique-based time guess. */
  prepMinutes?: number;
  cookMinutes?: number;
}

export const IMPORT_DROPS: Record<string, string> = {
  // Batch 1. No refill: the fixture has no spare candidates (decision 45).
  'mealdb-53371': 'Sichuan long beans: the two "steps" are notes, with no cooking at all; also a side, not a dinner.',
  'mealdb-53063': 'Chivito: garbled steps ("crush the meat so that it is finite"); brisket in a thin-steak sandwich.',
  'mealdb-53478': 'Grilled corn with garlic mayo: a side dish, not a dinner main.',
  // Batch 2.
  'mealdb-53254': 'Ezme: a relish/dip, not a dinner main.',
  'mealdb-53288': 'Algerian flafla: a roasted-pepper side salad, not a dinner main.',
  'mealdb-53107': 'Avocado dip with new potatoes: a party snack ("before your guests arrive"), not a dinner.',
  'mealdb-53171': 'Salt cod tortilla: salt cod needs a 24–48 h soak the recipe never mentions; hard to find at H-E-B.',
  'mealdb-53158': 'Air fryer patatas bravas: needs an air fryer, and duplicates the oven patatas bravas (mealdb-53172).',
};

export const IMPORT_FIXES: Record<string, ImportFix> = {
  // ── Batch 1 (the 30 thinnest: two long paragraphs each) ──────────────────
  'mealdb-52848': {
    note: 'Two paragraphs → steps; "1 jar" sauce made concrete; sausage doneness temp; salt/pepper listed.',
    measures: { 'Tomato Sauce': '24 oz jar', 'Butter Beans': '3 cans' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'In a large heavy pot over medium-high heat, fry the sausages, turning, until browned all over, about 10 minutes.',
      'Add the tomato sauce and stir well, scraping up the browned bits. Drain and rinse the butter beans, then stir them in with the molasses and mustard.',
      'Bring to a simmer, cover and cook gently for 30 minutes, until the sauce has thickened and the sausages reach 160°F inside.',
      'Season with salt and pepper. Serve with crusty bread or rice.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 40,
  },
  'mealdb-52866': {
    note: 'Oven temp in °F; steps split; sage-frying oil and seasoning listed.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Heat the oven to 400°F. Peel the squash and cut it into 1-inch chunks. Put the squash and unpeeled garlic cloves on a baking sheet, drizzle with 2 tbsp of the olive oil and roast for 35–40 minutes, until the squash is soft enough to crush with a spoon. Season with salt and pepper.',
      'Meanwhile, cook the linguine in salted boiling water according to the package. Reserve 2 cups of the cooking water, then drain.',
      'Squeeze the roasted garlic out of its skins. Blend the squash and garlic with about 1 2/3 cups of the cooking water until smooth.',
      'Heat the remaining 1 tbsp olive oil in a large skillet and fry the sage leaves until crisp, about 1 minute. Lift them onto paper towels.',
      'Tip the pasta and squash sauce into the skillet and toss over low heat until hot, loosening with more cooking water if needed. Scatter with the crispy sage.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 40,
  },
  'mealdb-53110': {
    note: 'Oven temp in °F; chicken doneness temp; steps split.',
    instructions: [
      'Cut 3 slashes into each drumstick. Mix the soy sauce, honey, olive oil, tomato paste and mustard, pour over the chicken and turn to coat. Marinate for 30 minutes at room temperature, or overnight in the fridge.',
      'Heat the oven to 400°F.',
      'Tip the chicken and marinade into a shallow roasting pan. Roast for 35–40 minutes, turning twice, until sticky and glazed and the thickest drumstick reads 175°F near the bone.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 40,
  },
  'mealdb-52920': {
    note: 'Steps split; chicken doneness temp; cook time was 15 (really 50).',
    addIngredients: [{ name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Heat the oil in a large heavy pot over medium-high heat. Add the sliced mushrooms and fry until they start to soften, about 5 minutes.',
      'Add the chicken legs and brown briefly on each side, 2–3 minutes per side.',
      'Pour in the passata, crumble in the bouillon cube and stir in the olives. Season with black pepper — it shouldn’t need salt.',
      'Cover and simmer gently for 40 minutes, until the chicken is tender and reads 175°F at the thickest part.',
      'Sprinkle with chopped parsley. Serve with pasta, or mashed potatoes and a green vegetable.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 50,
  },
  'mealdb-52959': {
    note: 'Oven temp in °F; fish doneness temp; steps split; salt listed.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }],
    instructions: [
      'Heat the oven to 350°F. Trim the fronds from the fennel and set them aside. Halve each bulb and cut each half into 3 wedges.',
      'Cook the fennel wedges in boiling salted water for 10 minutes, then drain well.',
      'Roughly chop the fennel fronds and mix with the parsley and the lemon zest.',
      'Spread the fennel in a shallow baking dish, add the cherry tomatoes and drizzle with the olive oil. Bake for 10 minutes.',
      'Nestle the salmon among the vegetables, sprinkle with the lemon juice and a pinch of salt, and bake 15 minutes more, until the salmon flakes easily and reads 145°F.',
      'Scatter with the herb mixture and the olives and serve.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 35,
  },
  'mealdb-53009': {
    note: 'Steps split; lamb doneness temp; pita amount made concrete.',
    measures: { 'Pita Bread': '4' },
    instructions: [
      'Pound the garlic with the sea salt using a mortar and pestle (or a small food processor) until it forms a paste.',
      'Whisk the olive oil, lemon juice and zest, dill and garlic paste together. Cut the lamb into 1 1/4-inch cubes, add to the marinade and mix well. Cover and marinate in the fridge for at least 2 hours or overnight. If using bamboo skewers, soak them in cold water.',
      'Take the lamb out of the fridge 30 minutes before cooking. Thread the meat onto skewers.',
      'Heat a grill, grill pan or broiler to high. Cook the skewers for 2–3 minutes per side, basting with the leftover marinade, until browned outside and 135°F inside for medium.',
      'Warm the pitas briefly and stuff with the lamb.',
    ].join('\n'),
    prepMinutes: 20, cookMinutes: 12,
  },
  'mealdb-52960': {
    note: 'Unnamed "dressing ingredients" spelled out; fish doneness temp; steps split; salt/pepper listed.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Make the dressing: finely chop the mint and whisk it with the lime zest and juice, the honey and 2 tbsp of the olive oil. Season with salt and pepper.',
      'Halve, pit, peel and slice the avocados. Quarter the cucumber lengthwise, then slice it.',
      'Divide the spinach, avocado and cucumber among four plates and drizzle with half the dressing.',
      'Season the salmon with salt and pepper and rub with the remaining 1 tbsp olive oil. Heat a nonstick skillet over medium-high heat and pan-fry the salmon for 3–4 minutes per side, until crisp outside and 145°F in the thickest part.',
      'Set a salmon fillet on each salad, drizzle with the rest of the dressing and serve warm.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 10,
  },
  'mealdb-53006': {
    note: 'Potatoes went in raw and never cooked — now boiled first; beef doneness; broiler in US terms; seasoning listed.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Peel the potatoes, cut them into 3/4-inch cubes and boil in salted water for 10 minutes, until just tender. Drain.',
      'Meanwhile, brown the ground beef in a deep ovenproof skillet over high heat, breaking it up, until no pink remains, about 5–7 minutes.',
      'Prick the eggplant all over with a fork and microwave on high for 4–6 minutes, until soft. Slice it into rounds.',
      'Mix the yogurt, egg and parmesan with a pinch of salt and pepper.',
      'Heat the broiler to high. Stir the chopped tomatoes, tomato paste and potatoes into the beef, season, and simmer for 5 minutes until hot through.',
      'Smooth the top, lay the eggplant slices over it, then spread the yogurt mixture evenly on top. Broil for 5–8 minutes, until the topping is set and golden.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 30,
  },
  'mealdb-53142': {
    note: 'Raw potatoes would not cook in 8 minutes — now parboiled; egg doneness cue; salt/pepper listed.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Peel the potatoes, cut them into 3/4-inch cubes and boil in salted water for 8–10 minutes until just tender. Drain.',
      'Heat the oil in a large ovenproof nonstick skillet. Fry the chopped onion and half the chopped chile for 5 minutes until soft.',
      'Stir in the curry powder for 1 minute, then add the halved cherry tomatoes, the potatoes and the chopped cilantro stems.',
      'Beat the eggs with salt and pepper, pour them over the vegetables and cook gently for 8–10 minutes, until almost set.',
      'Heat the broiler and slide the pan underneath for 1–2 minutes, until the top is set and no longer wet.',
      'Scatter with the cilantro leaves and the rest of the chile, cut into wedges and serve with a green salad.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 30,
  },
  'mealdb-53167': {
    note: 'Steps split; lemon wedges and salt listed; seafood doneness cue.',
    addIngredients: [{ name: 'Lemon', measure: '1' }, { name: 'Salt', measure: 'to taste' }],
    instructions: [
      'Heat the oil in a large deep skillet and cook the sliced leek for 5 minutes without browning.',
      'Add the diced chorizo and fry until it releases its red oil, about 2 minutes.',
      'Stir in the turmeric and rice until coated, then pour in the fish broth. Bring to a boil, then simmer for 15 minutes, stirring occasionally.',
      'Add the peas and cook for 5 minutes, then stir in the seafood mix and cook 2–3 minutes more, until the shrimp are pink and opaque and the rice is tender.',
      'Season with salt and serve right away with lemon wedges.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 30,
  },
  'mealdb-52837': {
    note: 'Steps split; parmesan amount made concrete.',
    measures: { Parmesan: '1 oz' },
    instructions: [
      'Cook the spaghetti in salted boiling water according to the package.',
      'Meanwhile, heat the oil in a nonstick skillet and fry the onion, garlic and chopped chile for 3–4 minutes to soften.',
      'Stir in the tomato paste for 1 minute, then add the pilchards with their sauce, breaking the fish up with a wooden spoon. Add the olives and cook a few minutes more until hot.',
      'Drain the pasta, add it to the pan with 2–3 tbsp of the cooking water and toss well. Serve topped with shaved parmesan.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 20,
  },
  'mealdb-52851': {
    note: 'Chicken went in "chunks" but was listed whole; doneness temp; steps split; rice now listed.',
    addIngredients: [{ name: 'Rice', measure: '1 1/2 cups' }],
    instructions: [
      'Cook the rice according to the package.',
      'Finely slice a quarter of the chile. Put the rest in a food processor with the ginger, garlic, cilantro stems and a third of the leaves, and blend to a rough paste, adding a splash of water if needed.',
      'Cut the chicken breasts into bite-size chunks. Heat the oil in a large skillet and fry the chicken for 1–2 minutes to brown.',
      'Stir in the paste for 1 minute, then add the peanut butter, broth and yogurt.',
      'Bring to a gentle bubble and cook for 10 minutes, until the sauce thickens and the chicken reads 165°F.',
      'Stir in most of the remaining cilantro, scatter the rest on top with the sliced chile, and serve with the rice.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 20,
  },
  'mealdb-52999': {
    note: 'Onion/mushroom amounts were blank; oil and vinegar used but unlisted; sausage doneness temp; steps split.',
    measures: { Cabbage: '1/2 head', 'Garlic Clove': '4', Onion: '1', 'Shiitake Mushrooms': '4 oz', 'Chicken Stock': '1/2 cup', 'Italian Fennel Sausages': '4' },
    addIngredients: [{ name: 'Olive Oil', measure: '3 tbs' }, { name: 'Red Wine Vinegar', measure: '1 tbs' }],
    instructions: [
      'Heat the oven to 350°F. Strip the kale leaves from the stems and tear them into 1-inch pieces. Coarsely chop the cabbage.',
      'Heat 1 tbsp olive oil in a skillet and fry the sliced onion and mushrooms for 5 minutes until soft.',
      'Combine the kale, cabbage, onion, mushrooms and thinly sliced garlic in a large baking dish. Toss with 1 tbsp olive oil and pour the broth over.',
      'Cover with foil and bake for 15 minutes, until the greens wilt. Uncover, season with salt and pepper, and bake 20–25 minutes more until the cabbage is tender.',
      'Meanwhile, heat the remaining oil in a large skillet over medium-high heat. Prick the sausages and fry, turning, until browned all over and 160°F inside, 10–12 minutes.',
      'Slice the sausages and toss them into the greens with the vinegar.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 45,
  },
  'mealdb-53102': {
    note: 'Steps split; squid doneness cue; salt/pepper listed.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Char the whole bell peppers under a hot broiler or on a grill, turning, until blackened all over. Put them in a bowl, cover with a plate and let cool.',
      'Peel, seed and finely slice the peppers. In a large bowl mix them and their juices with the drained chickpeas, chopped parsley, chopped chile and minced garlic.',
      'Slice the squid into rings. Heat a large skillet until smoking, add a splash of the oil, then the squid, and stir-fry for 30 seconds.',
      'Add the diced chorizo and cook 30 seconds more, until the squid is opaque and just firm — any longer and it turns rubbery. Tip everything into the bowl.',
      'Season with salt and pepper, dress with the remaining oil and the lemon juice and zest, toss and serve.',
    ].join('\n'),
    prepMinutes: 20, cookMinutes: 15,
  },
  'mealdb-53184': {
    note: '"Boil the kettle" and 500 ml in US terms; shrimp doneness cue; salt listed.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }],
    instructions: [
      'Bring 2 cups of water to a boil.',
      'In a large nonstick skillet with a lid, fry the onion, bell peppers, chorizo and garlic in the oil over high heat for 3 minutes.',
      'Stir in the rice and the canned tomatoes with the boiling water. Cover and cook over high heat for 12 minutes.',
      'Uncover and stir — the rice should be almost tender. Stir in the shrimp, adding a splash more water if it looks dry, and cook 2–3 minutes, until the shrimp are pink and the rice is tender.',
      'Season with salt and serve.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 20,
  },
  'mealdb-53263': {
    note: '"Handful" pine nuts and a stock cube made concrete; water listed; steps split.',
    measures: { 'Pine Nuts': '1/3 cup', 'Lamb Stock': '1 cube' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Toast the pine nuts in a large dry pot over medium heat until golden, 2–3 minutes, then tip onto a plate.',
      'Add the oil to the pot and fry the chopped onion and cinnamon sticks until the onion starts to turn golden, about 6 minutes.',
      'Turn up the heat, add the lamb (cut into bite-size pieces) and fry until browned on all sides, then stir in the rice for 1 minute.',
      'Pour in 2 cups boiling water, crumble in the bouillon cube and add the apricots. Season with salt and pepper.',
      'Lower the heat, cover and simmer for 12–15 minutes, until the rice is tender and the liquid is absorbed.',
      'Remove the cinnamon sticks, toss in the pine nuts and chopped mint, and serve.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 30,
  },
  'mealdb-53270': {
    note: '"Seasoning" was a vague ingredient — now salt/pepper; "two tubs" of yogurt made clear; lamb doneness temp.',
    removeIngredients: ['Seasoning'],
    addIngredients: [{ name: 'Salt', measure: '1 tsp' }, { name: 'Black Pepper', measure: '1 tsp' }],
    instructions: [
      'Heat the broiler to high. Season the lamb steaks with half the salt and pepper, then broil for 2 minutes per side until browned.',
      'Meanwhile, mix the rest of the salt and pepper, the oregano, half the chopped mint and half the yogurt.',
      'Spread the yogurt mixture over the lamb and broil 2–3 minutes more, until the yogurt blisters and the lamb reads 135°F for medium.',
      'Rest the lamb for 5 minutes. Meanwhile, toast the pitas, shred the lettuce and thinly slice the red onion. Stir the rest of the mint into the remaining yogurt.',
      'Slice the lamb thickly and stuff it into the pitas with the salad and minted yogurt. Squeeze lemon over to serve.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 12,
  },
  'mealdb-53274': {
    note: 'Eggplant slicing was never mentioned; salt listed; flatbread added so it works as a dinner.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Pita Bread', measure: '4' }],
    instructions: [
      'Slice the eggplants lengthwise about 1/2 inch thick. Brush the slices with the oil and season with salt.',
      'Heat a grill pan or grill until very hot. Cook the eggplant for 2–3 minutes per side, until golden and tender all the way through.',
      'Mix the yogurt with the tahini, crushed garlic, lemon juice and most of the chopped herbs. Season with salt.',
      'Spoon the dressing over the eggplant, scatter with the remaining herbs and serve with warm pitas.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 15,
  },
  'mealdb-53521': {
    note: 'Steps split; salt/pepper listed.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Heat the olive oil in a large pot over medium heat. Add the chopped onion, cover and cook until soft and translucent, about 5 minutes.',
      'Stir in the cubed squash, drained great northern beans and lima beans, then pour in the broth.',
      'Cover and cook until the squash is tender and starting to break apart, 30–40 minutes.',
      'Stir in the corn and chopped basil and cook about 10 minutes more, until thick. Season with salt and pepper.',
      'Serve sprinkled with the chopped banana pepper.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 55,
  },
  'mealdb-52850': {
    note: 'Chicken doneness temp; steps split.',
    instructions: [
      'Heat the oil in a large skillet and cook the chopped onion for 1–2 minutes, just until softened.',
      'Add the chicken (cut into bite-size pieces) and fry for 7–10 minutes, until golden and 165°F inside.',
      'Stir in the ginger and harissa and cook 1 minute more.',
      'Add the apricots, drained chickpeas and couscous, pour over the hot broth and stir once. Cover tightly and leave off the heat for 5 minutes, until the couscous has absorbed the broth.',
      'Fluff with a fork and scatter with the cilantro.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 20,
  },
  'mealdb-52871': {
    note: 'The sauce (mirin, soy, sugar, Worcestershire) was never added — step written in; steps split.',
    instructions: [
      'Bring a large pot of water to a boil. Cook the udon according to the package (about 2 minutes for fresh or frozen, 5–6 for dried), drain and set aside.',
      'Mix the mirin, soy sauce, sugar and Worcestershire sauce in a small bowl.',
      'Heat 1 tbsp of the sesame oil in a wok or large skillet and stir-fry the sliced onion and cabbage for 5 minutes until softened.',
      'Add the sliced mushrooms and half the green onions and stir-fry 1 minute more.',
      'Add the remaining sesame oil, the noodles and the sauce, and toss over high heat until sticky and piping hot, 2–3 minutes. Sprinkle with the remaining green onions.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 15,
  },
  'mealdb-52911': {
    note: 'Lunch-flask/chill-half instructions removed; steps split; salt listed.',
    measures: { Tomatoes: '3', Basil: '1 bunch' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }],
    instructions: [
      'Heat the oil in a large pot and fry the sliced leeks and diced zucchini for 5 minutes to soften.',
      'Pour in the broth, add three-quarters of the drained beans, the green beans and half the chopped tomatoes. Simmer 5–8 minutes, until the vegetables are tender.',
      'Meanwhile, blend the remaining beans and tomatoes with the garlic and basil until smooth, then stir in the parmesan.',
      'Stir the pistou into the soup and cook 1 minute. Season with salt and serve.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 20,
  },
  'mealdb-53012': {
    note: 'Needs an overnight soak and ~2 h cooking — now uses canned beans; oven temp in °F.',
    measures: { 'Butter Beans': '2 cans' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Heat the oven to 350°F. Drain and rinse the butter beans.',
      'Heat the olive oil in a large skillet and fry the onion and garlic over medium heat for 10 minutes until soft but not browned.',
      'Add the tomato paste and cook 1 minute, then add the chopped tomatoes, sugar, oregano and cinnamon and simmer 2–3 minutes. Season well with salt and pepper and stir in the beans.',
      'Tip into a baking dish and bake uncovered for 40–45 minutes, without stirring, until the sauce is thick and bubbling at the edges.',
      'Let cool slightly, scatter with parsley and drizzle with a little more olive oil to serve.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 55,
  },
  'mealdb-53034': {
    note: 'Depended on a separate tonkatsu recipe — breading and frying now written in; pork amount concrete; doneness temps; scaled to 4.',
    measures: { Pork: '4 boneless pork loin chops', 'Vegetable Oil': '1 cup', Eggs: '6', 'Sushi Rice': '2 cups', 'Vegetable Stock': '1 cup', 'Soy Sauce': '3 tbs', Mirin: '2 tbs', Sugar: '1 tbs' },
    addIngredients: [{ name: 'Plain Flour', measure: '1/2 cup' }, { name: 'Panko', measure: '1 1/2 cups' }, { name: 'Salt', measure: 'to taste' }],
    instructions: [
      'Cook the rice according to the package.',
      'Pound the pork chops to about 1/2 inch thick and season with salt. Dredge in the flour, dip in 2 of the beaten eggs, then press into the panko.',
      'Heat the oil in a large skillet to 350°F and fry the pork for 3–4 minutes per side, until golden and 145°F inside. Drain on a rack, then slice into strips.',
      'Pour off all but 1 tbsp of oil. Fry the sliced onion until golden, 5–6 minutes.',
      'Mix the broth, soy sauce, mirin and sugar, pour it around the onion and bring to a simmer. Lay the pork strips on top.',
      'Pour the remaining 4 beaten eggs around the pork, cover and cook 2–3 minutes, until the egg is just set.',
      'Spoon the rice into four bowls, top with the pork and egg, and sprinkle with chives.',
    ].join('\n'),
    prepMinutes: 20, cookMinutes: 30,
  },
  'mealdb-52943': {
    note: 'Needed a pressure cooker and unlisted allspice — now a stovetop braise with allspice listed; 1 lb oxtail made enough for 4.',
    measures: { Oxtail: '3 lb', Water: '4 cups' },
    addIngredients: [{ name: 'Allspice', measure: '1/2 tsp' }, { name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Toss the oxtail with the onion, green onion, garlic, ginger, scotch bonnet, soy sauce, thyme, salt and pepper.',
      'Heat the oil in a large heavy pot over medium-high heat and fry the oxtail until browned all over, about 10 minutes.',
      'Add 4 cups water, bring to a boil, then cover and simmer gently for 2 1/2–3 hours, until the meat is falling off the bone. Add a splash of water if it gets dry.',
      'Add the broad beans and allspice and simmer 10 minutes.',
      'Stir the cornstarch into 2 tbsp water, stir it into the pot and cook a few minutes until the sauce thickens.',
    ].join('\n'),
    prepMinutes: 20, cookMinutes: 190,
  },
  'mealdb-53105': {
    note: 'Duplicate rosemary/thyme rows; chicken doneness temp; oven fallback for no grill.',
    removeIngredients: ['Rosemary', 'Thyme'],
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Mash the garlic with a little salt into a paste. Mix in the lemon zest and juice, curry powder, red pepper flakes, olive oil and plenty of black pepper.',
      'Toss the chicken thighs in the marinade and set aside while you heat the grill to medium.',
      'Lay the herb bunches and bay leaves on the grate and set the chicken, skin side up, on top. Close the lid and cook for 10 minutes.',
      'Turn the chicken and cook 20–30 minutes more, turning as needed, until charred in places and 175°F at the bone. (No grill: roast on the herbs at 425°F for 35–40 minutes.)',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 40,
  },
  'mealdb-53172': {
    note: 'Potato cutting never mentioned; oven temp in °F; salt listed.',
    measures: { Parsley: '2 tbs' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }],
    instructions: [
      'Heat the oven to 400°F. Cut the potatoes into 1-inch chunks, pat dry, then toss in a roasting pan with the 2 tbsp olive oil and some salt.',
      'Roast for 40–50 minutes, turning once, until crisp and golden.',
      'Meanwhile, heat the 3 tbsp olive oil in a saucepan and fry the onion for 5 minutes until soft.',
      'Add the garlic, canned tomatoes, tomato paste, paprika, chili powder, sugar and a pinch of salt. Bring to a boil, then simmer 10 minutes until pulpy.',
      'Spoon the sauce over the potatoes and sprinkle with parsley.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 50,
  },

  // ── Batch 2 ──────────────────────────────────────────────────────────────
  'mealdb-53257': {
    note: 'Freezer/washing-up-bowl asides removed; "small pack" yogurt made concrete; burger doneness temp; salt listed.',
    measures: { Yogurt: '1 cup', 'Garlic Bulb': '1 (about 10 cloves)' },
    addIngredients: [{ name: 'Salt', measure: '1 tsp' }],
    instructions: [
      'Finely chop the onions, garlic and cilantro. Put them in a large bowl with the ground lamb, garam masala, chili sauce and the salt, and mix with your hands until evenly combined.',
      'Shape into 16 small patties.',
      'Heat the broiler to high. Lay the patties in a single layer on a baking sheet (in batches if needed) and broil on the top rack for 5–6 minutes per side, until browned and 160°F in the center.',
      'Serve with warm pitas, sliced tomatoes, shredded red cabbage, sliced red onion and yogurt so everyone builds their own.',
    ].join('\n'),
    prepMinutes: 20, cookMinutes: 15,
  },
  'mealdb-52865': {
    note: 'Written for 2 bowls — paneer and peas scaled to feed 4; naan amount concrete; salt listed.',
    measures: { Paneer: '450g', Peas: '300g', 'Naan Bread': '4' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }],
    instructions: [
      'Cut the paneer into 3/4-inch cubes. Heat the oil in a large skillet over high heat until shimmering, add the paneer and turn the heat down a little. Fry, turning, until browned on each side — it browns fast, so stay with it. Lift onto paper towels.',
      'Add the grated ginger, cumin, turmeric, ground coriander and chopped chile to the pan and fry for 1 minute.',
      'Add the chopped tomatoes, mashing them with the back of a spoon, and simmer for 5 minutes until fragrant, adding a splash of water if it gets too thick. Season with salt.',
      'Add the peas and simmer 2 minutes, then stir in the paneer and sprinkle with the garam masala.',
      'Top with chopped cilantro and serve with warm naan.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 20,
  },
  'mealdb-53453': {
    note: 'Chicken and potato cut size never given; chicken doneness temp; steps split.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }],
    instructions: [
      'Heat the oil in a large skillet over medium-high heat. Fry the diced onions until translucent, about 5 minutes. Add the ginger-garlic paste and cook 5 minutes more.',
      'Lower the heat to medium, stir in the diced tomatoes and cook until pulpy, 5–10 minutes.',
      'Stir in the cayenne, curry powder, garam masala, turmeric, cumin and a good pinch of salt; cook 5 minutes.',
      'Cut the chicken into 1 1/2-inch pieces and the potatoes into 3/4-inch cubes. Add both with 1/2 cup water and simmer, stirring now and then, about 20–25 minutes, until the potatoes are tender and the chicken reads 165°F.',
      'Sprinkle with cilantro and serve hot.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 45,
  },
  'mealdb-53166': {
    note: 'Steps split; chickpeas as cans; salt/pepper and the crusty bread listed.',
    measures: { Chickpeas: '2 cans', Thyme: '3 sprigs' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }, { name: 'Crusty Bread', measure: '1 loaf' }],
    instructions: [
      'Heat the oil in a large pot and gently fry the chopped onion for 3–4 minutes until it begins to soften.',
      'Stir in the carrot, celery, thyme and bay leaves, season, and cook 2–3 minutes.',
      'Add the garlic, sliced chorizo, cinnamon and paprika and fry gently until the chorizo releases its oil and starts to crisp.',
      'Stir in the drained chickpeas, the vinegar and 2/3 cup water and simmer 2 minutes until hot.',
      'Add the spinach and stir until it wilts. Season to taste and serve warm with crusty bread.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 20,
  },
  'mealdb-52935': {
    note: 'Steak doneness temp; flambé made optional and safe; steps split.',
    instructions: [
      'Heat the oil in a 12-inch skillet over medium-high heat. Season the steaks with salt and pepper and cook, turning once, about 4–5 minutes total, until 130°F for medium-rare (145°F for medium). Set aside on a plate.',
      'Add the broth to the skillet over high heat and boil until reduced to 1/2 cup, about 10 minutes. Pour into a bowl.',
      'Melt the butter in the skillet, add the garlic and shallot and cook until soft, 2 minutes. Add the sliced mushrooms and cook until their liquid evaporates and they start to brown.',
      'Off the heat, add the brandy, then return to the heat and simmer until it has mostly cooked off, about 1 minute. (Lighting it is optional — keep kids well back if you do.)',
      'Stir in the reduced broth, cream, mustard, Worcestershire and hot sauce. Return the steaks and cook, turning in the sauce, until warm and the sauce thickens, about 4 minutes.',
      'Plate the steaks, stir the parsley and chives into the sauce and pour it over.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 25,
  },
  'mealdb-53039': {
    note: 'Marinade and slaw ingredients were never identified; room-temp marinating moved to the fridge; oven °F; chicken doneness temp; unlisted fries dropped.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Make the marinade: blend the red chiles, garlic, ginger, oregano, ground coriander, paprika, 2 tbsp of the vinegar and the oil with a pinch of salt.',
      'Rub the marinade all over the chicken and refrigerate for at least 1 hour (or up to overnight).',
      'Heat the oven to 375°F. Roast the chicken in a roasting pan for about 1 hour 20 minutes, until the thickest part of the thigh reads 175°F. Rest under loose foil for 20 minutes.',
      'Meanwhile, make the slaw: thinly slice the red onion and cabbage leaves and grate the carrots and beet. Toss with the mayonnaise, yogurt, remaining 2 tbsp vinegar and the cumin seeds, and season.',
      'Carve the chicken and serve with the slaw.',
    ].join('\n'),
    prepMinutes: 25, cookMinutes: 80,
  },
  'mealdb-53183': {
    note: 'Two paragraphs → steps; meatball doneness temp; bread listed.',
    measures: { Parsley: '1/2 cup', 'Extra Virgin Olive Oil': '1 tbs' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }, { name: 'Crusty Bread', measure: '1 loaf' }],
    instructions: [
      'Melt the butter in a heavy pot and soften the shallots for 5 minutes. Add the paprika and the minced garlic and cook 1 minute. Add the sherry, then scrape everything into a bowl with the breadcrumbs. Season and let cool.',
      'Add the ground pork and egg yolk to the bowl, mix well and shape into 18 small meatballs.',
      'Wipe out the pot, heat the olive oil over medium-high and fry the meatballs for 5 minutes to brown. Lift onto a plate, leaving the oil.',
      'Sizzle the sliced chorizo with the chopped garlic, then add the sliced squid and fry until lightly colored.',
      'Add the wine and boil, scraping the bottom. Stir in the chopped tomatoes and bring back to a boil.',
      'Add the meatballs and clams, cover and cook 5–6 minutes, until the clams open and the meatballs reach 160°F. Discard any clams that stay shut.',
      'Sprinkle with parsley, drizzle with the extra-virgin oil and serve with crusty bread.',
    ].join('\n'),
    prepMinutes: 25, cookMinutes: 30,
  },
  'mealdb-52773': {
    note: 'The "Honey Teriyaki Glaze" had no honey or mirin listed — added; fish doneness temp.',
    addIngredients: [{ name: 'Honey', measure: '2 tbs' }, { name: 'Mirin', measure: '1 tbs' }, { name: 'Rice', measure: '1 1/2 cups' }],
    instructions: [
      'Cook the rice according to the package.',
      'Whisk the soy sauce, sake, honey and mirin together. Cut the salmon into 4 portions and turn them in the glaze.',
      'Heat the oil in a skillet over medium-low heat. Lift the salmon out of the glaze and pan-fry for 3–4 minutes per side.',
      'Pour in the leftover glaze and cook 1–2 minutes, spooning it over, until it thickens and the salmon reads 145°F.',
      'Sprinkle with sesame seeds and serve right away with the rice.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 15,
  },
  'mealdb-53108': {
    note: 'Salt/pepper used but unlisted; "ask the fishmonger" and barbecue talk trimmed; rice added so it is a dinner.',
    measures: { Squid: '1.5 lb', 'sweet chilli sauce': '1/4 cup', 'Sesame Seed Oil': '1 tsp' },
    addIngredients: [{ name: 'Sea Salt', measure: '2 tsp' }, { name: 'Black Pepper', measure: '1 tsp' }, { name: 'Rice', measure: '1 1/2 cups' }],
    instructions: [
      'Cook the rice according to the package.',
      'Cut the cleaned squid bodies open so they lie flat, rinse and pat dry. Cut large ones into 2-inch squares. Lightly score the top in a crisscross and brush with oil.',
      'Mix the sea salt, five-spice and black pepper. Sprinkle over both sides of the squid just before cooking.',
      'Heat a grill pan or large skillet until very hot and cook the squid about 1 minute per side, until it curls and turns opaque.',
      'Drizzle with sesame oil, scatter with cilantro and serve with the rice and sweet chili sauce for dipping.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 20,
  },
  'mealdb-52915': {
    note: 'Was one omelette for one person — scaled to four omelettes made one at a time; knobs made concrete.',
    measures: { Eggs: '12', Butter: '4 tbs', Parmesan: '4 tsp', 'Tarragon Leaves': '1 tbs chopped', Parsley: '2 tbs chopped', Chives: '2 tbs chopped', 'Gruyère': '1 cup' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Mix the chopped herbs and grated Gruyère. You make four omelettes one at a time, each with 3 eggs.',
      'Beat 3 eggs with a fork until just broken up. Season with 1 tsp parmesan, salt and pepper.',
      'Warm an 8-inch nonstick skillet over medium-high heat, add 2 tsp butter and let it sizzle without browning. Pour in the eggs and let them fry gently for a few seconds.',
      'After a few seconds, draw the egg in from the sides with a spatula a few times, then shake the pan to settle. Stop while the top is still soft and moist, about 1 minute in all.',
      'Scatter a quarter of the herbs and cheese over, tilt the pan and roll the omelette onto a plate, folding it in thirds. Rub with a little butter.',
      'Repeat with the remaining eggs.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 15,
  },
  'mealdb-53093': {
    note: 'Times reflect the 1-hour bake.',
    prepMinutes: 10, cookMinutes: 70,
  },
  'mealdb-53157': {
    note: 'Salt/pepper listed; egg and potato doneness cues.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Boil the potatoes in a large pot of salted water for 12 minutes, adding the eggs after 6 minutes and the green beans for the last 2 — the potatoes should be tender when pierced. Drain and cool the eggs under cold running water.',
      'Meanwhile, fry the sliced chorizo for 1–2 minutes until starting to crisp. Lift out with a slotted spoon, leaving the oil. Add the garlic and cook gently for 1 minute.',
      'Off the heat, stir in the vinegar and parsley, then toss with the potatoes, beans and chorizo. Season.',
      'Peel and quarter the eggs and add them to the salad.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 20,
  },
  'mealdb-53178': {
    note: 'Starter portion scaled to a dinner for 4; oil depth/temperature in US terms; lemon made concrete.',
    measures: { Squid: '1.5 lb', 'Vegetable Oil': '6 cups', Lemon: '1' },
    addIngredients: [{ name: 'Salt', measure: '1 tsp' }, { name: 'Black Pepper', measure: '1/2 tsp' }],
    instructions: [
      'Cut the squid into 1/4-inch rings. Put the flour, salt, pepper and chopped capers in a large zip-top bag and shake to mix.',
      'Mix the garlic into the mayonnaise and spoon into a serving bowl.',
      'Pour oil into a large heavy pot to about 3 inches deep (no more than a third full). Heat to 350°F.',
      'Shake the squid in the bag until coated, then fry in handfuls for about 3 minutes, until crisp and golden. Drain on paper towels. Keep children away from the hot oil.',
      'Serve right away with the garlic mayonnaise and lemon wedges.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 20,
  },
  'mealdb-52771': {
    note: 'Parmesan amount made concrete; salt/pepper listed.',
    measures: { 'Parmigiano-Reggiano': '1 oz' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    prepMinutes: 10, cookMinutes: 20,
  },
  'mealdb-52817': {
    note: 'Salt/pepper and extra olive oil used but unlisted.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }, { name: 'Extra Virgin Olive Oil', measure: '1 tbs' }],
    prepMinutes: 10, cookMinutes: 30,
  },
  'mealdb-52852': {
    note: 'Tomatoes used but unlisted; oven °F; egg doneness cue; seasoning listed.',
    addIngredients: [{ name: 'Cherry Tomatoes', measure: '200g' }, { name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Heat the oven to 400°F. Cut the potatoes into bite-size chunks, toss with 2 tsp of the olive oil and some salt and pepper, and roast on a baking sheet for 20–25 minutes, stirring halfway, until golden and tender.',
      'Meanwhile, put the eggs in a small pot of water, bring to a boil, then simmer 8–10 minutes for firm yolks. Cool in cold water, peel and halve.',
      'In a large bowl, whisk the remaining olive oil, sunflower oil, vinegar and capers. Add the halved tomatoes and season.',
      'Add the sliced red onion, spinach, drained tuna and potatoes and toss gently. Top with the eggs and serve.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 25,
  },
  'mealdb-53103': {
    note: 'Was two fish for two, plus a long "know how" essay as a step; now 4 fillets, oven °F, fish doneness temp, couscous listed.',
    measures: { barramundi: '4 fillets (about 6 oz each)' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Couscous', measure: '1 1/2 cups' }],
    instructions: [
      'Blend the cumin, ground coriander, paprika, chili powder, garlic, lemon juice, olive oil, fresh cilantro and a pinch of salt into a dressing.',
      'Coat the fish with half the dressing and marinate in the fridge for 30 minutes.',
      'Heat the oven to 425°F. Put the fish on a baking sheet and roast for 12–15 minutes, until it flakes easily and reads 145°F.',
      'Meanwhile, prepare the couscous according to the package.',
      'Serve the fish on the couscous with the rest of the dressing.',
    ].join('\n'),
    prepMinutes: 40, cookMinutes: 15,
  },
  'mealdb-53278': {
    note: 'Broiler in US terms; eggplant slicing never mentioned; pita served but unlisted; salt listed.',
    measures: { 'Extra Virgin Olive Oil': '1 tbs' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Pita Bread', measure: '4' }],
    instructions: [
      'Heat the broiler to high. Cut the eggplants into 1/2-inch slices and lay them on a large baking sheet. Brush lightly with vegetable oil and season with salt.',
      'Broil for 15 minutes, turning twice and brushing with oil, until soft all the way through.',
      'Meanwhile, blitz the bread into crumbs, add 2 tsp oil and blitz again.',
      'Spread each eggplant slice with a little hummus, press the hummus side into the crumbs and broil crumb-side up for about 3 minutes, until golden.',
      'Toss the chopped walnuts, parsley and halved tomatoes with the lemon juice, olive oil and a pinch of salt. Serve with the eggplant, extra hummus and warm pitas.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 25,
  },
  'mealdb-53280': {
    note: 'Chicken size given; thigh doneness raised to 175°F for tender dark meat.',
    measures: { Chicken: '1 whole (about 4 lb)' },
    instructions: [
      'Heat the oven to 350°F.',
      'In a roasting dish, mix the water, chopped onion, olive oil, balsamic vinegar, mustard, garlic, black pepper, cayenne and salt. Add the chicken and turn to coat.',
      'Roast, basting a few times, for about 1 1/2 hours, until the thickest part of the thigh reads 175°F near the bone.',
      'Rest 10 minutes, then carve and serve with the pan juices.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 90,
  },
  'mealdb-52821': {
    note: 'Written for 2 — scaled to 4; 700 ml water in US terms.',
    measures: { 'Thai red curry paste': '4 tbsp', 'vegetable stock cube': '2', 'coconut milk': '2 cans (13.5 oz)', 'fish sauce': '4 tsp', 'rice noodles': '8 oz', lime: '3', 'king prawns': '12 oz', coriander: '1 small bunch' },
    instructions: [
      'Heat the oil in a large pot, add the sliced chile and cook 1 minute. Add the curry paste and cook 1 minute more.',
      'Dissolve the bouillon cubes in 6 cups boiling water, pour into the pot and add the coconut milk. Bring to a boil.',
      'Add the fish sauce and the noodles and cook 3–4 minutes until softening.',
      'Squeeze in the juice of 2 limes, add the shrimp and cook 2–3 minutes, until pink and opaque.',
      'Serve in bowls topped with cilantro and lime wedges.',
    ].join('\n'),
    prepMinutes: 10, cookMinutes: 15,
  },
  'mealdb-52869': {
    note: 'Lentils are the cooked/pouch kind (never cooked in the steps); salt listed.',
    measures: { Lentils: '2 cups cooked' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }],
    prepMinutes: 10, cookMinutes: 12,
  },
  'mealdb-52884': {
    note: 'Kidneys (hard to find, kid-unfriendly) and "dripping" removed; oven °F; potato slicing and doneness cue.',
    removeIngredients: ['Lamb Kidney'],
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Heat the oven to 325°F. Cut the lamb into 1 1/2-inch pieces and season with salt and pepper.',
      'Melt a third of the butter in a large ovenproof pot and brown the lamb in batches. Lift onto a plate.',
      'Add a little more butter and fry the sliced onions and carrots until golden. Sprinkle over the flour and cook 2 minutes.',
      'Add the Worcestershire sauce and broth and bring to a boil. Stir in the lamb and bay leaves, then turn off the heat.',
      'Thinly slice the potatoes and layer them over the meat. Melt the remaining butter and brush some over the potatoes.',
      'Cover and bake for 1 1/2 hours, until the potatoes are tender when pierced.',
      'Uncover, brush the potatoes with the rest of the butter and broil 5–8 minutes until browned.',
    ].join('\n'),
    prepMinutes: 25, cookMinutes: 110,
  },
  'mealdb-53037': {
    note: 'Two chops for four people — scaled to 4; pork doneness temp; salt/pepper listed.',
    measures: { Butter: '1 tbs', 'Pork Chops': '4', Potatoes: '4', 'Chicken Stock': '1/2 cup', Cider: '1/2 cup' },
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    instructions: [
      'Season the pork chops. Heat the butter in a large heavy pot until sizzling and fry the chops 2–3 minutes per side until browned. Remove.',
      'Add the chopped bacon, carrot, potatoes and rutabaga and fry gently until lightly colored.',
      'Stir in the shredded cabbage, set the chops on top, add the bay leaf and pour over the cider and broth.',
      'Cover and simmer gently for 20 minutes, until the vegetables are tender and the chops read 145°F.',
      'Serve straight from the pot.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 30,
  },
  'mealdb-53106': {
    note: 'Oven °F; salt/pepper listed; bacon doneness cue kept.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }, { name: 'Black Pepper', measure: 'to taste' }],
    prepMinutes: 15, cookMinutes: 25,
    instructions: [
      'Heat the oven to 400°F. Snap the woody ends off the asparagus and lay the spears in one layer in a rimmed baking pan.',
      'Halve the tomatoes crosswise and nestle them in. Season with salt and pepper and drizzle with 1 tbsp olive oil.',
      'Roll each bacon slice up tightly, tuck the rolls into the pan and drizzle them with the honey. Bake 20 minutes, until the tomatoes are soft and the bacon is crisp.',
      'Meanwhile, boil the potatoes until tender when pierced, 15–20 minutes.',
      'Whisk the vinegar, remaining olive oil, mustard, salt and pepper. Toss the arugula in half the dressing and spread on a platter.',
      'Halve the potatoes, toss in the rest of the dressing and arrange on the platter with the asparagus, tomatoes and bacon.',
    ].join('\n'),
  },
  'mealdb-53147': {
    note: '150 ml water in US terms; salt listed.',
    addIngredients: [{ name: 'Salt', measure: 'to taste' }],
    instructions: [
      'Peel and devein most of the shrimp, keeping a few whole for the top if you like.',
      'Heat the oil in a large deep skillet over medium-low heat and fry the chopped onion for 5 minutes until soft. Add the bay leaf, saffron, rice and tomato paste and cook 1–2 minutes, stirring.',
      'Add the wine and bubble 1–2 minutes, then add the seafood stock and 2/3 cup water. Cook 5 minutes.',
      'Add the sliced squid, season with salt, bring to a boil, then cover and simmer gently for 12 minutes, adding a little water if it looks dry.',
      'Stir in the peeled shrimp and set any whole ones on top. Cover and simmer 5–6 minutes more, until the shrimp are pink and the rice is tender. Rest 2 minutes before serving.',
    ].join('\n'),
    prepMinutes: 15, cookMinutes: 30,
  },
};
