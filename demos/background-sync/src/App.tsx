import { useSharedStore } from '@tabcoord/react';
import { syncStore, election, startPolling, stopPolling } from './store';
import { useEffect } from 'react';

function LeaderBadge() {
  const isLeader = useSharedStore(
    { get: () => election.isLeader, subscribe: () => () => {}, destroy: () => {} } as any,
    (s) => s,
  );

  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 4,
      background: isLeader ? '#22c55e' : '#94a3b8',
      color: 'white',
      fontSize: 12,
      fontWeight: 600,
    }}>
      {isLeader ? 'LEADER' : 'FOLLOWER'}
    </span>
  );
}

export default function App() {
  const { lastFetch, data, fetchCount } = useSharedStore(syncStore, (s) => s);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h1>🔄 Background Sync</h1>
      <p style={{ color: '#64748b' }}>
        Only the leader tab polls. Open multiple tabs to see leader election.
      </p>

      <div style={{ marginBottom: 16 }}>
        <LeaderBadge />
        <span style={{ marginLeft: 8, color: '#64748b' }}>
          Tab ID: {syncStore.get ? 'active' : 'loading'}
        </span>
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#64748b' }}>Last fetch</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{lastFetch || 'Never'}</div>
        <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
          Total fetches: {fetchCount}
        </div>
      </div>

      <h3>Recent Updates</h3>
      {data.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>No data yet. Waiting for leader to poll...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {data.map((item, i) => (
            <li key={i} style={{
              padding: '8px 12px',
              background: '#f1f5f9',
              borderRadius: 4,
              marginBottom: 4,
              fontSize: 14,
            }}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
