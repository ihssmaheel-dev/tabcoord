import { useEffect, useState, useCallback } from 'react';
import { useSharedStore } from '@tabcoord/react';
import { cursors, getRandomColor, type CursorState } from './store';

function Cursor({ cursor }: { cursor: CursorState }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: cursor.x,
        top: cursor.y,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: cursor.color,
        border: '2px solid white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
        transition: 'left 0.05s, top 0.05s',
        zIndex: 1000,
      }}
      title={`Tab ${cursor.tabId.slice(0, 8)}`}
    />
  );
}

export default function App() {
  const items = useSharedStore({ get: () => cursors.toArray(), subscribe: (fn) => cursors.subscribe(fn), destroy: () => {} } as any, (s) => s);
  const [myColor] = useState(getRandomColor);
  const [tabId] = useState(() => Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    // Add this tab's cursor
    cursors.add({ x: window.innerWidth / 2, y: window.innerHeight / 2, color: myColor, tabId });

    const handleMouseMove = (e: MouseEvent) => {
      cursors.update(
        (item) => item.tabId === tabId,
        () => ({ x: e.clientX, y: e.clientY, color: myColor, tabId }),
      );
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cursors.remove((item) => item.tabId === tabId);
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
