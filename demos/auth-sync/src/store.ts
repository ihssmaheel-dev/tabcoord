import { createSharedStore } from '@tabcoord/core';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface AuthState {
  user: User | null;
  loginCount: number;
}

const store = createSharedStore<AuthState>({
  name: 'auth-sync',
  initial: { user: null, loginCount: 0 },
  persist: { version: 1 },
});

export function login(name: string, email: string, role: 'admin' | 'user' = 'user'): void {
  store.set((prev) => ({
    user: { id: crypto.randomUUID(), name, email, role },
    loginCount: prev.loginCount + 1,
  }));
}

export function logout(): void {
  store.set({ user: null, loginCount: 0 });
}

export default store;
