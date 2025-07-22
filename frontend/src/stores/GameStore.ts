import { create } from 'zustand';

interface GameState {
  gameMode: 'classic' | 'other'; // Add other modes as needed
  score: number;
  streak: number;
  snippetLength: number;
  correctAnswers: number;
  fastestTime: number;
  timeBonus: number;
  setGameMode: (mode: 'classic' | 'other') => void;
  setScore: (score: number) => void;
  setStreak: (streak: number) => void;
  setSnippetLength: (length: number) => void;
  setCorrectAnswers: (count: number) => void;
  setFastestTime: (time: number) => void;
  setTimeBonus: (bonus: number) => void;
}

const useGameStore = create<GameState>(set => ({
  gameMode: 'classic', // Default mode
  score: 0,
  streak: 0,
  snippetLength: 5,
  correctAnswers: 0,
  fastestTime: Infinity,
  timeBonus: 0,
  setGameMode: mode => set({ gameMode: mode }),
  setScore: score => set({ score }),
  setStreak: streak => set({ streak }),
  setSnippetLength: length => set({ snippetLength: length }),
  setCorrectAnswers: count => set({ correctAnswers: count }),
  setFastestTime: time => set({ fastestTime: time }),
  setTimeBonus: bonus => set({ timeBonus: bonus }),
}));

export default useGameStore;
