import { Department } from '../models';

/** Fixed shopping-list order, matching a typical H-E-B store walk (PRD §6.3). */
export const DEPARTMENT_ORDER: Department[] = [
  'Produce',
  'Meat',
  'Seafood',
  'Bakery',
  'Frozen',
  'Dairy',
  'DryGoods',
  'International',
  'Spices',
  'Household',
];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  Produce: 'Produce',
  Meat: 'Meat',
  Seafood: 'Seafood',
  Bakery: 'Bakery',
  Frozen: 'Frozen',
  Dairy: 'Dairy',
  DryGoods: 'Dry Goods',
  International: 'International',
  Spices: 'Spices',
  Household: 'Household',
};
