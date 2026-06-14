import { useSharedStore } from '@tabcoord/react';
import store, { login, logout } from './store';

export default function Auth() {
  const user = useSharedStore(store, (s) => s.user);
  const loginCount = useSharedStore(store, (s) => s.loginCount);

  if (user) {
    return (
      <div>
        <h2>Welcome, {user.name}!</h2>
        <p>
          Role: <strong>{user.role}</strong> &middot; Email: {user.email}
        </p>
        <p>Total logins across tabs: {loginCount}</p>
        <p style={{ color: '#666', fontSize: '0.85em' }}>
          You are also logged in on other tabs. Logging out here will log out
          everywhere.
        </p>
        <button onClick={logout}>Logout</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Login</h2>
      <LoginForm />
    </div>
  );
}

function LoginForm() {
  function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = data.get('name') as string;
    const email = data.get('email') as string;
    const role = data.get('role') as 'admin' | 'user';
    login(name || 'Guest', email || 'guest@example.com', role || 'user');
  }

  return (
    <form onSubmit={handleLogin}>
      <div>
        <label>Name <input name="name" defaultValue="Alice" /></label>
      </div>
      <div>
        <label>Email <input name="email" type="email" defaultValue="alice@example.com" /></label>
      </div>
      <div>
        <label>
          Role{' '}
          <select name="role" defaultValue="user">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>
      <button type="submit">Login</button>
    </form>
  );
}
