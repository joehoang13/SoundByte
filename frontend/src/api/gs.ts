// frontend/src/api/gs.ts
// Adds `correctSoFar` to ResumeResp
import type { StartPayload, StartResp, GuessResp, NextResp, FinishResp } from '../types/game';
import { GS_BASE, json, withAuth } from './base';

const DEFAULT_TIMEOUT = 12_000;

async function post<T>(path: string, body?: any, timeoutMs = DEFAULT_TIMEOUT): Promise<T> {
  const url = `${GS_BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'AbortError')), timeoutMs);
  try {
    const res = await fetch(
      url,
      withAuth({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
        mode: 'cors',
        cache: 'no-store',
      })
    );
    return json<T>(res);
  } finally {
    clearTimeout(timer);
  }
}

async function get<T>(path: string, timeoutMs = DEFAULT_TIMEOUT): Promise<T> {
  const url = `${GS_BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'AbortError')), timeoutMs);
  try {
    const res = await fetch(
      url,
      withAuth({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        mode: 'cors',
        cache: 'no-store',
      })
    );
    return json<T>(res);
  } finally {
    clearTimeout(timer);
  }
}

export type ResumeResp = {
  sessionId: string;
  roundIndex: number;
  rounds: number;
  round: { snippetId: string; audioUrl: string; title: string; artist: string } | null;
  score: number;
  streak: number;
  status: 'active' | 'completed';
  seq: number;
  updatedAt: string;
  correctSoFar: number; // NEW
};

export const gsApi = {
  start: (payload: StartPayload) => post<StartResp>('/game/start', payload),
  resume: (sessionId: string) => get<ResumeResp>(`/game/${sessionId}/resume`),
  setStarted: (sessionId: string, roundIndex: number) =>
    post<{ ok: true }>(`/game/${sessionId}/round/started`, { roundIndex }),
  guess: (sessionId: string, roundIndex: number, guess: string) =>
    post<GuessResp>(`/game/${sessionId}/guess`, { roundIndex, guess }),
  next: (sessionId: string) => post<NextResp>(`/game/${sessionId}/next`),
  finish: (sessionId: string) => post<FinishResp>(`/game/${sessionId}/finish`),
};
