import { useState } from 'react';
import { addItem } from './store';

const SUGGESTED = [
  { name: 'Coffee', price: 4.99 },
  { name: 'Bagel', price: 2.49 },
  { name: 'Sandwich', price: 8.99 },
  { name: 'Cookie', price: 1.99 },
  { name: 'Smoothie', price: 5.49 },
];

export default function AddToCart() {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !price) return;
    addItem(name, parseFloat(price));
    setName('');
    setPrice('');
  }

  return (
    <div>
      <h3>Suggested Items</h3>
      {SUGGESTED.map((item) => (
        <button
          key={item.name}
          onClick={() => addItem(item.name, item.price)}
        >
          {item.name} (${item.price})
        </button>
      ))}
      <hr />
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
    </div>
  );
}
