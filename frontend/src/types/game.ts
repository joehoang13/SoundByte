export type Difficulty = 'easy' | 'medium' | 'hard';
export type SnippetSize = 3 | 5 | 10;

export interface StartPayload {
  userId: string;
  difficulty: Difficulty;
  snippetSize: SnippetSize;
  rounds: number;
}

export interface RoundRef {
  snippetId: string;
  audioUrl: string;
}

export interface StartResp {
  sessionId: string;
  rounds: number;
  config: { mode: 'classic'; difficulty: Difficulty; snippetSize: SnippetSize; rounds: number };
  roundIndex: number;
  round: RoundRef;
}

export interface GuessBreakdown {
  base: number;
  timeBonus: number;
  streakBonus: number;
  total: number;
}

export interface GuessResp {
  correct: boolean;
  concluded: boolean;
  attempts: number;
  attemptsLeft: number;
  matched?: { title?: boolean; artist?: boolean };
  timeMs: number;
  breakdown: GuessBreakdown;
  score: number;
  streak: number;
  next: boolean;
}

export interface NextResp {
  roundIndex: number;
  round: RoundRef;
}

export interface FinishResp {
  sessionId: string;
  score: number;
  streak: number;
  fastestTimeMs?: number;
  timeBonusTotal?: number;
  rounds: number;
  answers: Array<{
    snippetId: string;
    title?: string;
    artist?: string;
    correct?: boolean;
    pointsAwarded?: number;
    timeMs?: number;
    attempts?: number;
  }>;
}
