import { useEffect, useState, useRef } from 'react';
import { cursors, getRandomColor, type CursorState } from './store';

function Cursor({ cursor }: { cursor: CursorState }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: cursor.x - 6,
        top: cursor.y - 6,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: cursor.color,
        border: '2px solid white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
      title={`Tab ${cursor.tabId.slice(0, 8)}`}
    />
  );
}

export default function App() {
  const [items, setItems] = useState<CursorState[]>([]);
  const [myColor] = useState(getRandomColor);
  const [tabId] = useState(() => Math.random().toString(36).slice(2, 8));
  const rafRef = useRef<number>(0);
  const pendingPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    cursors.add({ x: window.innerWidth / 2, y: window.innerHeight / 2, color: myColor, tabId });

    const unsub = cursors.subscribe((newItems) => {
      setItems(newItems);
    });

    setItems(cursors.toArray());

    const handleMouseMove = (e: MouseEvent) => {
      pendingPos.current = { x: e.clientX, y: e.clientY };

      // Throttle: only update store at ~30fps via rAF
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          if (pendingPos.current) {
            cursors.update(
              (item) => item.tabId === tabId,
              () => ({ ...pendingPos.current!, color: myColor, tabId }),
            );
            pendingPos.current = null;
          }
          rafRef.current = 0;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cursors.remove((item) => item.tabId === tabId);
      unsub();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [myColor, tabId]);

  return (
    <div style={{ height: '100vh', overflow: 'hidden', cursor: 'none' }}>
      <div style={{
        position: 'fixed',
        top: 16,
        left: 16,
        background: 'rgba(255,255,255,0.9)',
        padding: '8px 16px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: 1001,
        fontFamily: 'system-ui, sans-serif',
      }}>
        <h1 style={{ margin: 0, fontSize: 16 }}>🖱️ Multiplayer Cursor</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
          Move your mouse — {items.length} cursor{items.length !== 1 ? 's' : ''} visible
        </p>
      </div>

      {items.map((cursor) => (
        <Cursor key={cursor.tabId} cursor={cursor} />
      ))}
    </div>
  );
}
