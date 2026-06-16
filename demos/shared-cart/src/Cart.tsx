import { useSharedStore } from 'tabcoord-react';
import store, { removeItem, updateQuantity, type CartItem } from './store';

function CartItemRow({ item }: { item: CartItem }) {
  return (
    <tr>
      <td>{item.name}</td>
      <td>${item.price.toFixed(2)}</td>
      <td>
        <button onClick={() => updateQuantity(item.id, -1)}>-</button>
        <span>{item.quantity}</span>
        <button onClick={() => updateQuantity(item.id, 1)}>+</button>
      </td>
      <td>${(item.price * item.quantity).toFixed(2)}</td>
      <td>
        <button onClick={() => removeItem(item.id)}>Ã—</button>
      </td>
    </tr>
  );
}

export default function Cart() {
  const items = useSharedStore(store, (s) => s.items);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (items.length === 0) {
    return <p>Cart is empty. Add items below.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Price</th>
          <th>Qty</th>
          <th>Subtotal</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <CartItemRow key={item.id} item={item} />
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3}>Total</td>
          <td>${total.toFixed(2)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  );
}
