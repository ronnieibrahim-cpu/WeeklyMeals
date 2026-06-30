import { Department, Unit } from '@/domain/models';

export interface PricedProduct {
  productName: string;
  price: number; // USD, already accounting for the needed quantity
}

/**
 * Abstraction over a grocery store's catalog + pricing. v1 ships HebProvider;
 * Costco/Kroger/Instacart/etc. implement the same interface later, and ordering
 * hooks can be added without breaking callers.
 */
export interface GroceryProvider {
  readonly name: string;
  readonly departmentOrder: Department[];
  priceFor(ingredientName: string, quantity: number, unit: Unit, department: Department): PricedProduct;
}
