import { DEPARTMENT_ORDER } from '@/domain/constants';
import { Department, Unit } from '@/domain/models';

import { GroceryProvider, PricedProduct } from '../GroceryProvider';
import { HEB_PRICE_TABLE } from './hebPriceTable';

const round = (n: number) => Math.round(n * 100) / 100;
const normalize = (s: string) => s.trim().toLowerCase();

/** Flat fallback price per department when an ingredient isn't in the table. */
const DEPARTMENT_DEFAULT: Record<Department, number> = {
  Produce: 1.99,
  Meat: 6.99,
  Seafood: 9.49,
  Bakery: 2.99,
  Frozen: 2.99,
  Dairy: 3.99,
  DryGoods: 1.99,
  International: 3.49,
  Spices: 3.99,
  Household: 4.99,
};

function toPounds(quantity: number, unit: Unit): number {
  if (unit === 'lb') return quantity;
  if (unit === 'oz') return quantity / 16;
  // Metric weights/volumes (common in imported recipes) — convert so per-lb
  // pricing stays sane instead of treating "400 g" as 400 lb. Volume is
  // approximated at water density, which is close enough for a cost estimate.
  if (unit === 'g' || unit === 'ml') return quantity / 453.6;
  if (unit === 'kg' || unit === 'l') return quantity * 2.205;
  return quantity; // count-based; treated as 1 "unit" for weight scaling
}

export class HebProvider implements GroceryProvider {
  readonly name = 'H-E-B';
  readonly departmentOrder = DEPARTMENT_ORDER;

  priceFor(ingredientName: string, quantity: number, unit: Unit, department: Department): PricedProduct {
    const key = normalize(ingredientName);
    const entry =
      HEB_PRICE_TABLE[key] ??
      Object.entries(HEB_PRICE_TABLE).find(
        ([name]) => key.includes(name) || name.includes(key),
      )?.[1];

    if (entry) {
      const price = entry.perLb
        ? round(entry.price * Math.max(toPounds(quantity, unit), 0.25))
        : entry.price;
      return { productName: entry.productName, price };
    }

    // Fallback by department.
    const base = DEPARTMENT_DEFAULT[department];
    const price =
      unit === 'lb' || unit === 'oz' ? round(base * Math.max(toPounds(quantity, unit), 0.25)) : base;
    return { productName: ingredientName, price };
  }
}

export const hebProvider = new HebProvider();
