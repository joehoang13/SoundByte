import { create } from 'zustand'

interface GameState {
  score: number
  streak: number
  snippetLength: number
  setScore: (score: number) => void
  setStreak: (streak: number) => void
  setSnippetLength: (length: number) => void
}

const useGameStore = create<GameState>((set) => ({
  score: 0,
  streak: 0,
  snippetLength: 5,
  setScore: (score) => set({ score }),
  setStreak: (streak) => set({ streak }),
  setSnippetLength: (length) => set({ snippetLength: length }),
}))

export default useGameStore
