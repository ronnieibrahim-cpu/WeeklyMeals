import { ShoppingList } from '@/domain/models';

import { ShoppingListRepository } from '../ShoppingListRepository';
import { kvStore } from './kvStore';
import { isShoppingList } from './shapeGuards';

const KEY = 'wm:shoppingList:v1';

export class LocalShoppingListRepository implements ShoppingListRepository {
  load(): Promise<ShoppingList | null> {
    return kvStore.getJSON<ShoppingList>(KEY, isShoppingList);
  }

  save(list: ShoppingList): Promise<void> {
    return kvStore.setJSON(KEY, list);
  }

  clear(): Promise<void> {
    return kvStore.remove(KEY);
  }
}

export const localShoppingListRepository = new LocalShoppingListRepository();
