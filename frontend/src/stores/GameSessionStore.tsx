// frontend/src/stores/GameSessionStore.tsx
// Persists `correctAnswers`; sets from resume.correctSoFar and recomputes on finish.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReactNode } from 'react';
import { gsApi } from '../api/gs';
import type { Difficulty, SnippetSize, GuessResp, FinishResp } from '../types/game';

export interface Placing { score: number; name: string; }

interface LastResult {
  correct: boolean;
  concluded: boolean;
  attempts: number;
  attemptsLeft: number;
  timeMs?: number;
}

export interface RoundMeta { snippetId: string; audioUrl: string; title: string; artist: string; }

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
  roomCode: string | null;
  multiplayerQuestions: RoundMeta[];
  setTimeBonusTotal: (n: number) => void;
  fastestTimeMs?: number;
  fastestTime: number;
  timeBonus: number;
  timeBonusTotal?: number;
  attemptsLeft?: number;
  lastResult?: LastResult;
  songResults: SongResult[];
  loading: boolean;
  starting: boolean;
  error?: string;
  leaderboard: Placing[];
  setConfig: (p: Partial<Pick<GameState, 'mode' | 'difficulty' | 'snippetSize' | 'rounds'>>) => void;
  start: (userId?: string) => Promise<void>;
  resume: () => Promise<void>;
  markRoundStarted: () => Promise<void>;
  submitGuess: (guess: string) => Promise<LastResult | undefined>;
  next: () => Promise<void>;
  finish: () => Promise<FinishResp | undefined>;
  reset: () => void;
  setScore: (n: number) => void;
  setStreak: (n: number) => void;
  setCorrectAnswers: (n: number) => void;
  setTimeBonus: (n: number) => void;
  setMultiplayerQuestions: (q: RoundMeta[]) => void;
  setRoomCode: (c: string) => void;
  setFastestTime: (n: number) => void;
  setLeaderboard: (l: Placing[]) => void;
}

const STORAGE_KEY = 'sb:sp:session';

export const useGameStore = create<GameState>()(
  persist(
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
      roomCode: null,
      multiplayerQuestions: [],
      leaderboard: [],
      setTimeBonusTotal: (n: number) => set({ timeBonusTotal: n }),

      setConfig: p => set(s => ({ ...s, ...p })),

      start: async (userId?: string) => {
        const { difficulty, snippetSize, rounds, starting, sessionId } = get();
        if (starting || sessionId) return;
        set({
          starting: true,
          loading: true,
          error: undefined,
          lastResult: undefined,
          attemptsLeft: undefined,
          songResults: [],
          correctAnswers: 0, // reset
        });
        try {
          const data = await gsApi.start({ userId: userId ?? '', difficulty, snippetSize, rounds });
          set({
            sessionId: data.sessionId,
            currentRound: data.roundIndex,
            rounds: data.rounds,
            current: {
              snippetId: data.round.snippetId,
              audioUrl: data.round.audioUrl,
              title: data.round.title,
              artist: data.round.artist,
            },
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

      // set correctAnswers based on server authoritative value
      resume: async () => {
        const { sessionId } = get();
        if (!sessionId) return;
        try {
          const r = await gsApi.resume(sessionId);
          if (!r.round) return;
          set(s => ({
            currentRound: r.roundIndex,
            rounds: r.rounds,
            current: {
              snippetId: r.round!.snippetId,
              audioUrl: r.round!.audioUrl,
              title: r.round!.title,
              artist: r.round!.artist,
            },
            score: r.score,
            streak: r.streak,
            correctAnswers: typeof r.correctSoFar === 'number' ? r.correctSoFar : s.correctAnswers,
          }));
        } catch (e: any) {
          set({ error: e?.message || 'Failed to resume game' });
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
            correctAnswers: s.correctAnswers + (r.correct ? 1 : 0), // keep tally live
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
            current: {
              snippetId: n.round.snippetId,
              audioUrl: n.round.audioUrl,
              title: n.round.title,
              artist: n.round.artist,
            },
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
          const f = await gsApi.finish(sessionId);

          const songResults = f.answers.map(ans => ({
            snippetId: ans.snippetId,
            songTitle: ans.title || 'Unknown Song',
            artistName: ans.artist || 'Unknown Artist',
            correct: ans.correct || false,
            timeMs: ans.timeMs,
            userGuess: undefined,
          }));

          // Recompute correct answers from authoritative finish payload
          const correctCount = f.answers.filter(a => a.correct).length;

          set(s => ({
            score: f.score,
            streak: f.streak,
            fastestTimeMs: f.fastestTimeMs ?? s.fastestTimeMs,
            fastestTime:
              f.fastestTimeMs !== undefined
                ? Math.round((f.fastestTimeMs / 1000) * 10) / 10
                : s.fastestTime,
            timeBonusTotal: f.timeBonusTotal ?? s.timeBonusTotal,
            songResults,
            correctAnswers: correctCount,
          }));

          return f;
        } catch (e: any) {
          set({ error: e?.message || 'Failed to finish game' });
        }
      },

      reset: () =>
        set(s => ({ 
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
          songResults: s.songResults, 
          loading: false,
          starting: false,
          roomCode: null,
          multiplayerQuestions: [],
          leaderboard: [],
          error: undefined,
        })),

      setScore: (n: number) => set({ score: n }),
      setStreak: (n: number) => set({ streak: n }),
      setCorrectAnswers: (n: number) => set({ correctAnswers: n }),
      setTimeBonus: (n: number) => set({ timeBonus: n }),
      setMultiplayerQuestions: (q: RoundMeta[]) => set({ multiplayerQuestions: q }),
      setRoomCode: (c: string) => set({ roomCode: c }),
      setFastestTime: (n: number) => set({ fastestTime: n }),
      setLeaderboard: (l: Placing[]) => set({ leaderboard: l }),
    }),
    {
      name: STORAGE_KEY,
      version: 3,
      partialize: (s) => ({
        sessionId: s.sessionId,
        currentRound: s.currentRound,
        current: s.current,
        rounds: s.rounds,
        score: s.score,
        streak: s.streak,
        fastestTimeMs: s.fastestTimeMs,
        fastestTime: s.fastestTime,
        timeBonus: s.timeBonus,
        timeBonusTotal: s.timeBonusTotal,
        correctAnswers: s.correctAnswers, // NEW: persist this
        songResults: s.songResults,
      }),
    }
  )
);

export default useGameStore;
export function GameProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
