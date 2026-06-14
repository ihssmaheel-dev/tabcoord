import Cart from './Cart';
import AddToCart from './AddToCart';
import Info from './Info';

export default function App() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h1>🛒 Shared Cart</h1>
      <Info />
      <Cart />
      <AddToCart />
    </div>
  );
}
