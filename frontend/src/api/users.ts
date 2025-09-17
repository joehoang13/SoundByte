import { API_BASE, json, withAuth } from './base';
import type { UserStats } from '../types/users';


export async function getUserStats(): Promise<UserStats> {
  const res = await fetch(`${API_BASE}/users/me`, withAuth());
  return json<UserStats>(res);
}
