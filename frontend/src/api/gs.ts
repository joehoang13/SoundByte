// frontend/src/api/gs.ts
import type { StartPayload, StartResp, GuessResp, NextResp, FinishResp } from '../types/game';
import { GS_BASE, json, withAuth } from './base';

const DEFAULT_TIMEOUT = 12_000; // guard against 'pending forever'

async function post<T>(path: string, body?: any, timeoutMs = DEFAULT_TIMEOUT): Promise<T> {
  const url = `${GS_BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    // Abort with a DOMException('AbortError') so it's easy to detect
    ctrl.abort(new DOMException('timeout', 'AbortError'));
  }, timeoutMs);

  try {
    // debug: see the exact URL + payload
    // eslint-disable-next-line no-console
    console.debug('[gsApi] POST', url, body);

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

    // eslint-disable-next-line no-console
    console.debug('[gsApi] status', res.status, url);
    return json<T>(res);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[gsApi] POST failed', url, err);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const gsApi = {
  start: (payload: StartPayload) => post<StartResp>('/game/start', payload),
  setStarted: (sessionId: string, roundIndex: number) =>
    post<{ ok: true }>(`/game/${sessionId}/round/started`, { roundIndex }),
  guess: (sessionId: string, roundIndex: number, guess: string) =>
    post<GuessResp>(`/game/${sessionId}/guess`, { roundIndex, guess }),
  next: (sessionId: string) => post<NextResp>(`/game/${sessionId}/next`),
  finish: (sessionId: string) => post<FinishResp>(`/game/${sessionId}/finish`),
};
