import { createStoreContext } from '@tabcoord/react';
import store, { addItem, type CartState } from './store';
import Cart from './Cart';
import AddToCart from './AddToCart';
import Info from './Info';

const { Provider } = createStoreContext<CartState>({
  name: 'shared-cart',
  initial: { items: [] },
  persist: { version: 1 },
});

export default function App() {
  return (
    <Provider>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
        <h1>🛒 Shared Cart</h1>
        <Info />
        <Cart />
        <AddToCart />
      </div>
    </Provider>
  );
}
