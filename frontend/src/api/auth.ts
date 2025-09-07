import { AUTH_BASE, json, withAuth, setToken } from './base';
import { useAuth } from '../stores/auth';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}
export interface LoginResp {
  token?: string;
  user?: AuthUser;
}

export async function logout() {
  const token = useAuth.getState().token;
  try {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (err) {
    console.warn('Logout failed:', err);
  } finally {
    useAuth.getState().clear();
  }
}

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await fetch(
      `${AUTH_BASE}/login`,
      withAuth({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    );
    const data = await json<LoginResp>(res);
    if (data?.token) setToken(data.token);
    return data;
  },
  me: async () => {
    const res = await fetch(`${AUTH_BASE}/me`, withAuth());
    if (res.status === 401) return null;
    return json<AuthUser>(res);
  },
  logout: async () => {
    try {
      await fetch(`${AUTH_BASE}/logout`, withAuth({ method: 'POST' }));
    } catch {}
    setToken(null);
    return true;
  },
};
