import { ShoppingList } from '@/domain/models';

/** Persistence boundary for the current shopping list (incl. checked state). */
export interface ShoppingListRepository {
  load(): Promise<ShoppingList | null>;
  save(list: ShoppingList): Promise<void>;
  clear(): Promise<void>;
}
