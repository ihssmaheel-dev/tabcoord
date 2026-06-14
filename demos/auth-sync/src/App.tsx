import Auth from './Auth';
import Info from './Info';

export default function App() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h1>🔐 Auth Sync</h1>
      <Info />
      <Auth />
    </div>
  );
}
