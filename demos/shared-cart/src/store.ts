import { createSharedStore } from '@tabcoord/core';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
}

const store = createSharedStore<CartState>({
  name: 'shared-cart',
  initial: { items: [] },
  persist: { version: 1 },
});

export function addItem(name: string, price: number): void {
  store.set((prev) => {
    const existing = prev.items.find((i) => i.name === name);
    if (existing) {
      return {
        items: prev.items.map((i) =>
          i.name === name ? { ...i, quantity: i.quantity + 1 } : i,
        ),
      };
    }
    return {
      items: [
        ...prev.items,
        { id: crypto.randomUUID(), name, price, quantity: 1 },
      ],
    };
  });
}

export function removeItem(id: string): void {
  store.set((prev) => ({
    items: prev.items.filter((i) => i.id !== id),
  }));
}

export function updateQuantity(id: string, delta: number): void {
  store.set((prev) => ({
    items: prev.items
      .map((i) =>
        i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
      )
      .filter((i) => i.quantity > 0),
  }));
}

export default store;
