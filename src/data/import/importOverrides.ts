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
};
