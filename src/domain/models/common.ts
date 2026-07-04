/** Shared enums and unions used across the domain. */

export type Cuisine =
  | 'Italian'
  | 'Mexican'
  | 'Greek'
  | 'Indian'
  | 'Thai'
  | 'Japanese'
  | 'Chinese'
  | 'French'
  | 'Mediterranean'
  | 'American'
  | 'MiddleEastern'
  | 'BBQ'
  /** Catch-all for imported dishes whose real cuisine (Polish, Norwegian,
   * Russian, etc.) doesn't fit any bucket above — honest labeling instead of
   * silently folding them into American, which was skewing swap/variety
   * toward an artificially large "American" pool (see normalize.ts). */
  | 'Other';

export type Category =
  | 'ComfortFood'
  | 'Healthy'
  | 'LowCarb'
  | 'HighProtein'
  | 'Seafood'
  | 'Vegetarian'
  | 'SlowCooker'
  | 'Grilling'
  | 'SheetPan'
  | 'OnePot'
  | 'Pasta'
  | 'RiceBowls'
  | 'Soups'
  | 'Stews'
  | 'Sandwiches'
  | 'Salads'
  | 'BreakfastForDinner'
  | 'SeasonalSpecial';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type SpiceLevel = 'None' | 'Mild' | 'Medium' | 'Hot';

export type Department =
  | 'Produce'
  | 'Meat'
  | 'Seafood'
  | 'Bakery'
  | 'Frozen'
  | 'Dairy'
  | 'DryGoods'
  | 'International'
  | 'Spices'
  | 'Household';

export type Unit =
  | 'g'
  | 'kg'
  | 'oz'
  | 'lb'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'clove'
  | 'can'
  | 'bunch'
  | 'piece'
  | 'pinch';

export type Protein =
  | 'Chicken'
  | 'Beef'
  | 'Pork'
  | 'Fish'
  | 'Shellfish'
  | 'Turkey'
  | 'Lamb'
  | 'Tofu'
  | 'Beans'
  | 'Lentils'
  | 'Eggs'
  | 'None';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';
