/**
 * Curated per-recipe photo URLs, keyed by recipe id. Loaded by the app at
 * runtime (the user's device is not behind the dev network policy), so these
 * can point at any public, appropriately-licensed source.
 *
 * Populated in stages, matched by hand against the dish (not just cuisine).
 * Anything without an entry here falls back to its clean per-cuisine tile, so
 * this map can stay partial indefinitely without looking broken.
 *
 * Stage 1 (this batch): TheMealDB custom artwork for well-known classics that
 * are a genuine, protein-accurate match — free tier, personal/web use, credit
 * given in Settings. Deliberately excluded a bunch of same-family candidates
 * (e.g. lamb/tofu/cauliflower "shawarma" or "mapo tofu" variants) where the
 * only available photo showed a different protein than the recipe calls for.
 * Stage 2 will fill remaining gaps from Wikimedia Commons (CC/PD).
 */
export const RECIPE_IMAGE_URLS: Record<string, string> = {
  'cn-kung-pao-chicken': 'https://www.themealdb.com/images/media/meals/1525872624.jpg',
  'fr-ratatouille': 'https://www.themealdb.com/images/media/meals/wrpwuu1511786491.jpg',
  'in-tandoori-chicken': 'https://www.themealdb.com/images/media/meals/qptpvt1487339892.jpg',
  'cn-chicken-fried-rice': 'https://www.themealdb.com/images/media/meals/wuyd2h1765655837.jpg',
  'me-shakshuka': 'https://www.themealdb.com/images/media/meals/g373701551450225.jpg',
  'it-spaghetti-bolognese': 'https://www.themealdb.com/images/media/meals/sutysw1468247559.jpg',
  'th-tom-kha-gai': 'https://www.themealdb.com/images/media/meals/ol2xxt1763582263.jpg',
  'th-drunken-noodles': 'https://www.themealdb.com/images/media/meals/2wx8cm1763373419.jpg',
  'fr-coq-au-vin': 'https://www.themealdb.com/images/media/meals/qstyvs1505931190.jpg',
  'cn-egg-foo-young': 'https://www.themealdb.com/images/media/meals/47y6ii1765658818.jpg',
  'fr-beef-bourguignon': 'https://www.themealdb.com/images/media/meals/vtqxtu1511784197.jpg',
  'th-pad-see-ew': 'https://www.themealdb.com/images/media/meals/uuuspp1468263334.jpg',
  'fr-onion-soup': 'https://www.themealdb.com/images/media/meals/xvrrux1511783685.jpg',
  'jp-chicken-karaage': 'https://www.themealdb.com/images/media/meals/tyywsw1505930373.jpg',
  'cn-beef-broccoli': 'https://www.themealdb.com/images/media/meals/m0p0j81765568742.jpg',
  'cn-sweet-sour-pork': 'https://www.themealdb.com/images/media/meals/1529442316.jpg',
  'cn-hot-sour-soup': 'https://www.themealdb.com/images/media/meals/1529445893.jpg',
  'jp-pork-tonkatsu': 'https://www.themealdb.com/images/media/meals/lwsnkl1604181187.jpg',
  'th-thai-fried-rice': 'https://www.themealdb.com/images/media/meals/wuyd2h1765655837.jpg',
  'in-rajma': 'https://www.themealdb.com/images/media/meals/sywrsu1511463066.jpg',
  'th-green-curry-chicken': 'https://www.themealdb.com/images/media/meals/sstssx1487349585.jpg',
  'cn-orange-chicken': 'https://www.themealdb.com/images/media/meals/s73ytv1765567838.jpg',
  'me-lamb-tagine': 'https://www.themealdb.com/images/media/meals/yuwtuu1511295751.jpg',
  'th-pad-thai-shrimp': 'https://www.themealdb.com/images/media/meals/rg9ze01763479093.jpg',
  'jp-yaki-udon': 'https://www.themealdb.com/images/media/meals/wrustq1511475474.jpg',
  'gr-lamb-moussaka': 'https://www.themealdb.com/images/media/meals/ctg8jd1585563097.jpg',
  'gr-gigantes': 'https://www.themealdb.com/images/media/meals/b79r6f1585566277.jpg',
  'cn-general-tso': 'https://www.themealdb.com/images/media/meals/1529444113.jpg',
  'me-chicken-shawarma': 'https://www.themealdb.com/images/media/meals/hcg6l91763596970.jpg',
  'me-beef-shawarma-plate': 'https://www.themealdb.com/images/media/meals/swo87v1763595282.jpg',
};
