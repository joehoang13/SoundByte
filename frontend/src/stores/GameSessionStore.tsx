import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReactNode } from 'react';
import { gsApi } from '../api/gs';
import type { Difficulty, SnippetSize, GuessResp, FinishResp } from '../types/game';

interface LastResult {
  correct: boolean;
  concluded: boolean;
  attempts: number;
  attemptsLeft: number;
  timeMs?: number;
}
interface RoundMeta {
  snippetId: string;
  audioUrl: string;
}

interface SongResult {
  snippetId: string;
  songTitle: string;
  artistName: string;
  correct: boolean;
  timeMs?: number;
  userGuess?: string;
}

interface GameState {
  mode: 'classic' | 'inference' | 'multiplayer';
  difficulty: Difficulty;
  snippetSize: SnippetSize;
  rounds: number;
  sessionId?: string;
  currentRound: number;
  current?: RoundMeta;
  score: number;
  streak: number;
  correctAnswers: number;
  fastestTimeMs?: number;
  fastestTime: number;
  timeBonus: number;
  timeBonusTotal?: number;
  attemptsLeft?: number;
  lastResult?: LastResult;
  songResults: SongResult[];
  loading: boolean;
  starting: boolean; // <— NEW: in-flight guard
  error?: string;
  setConfig: (
    p: Partial<Pick<GameState, 'mode' | 'difficulty' | 'snippetSize' | 'rounds'>>
  ) => void;
  start: (userId?: string) => Promise<void>;
  markRoundStarted: () => Promise<void>;
  submitGuess: (guess: string) => Promise<LastResult | undefined>;
  next: () => Promise<void>;
  finish: () => Promise<FinishResp | undefined>;
  reset: () => void;
  setScore: (n: number) => void;
  setStreak: (n: number) => void;
  setCorrectAnswers: (n: number) => void;
  setTimeBonus: (n: number) => void;
}

export const useGameStore = create<GameState>()(
  (set, get) => ({
    mode: 'classic',
    difficulty: 'easy',
    snippetSize: 5,
    rounds: 10,
    sessionId: undefined,
    currentRound: 0,
    current: undefined,
    score: 0,
    streak: 0,
    correctAnswers: 0,
    fastestTimeMs: undefined,
    fastestTime: Infinity,
    timeBonus: 0,
    timeBonusTotal: 0,
    attemptsLeft: undefined,
    lastResult: undefined,
    songResults: [],
    loading: false,
    starting: false,

    setConfig: p => set(s => ({ ...s, ...p })),

    // Idempotent start: ignore if already starting or session exists
    start: async (userId?: string) => {
      const { difficulty, snippetSize, rounds, starting, sessionId } = get();
      if (starting || sessionId) return; // prevents duplicate calls from StrictMode
      set({
        starting: true,
        loading: true,
        error: undefined,
        lastResult: undefined,
        attemptsLeft: undefined,
        songResults: [],
      });
      try {
        const data = await gsApi.start({ userId: userId ?? '', difficulty, snippetSize, rounds });
        set({
          sessionId: data.sessionId,
          currentRound: data.roundIndex,
          rounds: data.rounds,
          current: { snippetId: data.round.snippetId, audioUrl: data.round.audioUrl },
          score: 0,
          streak: 0,
          correctAnswers: 0,
          fastestTimeMs: undefined,
          fastestTime: Infinity,
          timeBonus: 0,
          timeBonusTotal: 0,
          loading: false,
          starting: false,
        });
      } catch (e: any) {
        set({ error: e?.message || 'Failed to start game', loading: false, starting: false });
      }
    },

    markRoundStarted: async () => {
      const { sessionId, currentRound } = get();
      if (!sessionId) return;
      try {
        await gsApi.setStarted(sessionId, currentRound);
      } catch { }
    },

    submitGuess: async (guess: string) => {
      const { sessionId, currentRound } = get();
      if (!sessionId) return;
      try {
        const r: GuessResp = await gsApi.guess(sessionId, currentRound, guess);
        set(s => ({
          score: r.score,
          streak: r.streak,
          correctAnswers: s.correctAnswers + (r.correct ? 1 : 0),
          timeBonus: s.timeBonus + (r.breakdown?.timeBonus || 0),
          timeBonusTotal: (s.timeBonusTotal ?? 0) + (r.breakdown?.timeBonus || 0),
          fastestTimeMs: r.correct
            ? s.fastestTimeMs === undefined || r.timeMs < s.fastestTimeMs
              ? r.timeMs
              : s.fastestTimeMs
            : s.fastestTimeMs,
          fastestTime: r.correct
            ? s.fastestTime === Infinity || r.timeMs / 1000 < s.fastestTime
              ? Math.round((r.timeMs / 1000) * 10) / 10
              : s.fastestTime
            : s.fastestTime,
          attemptsLeft: r.attemptsLeft,
          lastResult: {
            correct: r.correct,
            concluded: r.concluded,
            attempts: r.attempts,
            attemptsLeft: r.attemptsLeft,
            timeMs: r.timeMs,
          },
        }));
        return get().lastResult;
      } catch (e: any) {
        set({ error: e?.message || 'Failed to submit guess' });
      }
    },

    next: async () => {
      const { sessionId } = get();
      if (!sessionId) return;
      try {
        const n = await gsApi.next(sessionId);
        set({
          currentRound: n.roundIndex,
          current: { snippetId: n.round.snippetId, audioUrl: n.round.audioUrl },
          attemptsLeft: undefined,
          lastResult: undefined,
        });
      } catch (e: any) {
        set({ error: e?.message || 'No more rounds' });
      }
    },

    finish: async () => {
      const { sessionId } = get();
      if (!sessionId) return;
      try {
        console.log('🎯 Calling finish API...');
        const f = await gsApi.finish(sessionId);
        console.log('📦 Finish response:', f);

        const songResults = f.answers.map(ans => ({
          snippetId: ans.snippetId,
          songTitle: ans.title || 'Unknown Song',
          artistName: ans.artist || 'Unknown Artist',
          correct: ans.correct || false,
          timeMs: ans.timeMs,
          userGuess: undefined, // could be added later
        }));

        console.log('🎵 Mapped song results:', songResults);

        set(s => ({
          score: f.score,
          streak: f.streak,
          fastestTimeMs: f.fastestTimeMs ?? s.fastestTimeMs, // only update if we got a new value
          fastestTime:
            f.fastestTimeMs !== undefined
              ? Math.round((f.fastestTimeMs / 1000) * 10) / 10
              : s.fastestTime,
          timeBonusTotal: f.timeBonusTotal ?? s.timeBonusTotal,
          songResults,
        }));

        console.log('✅ Store updated, songResults:', get().songResults);
        return f;
      } catch (e: any) {
        set({ error: e?.message || 'Failed to finish game' });
      }
    },

    reset: () =>
      set({
        sessionId: undefined,
        currentRound: 0,
        current: undefined,
        score: 0,
        streak: 0,
        correctAnswers: 0,
        fastestTimeMs: undefined,
        fastestTime: Infinity,
        timeBonus: 0,
        timeBonusTotal: 0,
        attemptsLeft: undefined,
        lastResult: undefined,
        songResults: [],
        error: undefined,
        loading: false,
        starting: false,
      }),

    setScore: (n: number) => set({ score: n }),
    setStreak: (n: number) => set({ streak: n }),
    setCorrectAnswers: (n: number) => set({ correctAnswers: n }),
    setTimeBonus: (n: number) => set({ timeBonus: n }),
  }),
)

export default useGameStore;
export function GameProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
