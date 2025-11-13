export const TOKEN_KEYS = ['sb_token', 'token', 'auth_token'] as const;

export function getToken(): string | null {
  try {
    for (const k of TOKEN_KEYS) {
      const v = localStorage.getItem(k);
      if (v) return v;
    }
  } catch {}
  return null;
}

export function setToken(t?: string | null) {
  try {
    if (!t) {
      TOKEN_KEYS.forEach(k => localStorage.removeItem(k));
      return;
    }
    localStorage.setItem('sb_token', t);
  } catch {}
}

const rawBase = import.meta.env.VITE_API_BASE as string | undefined; // e.g. '/api'
const rawUrl = import.meta.env.VITE_API_URL as string | undefined; // e.g. 'http://localhost:3001' or 'http://localhost:3001/api'
const rawPort = import.meta.env.VITE_API_PORT as string | undefined; // e.g. '3001'

function computeBase() {
  if (rawBase) return rawBase.replace(/\/$/, '');
  if (rawUrl) {
    const u = rawUrl.replace(/\/$/, '');
    return u.endsWith('/api') ? u : `${u}/api`;
  }
  if (rawPort) return `http://localhost:${rawPort}/api`;
  return '/api';
}

export const API_BASE = computeBase();
export const AUTH_BASE = `${API_BASE}/auth`;
export const GS_BASE = `${API_BASE}/gs`;
export const QUESTIONS_BASE = `${API_BASE}/questions`;

export async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data as T;
}

export function withAuth(init?: RequestInit): RequestInit {
  const hdrs: Record<string, string> = { ...(init?.headers as any) };
  const tok = getToken();
  if (tok) hdrs['Authorization'] = `Bearer ${tok}`; // why: backend JWT auth
  return { credentials: 'include', ...init, headers: hdrs };
}
