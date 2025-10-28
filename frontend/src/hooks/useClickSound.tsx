import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useSettingsStore } from '../stores/SettingsStore';

const CLICK_SOUND_URL = 'https://res.cloudinary.com/dqyszqny2/video/upload/v1761459825/Menu_Selection_Click_zagfzj.wav';

export const useClickSound = () => {
  const clickSoundRef = useRef<Howl | null>(null);
  
  // volume settings from the store
  const masterVolume = useSettingsStore((state) => state.masterVolume);
  const soundEffectsVolume = useSettingsStore((state) => state.soundEffectsVolume);
  const finalVolume = (masterVolume / 100) * (soundEffectsVolume / 100);

  // initialize the click sound
  useEffect(() => {
    clickSoundRef.current = new Howl({
      src: [CLICK_SOUND_URL],
      volume: finalVolume,
      preload: true,
    });

    return () => {
      clickSoundRef.current?.unload();
    };
  }, []);

  // update volume when settings change
  useEffect(() => {
    if (clickSoundRef.current) {
      clickSoundRef.current.volume(finalVolume);
    }
  }, [finalVolume]);

  // global click listener 
  useEffect(() => {
    const handleClick = () => {
      if (clickSoundRef.current) {
        // Stop previous sound if still playing
        clickSoundRef.current.stop();
        // Play the click sound
        clickSoundRef.current.play();
      }
    };

    // listen to all clicks on the document
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);
};