import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Howler } from 'howler';

interface SettingsState {
  masterVolume: number;
  musicVolume: number;
  soundEffectsVolume: number;
  movingBackground: boolean;

  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSoundEffectsVolume: (volume: number) => void;
  setMovingBackground: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      masterVolume: 70,
      musicVolume: 50,
      soundEffectsVolume: 50,
      movingBackground: true,

      setMasterVolume: volume => set({ masterVolume: volume }),
      setMusicVolume: volume => set({ musicVolume: volume }),
      setSoundEffectsVolume: volume => set({ soundEffectsVolume: volume }),
      setMovingBackground: enabled => set({ movingBackground: enabled }),

      resetToDefaults: () => {
        set({
          masterVolume: 70,
          musicVolume: 50,
          soundEffectsVolume: 50,
          movingBackground: true,
        });
      },
    }),
    {
      name: 'soundbyte-settings',
    }
  )
);
