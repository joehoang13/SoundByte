import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useSettingsStore } from '../stores/SettingsStore';

const SCRATCH_SOUND_URL =
  'https://res.cloudinary.com/dqyszqny2/video/upload/v1761772706/Record_Scratch_1_bjnp1k.mp4';

export const useVinylScratch = () => {
  const scratchSoundRef = useRef<Howl | null>(null);

  const masterVolume = useSettingsStore(state => state.masterVolume);
  const soundEffectsVolume = useSettingsStore(state => state.soundEffectsVolume);
  const finalVolume = (masterVolume / 100) * (soundEffectsVolume / 100);

  useEffect(() => {
    scratchSoundRef.current = new Howl({
      src: [SCRATCH_SOUND_URL],
      volume: finalVolume,
      loop: true,
      preload: true,
    });

    return () => {
      scratchSoundRef.current?.unload();
    };
  }, []);

  // update volume when settings change
  useEffect(() => {
    if (scratchSoundRef.current) {
      scratchSoundRef.current.volume(soundEffectsVolume);
    }
  }, [finalVolume]);

  // function to start scratching sound
  const startScratch = () => {
    if (scratchSoundRef.current && !scratchSoundRef.current.playing()) {
      scratchSoundRef.current.play();
    }
  };

  // function to stop scratching sound
  const stopScratch = () => {
    if (scratchSoundRef.current) {
      scratchSoundRef.current.stop();
    }
  };

  return { startScratch, stopScratch };
};
