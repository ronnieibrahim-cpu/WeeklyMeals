import { Department, Unit } from './common';

export interface ShoppingItem {
  ingredientName: string;
  quantity: number;
  unit: Unit;
  department: Department;
  hebProductName?: string;
  estimatedPrice: number; // USD
  checked: boolean;
  checkedAtISO?: string | null; // when this device last toggled `checked` (sync merge key)
  fromRecipeIds: string[]; // provenance, for edits/regeneration
}

export interface ShoppingList {
  planId: string;
  items: ShoppingItem[]; // grouped by department in the UI
  estimatedTotal: number;
  costPerServing: number;
  generatedAtISO: string;
}
