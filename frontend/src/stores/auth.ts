import { create } from 'zustand';

export type AuthUser = { id: string; email: string; username?: string };
export type AuthState = {
  token?: string;
  user?: AuthUser;
  setAuth: (token: string, user: AuthUser) => void;
  clear: () => void;
};

function read<T>(k: string): T | undefined {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}

export const useAuth = create<AuthState>(set => ({
  // Initial values when the app starts up
  token:
    typeof localStorage !== 'undefined' ? localStorage.getItem('sb_token') || undefined : undefined,
  user: typeof localStorage !== 'undefined' ? read<AuthUser>('sb_user') : undefined,

  // Function to save login information
  setAuth: (token, user) => {
    try {
      localStorage.setItem('sb_token', token);
      localStorage.setItem('sb_user', JSON.stringify(user));
    } catch {}
    set({ token, user });
  },

  // Function to clear login information (logout)
  clear: () => {
    try {
      localStorage.removeItem('sb_token');
      localStorage.removeItem('sb_user');
    } catch {}
    set({ token: undefined, user: undefined });
  },
}));
