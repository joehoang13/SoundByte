import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Howl, Howler } from 'howler';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../stores/GameSessionStore';
import { useAuth } from '../stores/auth';
import discdb from '../assets/discdb.png';
import needledb from '../assets/needledb.png';
import MultiplayerGameHandler from '../components/GameSteps/MultiplayerGameHandler';

type GuessRow = {
  guessNum: number;
  userGuess: string;
  isCorrect: boolean;
  timeTakenSec: number;
};

const COLORS = {
  grayblue: '#90A4AB',
  darkblue: '#274D5B',
  teal: '#0FC1E9',
  darkestblue: '#143D4D',
};

const GameScreen: React.FC = () => {
  const { user } = useAuth();
  const username = user?.username ?? 'Player';
  const avatarUrl = user?.profilePicture;

  const {
    start,
    sessionId,
    current,
    snippetSize,
    currentRound,
    rounds,
    score,
    streak,
    attemptsLeft,
    lastResult,
    submitGuess,
    next,
    finish,
    multiplayerQuestions,
  } = useGameStore();

  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [isPlaying, setIsPlaying] = useState(false);
  const [guess, setGuess] = useState('');
  const [guessHistory, setGuessHistory] = useState<GuessRow[]>([]);
  const [guessStartTime, setGuessStartTime] = useState<number | null>(null);
  const [playbackCount, setPlaybackCount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('sb_volume');
    const initial = saved ? Math.min(100, Math.max(0, Number(saved))) : 80;
    Howler.volume(initial / 100);
    return initial;
  });

  const audioRef = useRef<Howl | null>(null);
  const timerRef = useRef<number | null>(null);

  const TEAL_TINT_FILTER =
    'brightness(1.1) sepia(0.4) hue-rotate(160deg) saturate(2)';
  const discTransition = {
    ease: 'linear',
    duration: snippetSize,
    repeat: Infinity,
  };
  const needleTransition = {
    repeat: Infinity,
    duration: 2,
    ease: 'easeInOut' as any,
  };

  useEffect(() => {
    if (!sessionId || !current) start(user?.id || '');
  }, [sessionId, current, start, user?.id]);
  // Volume effect
  useEffect(() => {
    Howler.volume(volume / 100);
    localStorage.setItem('sb_volume', String(volume));
  }, [volume]);

  const startSnippetPlayback = () => {
    if (!audioRef.current || playbackCount >= 2) return;

    audioRef.current.stop();
    audioRef.current.seek(0);
    audioRef.current.play();
    setIsPlaying(true);
    setGuessStartTime(Date.now());
    setPlaybackCount(count => count + 1);

    timerRef.current = window.setTimeout(() => {
      audioRef.current?.stop();
      setIsPlaying(false);
    }, (snippetSize || 0) * 1000);
  };

  const onDiscClick = () => {
    if (playbackCount >= 2) return;

    if (isPlaying) {
      audioRef.current?.stop();
      setIsPlaying(false);
      clearTimeout(timerRef.current!);
    } else {
      startSnippetPlayback();
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const g = guess.trim();
    if (!g) return;

    const elapsedMs = Date.now() - (guessStartTime ?? Date.now());
    const res = await submitGuess(g);

    setGuessHistory(prev => [
      ...prev,
      {
        guessNum: prev.length + 1,
        userGuess: g,
        isCorrect: !!res?.correct,
        timeTakenSec: Math.round((elapsedMs / 1000) * 100) / 100,
      },
    ]);

    setGuess('');

    if (res?.concluded) {
      setTimeout(async () => {
        if (currentRound + 1 >= rounds) {
          await finish();
          navigate('/endscreen');
        } else {
          await next();
        }
      }, 400);
    }
  };

  useEffect(() => {
    if (current?.audioUrl) {
      audioRef.current?.unload();
      audioRef.current = new Howl({
        src: [current.audioUrl],
        html5: true,
        volume: 1.0,
      });
    }
    return () => {
      audioRef.current?.unload();
      clearTimeout(timerRef.current!);
    };
  }, [current?.audioUrl]);

  useEffect(() => {
    setGuessHistory([]);
    setPlaybackCount(0);
  }, [currentRound]);

  if (!sessionId || !current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <span>Loading game…</span>
      </div>
    );
  }

  if (!current.audioUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-900 text-white">
        <span>Error: Audio URL is missing.</span>
      </div>
    );
  }

  const handleQuitGame = async () => {
    await finish();
    navigate('/endscreen');
  };

  return (
    multiplayerQuestions.length > 0? <MultiplayerGameHandler user={user}/> :
    <>
      {/* Username Badge */}
      {user && (
        <div
          className="fixed top-6 left-6 z-[60] flex items-center gap-4 rounded-2xl px-5 py-4"
          style={{
            backgroundColor: 'rgba(20, 61, 77, 0.7)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 6px 24px rgba(15,193,233,0.20)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <span className="text-base font-bold" style={{ color: COLORS.teal }}>
                {username?.[0]?.toUpperCase() ?? 'P'}
              </span>
            )}
          </div>
          <div className="leading-tight">
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="text-xl font-extrabold" style={{ color: '#E6F6FA' }}>
                {username}
              </div>
              <button
                type="button"
                className="text-xs font-semibold hover:underline"
                style={{ color: 'rgba(15,193,233,0.9)' }}
              >
                Friends
              </button>
              <button
                type="button"
                className="text-xs font-semibold hover:underline"
                style={{ color: 'rgba(15,193,233,0.9)' }}
              >
                Stats
              </button>
            </div>
            <div className="text-xs" style={{ color: COLORS.grayblue }}>
              online
            </div>
          </div>
        </div>
      )}

      {/* Solo / Group Switch – placeholder */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60]">
        <div
          className="flex items-center gap-1 rounded-full px-1 py-1"
          style={{
            backgroundColor: 'rgba(20, 61, 77, 0.7)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* toggle buttons here */}
        </div>
      </div>

      <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
        <motion.div
          className="flex flex-col bg-darkblue/80 backdrop-blur-sm rounded-2xl w-full max-w-[900px] min-h-[90dvh] sm:min-h-[500px] h-auto shadow-lg relative text-white p-4 sm:p-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* Settings button */}
          <motion.button
            type="button"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSettingsOpen(true)}
            aria-label="Open Settings"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="currentColor" />
              <path
                d="M19.43 12.98a7.94 7.94 0 0 0 .05-.98 7.94 7.94 0 0 0-.05-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.78 7.78 0 0 0-1.7-.98l-.38-2.65A.5.5 0 0 0 12 1h-4a.5.5 0 0 0-.49.41l-.38 2.65c-.62.24-1.2.56-1.74.95l-2.47-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64L2.57 11a7.94 7.94 0 0 0-.05.98c0 .33.02.66.05.98L.46 14.61a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.54.39 1.13.71 1.74.95l.38 2.65A.5.5 0 0 0 8 23h4a.5.5 0 0 0 .49-.41l.38-2.65c.62-.24 1.2-.56 1.74-.95l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64L19.43 12.98z"
                fill="currentColor"
              />
            </svg>
          </motion.button>

          {/* Score / Streak Panel */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-4">
            <div className="flex-1 flex justify-center">
              <div
                className="flex flex-col items-center rounded-xl w-44 px-6 py-5"
                style={{ backgroundColor: 'rgba(20, 61, 77, 0.65)' }}
              >
                <span className="text-sm font-bold text-center">Score</span>
                <span className="text-2xl font-bold text-center">{score}</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <h1 className="text-2xl font-bold text-center">Classic</h1>
            </div>
            <div className="flex-1 flex justify-center">
              <div
                className="flex flex-col items-center rounded-xl w-44 px-6 py-5"
                style={{ backgroundColor: 'rgba(20, 61, 77, 0.65)' }}
              >
                <span className="text-sm font-bold text-center">Streak</span>
                <span className="text-2xl font-bold text-center">{streak}</span>
              </div>
            </div>
          </div>

          {/* Disc + Needle */}
          <div className="flex items-center justify-center w-full px-4 sm:px-6 mt-2 mb-4">
            <div className="relative w-28 h-28">
              <motion.img
                src={discdb}
                alt="Vinyl control"
                className="w-28 h-28 select-none"
                draggable={false}
                onClick={onDiscClick}
                onDragStart={e => e.preventDefault()}
                initial={{ rotate: 0 }}
                animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
                transition={discTransition}
                whileHover={!shouldReduceMotion ? { scale: 1.03 } : undefined}
                whileTap={!shouldReduceMotion ? { scale: 0.98 } : undefined}
                style={{
                  willChange: 'transform',
                  filter: TEAL_TINT_FILTER,
                  boxShadow: '0 0 20px rgba(15, 193, 233, 0.35)',
                  borderRadius: '50%',
                  cursor: playbackCount >= 2 ? 'not-allowed' : 'pointer',
                }}
              />
              <motion.img
                src={needledb}
                alt=""
                aria-hidden="true"
                className="absolute w-16 h-16 z-10 select-none pointer-events-none"
                style={{
                  top: '-6%',
                  right: '14%',
                  transformOrigin: '85% 20%',
                  willChange: 'transform',
                  filter: TEAL_TINT_FILTER,
                }}
                initial={{ y: 0, rotate: -2 }}
                animate={{
                  y: shouldReduceMotion ? 0 : [0, -1, 0],
                  rotate: shouldReduceMotion ? -2 : [-2, -3, -2],
                }}
                transition={needleTransition}
              />
            </div>
          </div>

          {/* Guess Input */}
          <form onSubmit={onSubmit} className="relative mb-6 mx-auto w-full max-w-md">
            <div className="relative bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-cyan-400/20 p-[2px] rounded-2xl">
              <div className="flex bg-darkblue/90 rounded-2xl overflow-hidden backdrop-blur-sm">
                <input
                  type="text"
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && guess.trim()) {
                      onSubmit(e as any);
                    }
                  }}
                  placeholder={lastResult?.concluded ? 'Round concluded' : ' Enter your answer here'}
                  className="flex-1 p-5 text-base sm:text-lg bg-transparent text-white placeholder-gray-300 text-center focus:outline-none transition-all duration-300 focus:placeholder-transparent disabled:opacity-60"
                  disabled={lastResult?.concluded || (attemptsLeft !== undefined && attemptsLeft <= 0)}
                  autoFocus
                />
                <motion.button
                  type="submit"
                  disabled={lastResult?.concluded || !guess.trim() || (attemptsLeft !== undefined && attemptsLeft <= 0)}
                  className={`px-8 font-bold py-5 text-base transition-all duration-300 whitespace-nowrap relative overflow-hidden ${(lastResult?.concluded || !guess.trim() || (attemptsLeft !== undefined && attemptsLeft <= 0))
                    ? 'bg-gray-700/50 cursor-not-allowed text-gray-500'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg hover:shadow-cyan-500/25'
                    }`}
                  whileHover={!(lastResult?.concluded || !guess.trim() || (attemptsLeft !== undefined && attemptsLeft <= 0)) ? { scale: 1.02 } : {}}
                  whileTap={!(lastResult?.concluded || !guess.trim() || (attemptsLeft !== undefined && attemptsLeft <= 0)) ? { scale: 0.98 } : {}}
                >
                  <span className="relative z-10 flex items-center gap-2">Submit</span>
                </motion.button>
              </div>
            </div>
          </form>

          {/* Guess History */}
          <div className="rounded-2xl p-5 max-h-48 flex-grow overflow-y-auto pr-2" style={{ backgroundColor: COLORS.darkestblue }}>
            <h2 className="text-lg font-semibold mb-2">Your Guesses:</h2>
            <ul className="space-y-2 overflow-y-auto">
              {guessHistory.map(g => (
                <li key={g.guessNum} className="flex justify-between">
                  <span>Attempt {g.guessNum}: {g.userGuess}</span>
                  <span className={g.isCorrect ? 'text-green-400' : 'text-red-400'}>
                    {g.isCorrect ? 'Correct' : `Incorrect (${g.timeTakenSec}s)`}
                  </span>
                </li>
              ))}
            </ul>
            {typeof attemptsLeft === 'number' && (
              <p className="mt-3 text-sm opacity-80">Attempts left: {attemptsLeft}</p>
            )}
          </div>

        </motion.div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSettingsOpen(false)}
        >
          <motion.div
            className="relative w-full max-w-3xl bg-white/5 rounded-3xl border border-white/10 shadow-2xl p-6 sm:p-8 text-white"
            style={{ backgroundColor: 'rgba(39,77,91,0.9)' }}
            initial={{ y: 20, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white text-xl"
            >
              ×
            </button>
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold">Game Settings</h2>
              <p className="text-sm mt-1" style={{ color: COLORS.grayblue }}>
                Adjust volume, manage your session, and see who’s playing.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Volume & Controls Section */}
              <section
                className="lg:col-span-2 rounded-2xl p-5"
                style={{ backgroundColor: 'rgba(20, 61, 77, 0.65)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <h3 className="text-base sm:text-lg font-semibold mb-3">Volume</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{ color: COLORS.grayblue }}>0</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={e => setVolume(Number(e.target.value))}
                    className="flex-1 accent-cyan-400"
                    aria-label="Master volume"
                  />
                  <span className="text-sm w-10 text-right" style={{ color: COLORS.grayblue }}>{volume}</span>
                </div>
                <p className="text-xs mt-2" style={{ color: COLORS.grayblue }}>
                  Controls the game’s master volume.
                </p>

                <div className="flex flex-col gap-3 mt-6">
                  <motion.button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="w-full px-4 py-2 rounded-xl font-semibold"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Back to Game
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleQuitGame}
                    className="w-full px-4 py-2 rounded-xl font-semibold"
                    style={{ background: 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)', color: '#fff' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Quit Game
                  </motion.button>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
};

export default GameScreen;
