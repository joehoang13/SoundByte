// Prefer /api (Vite proxy). If explicit URL/PORT are set, use them.
const DEFAULT_BASE = '/api';
const BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_PORT
    ? `${import.meta.env.VITE_API_URL}:${import.meta.env.VITE_API_PORT}/api`
    : DEFAULT_BASE);

function getToken(): string | undefined {
  try {
    return localStorage.getItem('sb_token') || undefined;
  } catch {
    return undefined;
  }
}

function setAuth(token?: string, user?: any) {
  try {
    if (token) localStorage.setItem('sb_token', token);
    else localStorage.removeItem('sb_token');
    if (user) localStorage.setItem('sb_user', JSON.stringify(user));
    else localStorage.removeItem('sb_user');
  } catch {}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as any),
  };
  const t = getToken();
  if (t && !headers['Authorization']) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const txt = await res.text().catch(() => '');
  const data = txt ? safeJson(txt) : null;
  if (res.status === 401) {
    setAuth(undefined, undefined);
    throw new Error((data && (data.error || data.message)) || 'Unauthorized');
  }
  if (!res.ok) {
    throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
  }
  return data as T;
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return { raw: s };
  }
}

export type AuthUser = { id: string; email: string; username?: string };
export type AuthResponse = { token: string; user: AuthUser };

export async function registerUser(payload: {
  email: string;
  password: string;
  username?: string;
}) {
  const resp = await request<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setAuth(resp.token, resp.user);
  return resp;
}

export async function loginUser(payload: { email?: string; username?: string; password: string }) {
  const email = payload.email ?? payload.username;
  if (!email) throw new Error('email is required');
  const resp = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: payload.password }),
  });
  setAuth(resp.token, resp.user);
  return resp;
}

export async function me() {
  return request<AuthUser>('/auth/me', { method: 'GET' });
}
export function logout() {
  setAuth(undefined, undefined);
}
export { BASE as API_BASE_URL };
