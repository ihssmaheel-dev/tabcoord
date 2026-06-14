import { useSharedStore } from '@tabcoord/react';
import { formStore, type FormState } from './store';

function Field({ label, field }: { label: string; field: keyof FormState }) {
  const value = useSharedStore(formStore, (s) => s[field]);

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => formStore.set((prev) => ({ ...prev, [field]: e.target.value }))}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          fontSize: 14,
        }}
      />
    </div>
  );
}

export default function App() {
  const state = useSharedStore(formStore, (s) => s);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h1>📝 Distributed Form</h1>
      <p style={{ color: '#64748b' }}>
        Edit different fields in different tabs — field-level merge preserves concurrent edits.
      </p>

      <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <Field label="Name" field="name" />
        <Field label="Email" field="email" />
        <Field label="Message" field="message" />
      </div>

      <h3>Live State</h3>
      <pre style={{
        background: '#1e293b',
        color: '#e2e8f0',
        padding: 12,
        borderRadius: 6,
        fontSize: 13,
        overflow: 'auto',
      }}>
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  );
}
