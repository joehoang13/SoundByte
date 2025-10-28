import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useLocation } from 'react-router-dom';
import { useSettingsStore } from '../stores/SettingsStore';

const LOBBY_MUSIC_URL =
    'https://res.cloudinary.com/dqyszqny2/video/upload/v1761459815/in_the_lobby_pvyeww.wav';

const LobbyMusic = () => {

    // howl reference
    const lobbyMusicRef = useRef<Howl | null>(null);

    // get current page location
    const location = useLocation();

    // get volume settings from the store
    const masterVolume = useSettingsStore((state) => state.masterVolume);
    const musicVolume = useSettingsStore((state) => state.musicVolume);
    const finalVolume = (masterVolume / 100) * (musicVolume / 100);

    // when component mounts, initialize and play music
    useEffect(() => {
        
        lobbyMusicRef.current = new Howl({
            src: [LOBBY_MUSIC_URL],
            loop: true,
            volume: finalVolume,
            html5: true,
        });

        lobbyMusicRef.current.play();

        return () => {
            if (lobbyMusicRef.current) {
                lobbyMusicRef.current.unload();
            }
        };
    }, []);

    // when setting changes, update volume
    useEffect(() => {
        const howl = lobbyMusicRef.current;
        if (howl) {
            howl.volume(finalVolume);
        }
    }, [finalVolume]);

    // handle page navigation
    useEffect(() => {
        const howl = lobbyMusicRef.current;
        if (!howl) return;

        const currentPath = location.pathname;

        // doesnt play music during game screens
        const shouldPause =
            currentPath === '/gamescreen' ||
            currentPath.includes('/game');

        if (shouldPause) {
            // pause lobby music on game screens
            if (howl.playing()) {
                howl.pause();
            }
        } else {
            // resume lobby music on other pages
            if (!howl.playing()) {
                howl.play();
            }
        }
    }, [location]);

    return null;

};

export default LobbyMusic;