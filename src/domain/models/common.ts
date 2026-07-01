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
  | 'BBQ';

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
