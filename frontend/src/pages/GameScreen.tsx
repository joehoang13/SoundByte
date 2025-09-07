import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Howl, Howler } from 'howler';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../stores/GameSessionStore';
import { motion } from 'framer-motion';

/**
 * GameScreen — Classic mode with in-screen Settings modal
 * - Cog button opens a modal (no route change).
 * - Settings modal shows: Game Settings header, Players, Volume, Back to Game, Log Out.
 * - Gameplay unchanged.
 */

function useHowl(url?: string, useWebAudio = true) {
  const ref = useRef<Howl | null>(null);
  useEffect(() => {
    ref.current?.unload();
    if (url) {
      ref.current = new Howl({ src: [url], html5: !useWebAudio, volume: 1.0 });
    } else {
      ref.current = null;
    }
    return () => {
      ref.current?.unload();
    };
  }, [url, useWebAudio]);
  return ref;
}

interface GuessRow {
  guessNum: number;
  userGuess: string;
  isCorrect: boolean;
  timeTakenSec: number;
}

const COLORS = {
  grayblue: '#90A4AB',
  darkblue: '#274D5B',
  teal: '#0FC1E9',
  darkestblue: '#143D4D',
};

type Player = {
  id: string;
  name: string;
  avatarUrl?: string;
};

const GameScreen: React.FC<{ userId?: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const {
    start,
    markRoundStarted,
    submitGuess,
    next,
    finish,
    current,
    currentRound,
    rounds,
    score,
    streak,
    attemptsLeft,
    lastResult,
    snippetSize,
    sessionId,
    loading,
  } = useGameStore();

  // Try to read players from store (fallback empty)
  const players: Player[] =
    // @ts-ignore — tolerate unknown store shape
    (useGameStore.getState?.().players as Player[] | undefined) ?? [];

  const [guess, setGuess] = useState('');
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [guessHistory, setGuessHistory] = useState<GuessRow[]>([]);
  const [modeOpen, setModeOpen] = useState(false);

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Volume (persist + Howler)
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('sb_volume');
    const initial = saved ? Math.min(100, Math.max(0, Number(saved))) : 80;
    Howler.volume(initial / 100);
    return initial;
  });
  useEffect(() => {
    Howler.volume(volume / 100);
    localStorage.setItem('sb_volume', String(volume));
  }, [volume]);

  const howl = useHowl(current?.audioUrl, true);
  const stopTimer = useRef<number | undefined>(undefined);
  const startedOnceRef = useRef(false);
  const roundStartMs = useRef<number>(Date.now());

  // Visualizer
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const animRef = useRef<number | null>(null);

  const snippetSeconds = useMemo(() => snippetSize ?? 5, [snippetSize]);

  // Boot a session once
  useEffect(() => {
    if (!sessionId && !loading) start(userId || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, loading, start, userId]);

  // Load & play current snippet
  useEffect(() => {
    setGuess('');
    setReady(false);
    setReplayCount(0);
    setGuessHistory([]);
    startedOnceRef.current = false;

    const h = howl.current;
    if (!h) return;

    const handleLoad = async () => {
      setReady(true);
      if (!startedOnceRef.current) {
        startedOnceRef.current = true;
        await markRoundStarted();
      }
      roundStartMs.current = Date.now();
      setIsPlaying(true);
      setupAnalyser();
      h.play();

      window.clearTimeout(stopTimer.current);
      stopTimer.current = window.setTimeout(
        () => {
          h.stop();
          setIsPlaying(false);
          teardownAnalyser();
        },
        Math.max(0, snippetSeconds * 1000)
      ) as unknown as number;
    };

    h.once('load', handleLoad);

    return () => {
      window.clearTimeout(stopTimer.current);
      teardownAnalyser();
      h.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [howl, markRoundStarted, current?.audioUrl, snippetSeconds]);

  // Stop audio on conclude
  useEffect(() => {
    if (lastResult?.concluded) {
      howl.current?.stop();
      setIsPlaying(false);
      window.clearTimeout(stopTimer.current);
      teardownAnalyser();
    }
  }, [lastResult?.concluded]);

  const handleReplay = () => {
    if (!howl.current || replayCount >= 1 || !ready) return;
    roundStartMs.current = Date.now();
    setIsPlaying(true);
    setupAnalyser();
    howl.current.play();
    window.clearTimeout(stopTimer.current);
    stopTimer.current = window.setTimeout(
      () => {
        howl.current?.stop();
        setIsPlaying(false);
        teardownAnalyser();
      },
      Math.max(0, snippetSeconds * 1000)
    ) as unknown as number;
    setReplayCount(c => c + 1);
  };

  function setupAnalyser() {
    try {
      const ctx = Howler.ctx as AudioContext | undefined;
      if (!ctx) return;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      const raw = (howl.current as any)?._sounds?.[0];
      const srcNode: AudioNode | undefined =
        raw?._node?.bufferSource || raw?._node?._panner || raw?._node;
      if (!srcNode || !('connect' in srcNode)) return;

      try {
        (srcNode as any).connect(analyser);
      } catch {}
      try {
        analyser.connect(ctx.destination);
      } catch {}

      const bufferLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufferLen);
      analyserRef.current = analyser;
      dataArrayRef.current = data;

      drawBars();
    } catch {}
  }

  function teardownAnalyser() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    dataArrayRef.current = null;
  }

  function drawBars() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const data = dataArrayRef.current;
    if (!canvas || !analyser || !data) return;

    const ctx = canvas.getContext('2d');
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const loop = () => {
      if (!ctx || !analyser) return;
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const barWidth = (WIDTH / data.length) * 2.5;
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const barHeight = (data[i] / 255) * HEIGHT;
        const gradient = ctx.createLinearGradient(0, HEIGHT, 0, HEIGHT - barHeight);
        gradient.addColorStop(0, COLORS.teal);
        gradient.addColorStop(1, COLORS.grayblue);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const g = guess.trim();
    if (!g) return;

    const res = await submitGuess(g);
    const elapsedMs = Date.now() - roundStartMs.current;
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

    setTimeout(async () => {
      if (res?.concluded) {
        if (currentRound + 1 >= rounds) {
          await finish();
          navigate('/endscreen');
        } else {
          await next();
        }
      }
    }, 350);
  };

  // Settings actions
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    } catch {}
    try {
      localStorage.removeItem('token');
    } catch {}
    navigate('/');
  };

  const concluded = !!lastResult?.concluded;
  const disable = !ready || concluded || (attemptsLeft !== undefined && attemptsLeft <= 0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
      <motion.div
        className="flex flex-col bg-darkblue/80 backdrop-blur-sm rounded-2xl w-full max-w-[900px] min-h-[90dvh] sm:min-h-[500px] h-auto shadow-lg relative text-white p-4 sm:p-10"
        style={{ backgroundColor: COLORS.darkblue }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Settings (opens modal) */}
        <motion.button
          type="button"
          className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSettingsOpen(true)}
          aria-label="Open Settings"
          title="Settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="currentColor" />
            <path
              d="M19.43 12.98a7.94 7.94 0 0 0 .05-.98 7.94 7.94 0 0 0-.05-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.78 7.78 0 0 0-1.7-.98l-.38-2.65A.5.5 0 0 0 12 1h-4a.5.5 0 0 0-.49.41l-.38 2.65c-.62.24-1.2.56-1.74.95l-2.47-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64L2.57 11a.5.5 0 0 0-.05.98c0 .33.02.66.05.98L.46 14.61a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.54.39 1.13.71 1.74.95l.38 2.65A.5.5 0 0 0 8 23h4a.5.5 0 0 0 .49-.41l.38-2.65c.62-.24 1.2-.56 1.74-.95l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64L19.43 12.98z"
              fill="currentColor"
            />
          </svg>
        </motion.button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-4">
          <div className="flex-1 flex justify-center">
            <div
              className="flex flex-col items-center rounded-xl w-40 px-6 py-4"
              style={{ backgroundColor: 'rgba(20, 61, 77, 0.65)' }}
            >
              <span className="text-sm font-bold text-center">Score</span>
              <span className="text-xl font-bold text-center">{score}</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative">
            <h1 className="text-2xl font-bold text-center">Game Screen</h1>

            {/* Mode pill (kept) */}
            <div className="mt-2 relative">
              <button
                type="button"
                onClick={() => setModeOpen(o => !o)}
                onBlur={() => setTimeout(() => setModeOpen(false), 150)}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs sm:text-sm tracking-wide"
                style={{
                  borderColor: COLORS.teal,
                  backgroundColor: 'rgba(20, 61, 77, 0.4)',
                  color: COLORS.grayblue,
                }}
                aria-haspopup="listbox"
                aria-expanded={modeOpen}
              >
                <span
                  className="inline-block rounded-full"
                  style={{ width: 8, height: 8, backgroundColor: COLORS.teal }}
                />
                Classic Mode
                <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-80">
                  <path fill="currentColor" d="M7 10l5 5 5-5z" />
                </svg>
              </button>

              {modeOpen && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 mt-2 w-44 rounded-xl border shadow-lg overflow-hidden z-20"
                  role="listbox"
                  style={{
                    backgroundColor: COLORS.darkestblue,
                    borderColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => navigate('/gamescreen')}
                  >
                    Classic Mode
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => navigate('/inference')}
                  >
                    Inference Mode
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <div
              className="flex flex-col items-center rounded-xl w-40 px-6 py-4"
              style={{ backgroundColor: 'rgba(20, 61, 77, 0.65)' }}
            >
              <span className="text-sm font-bold text-center">Streak</span>
              <span className="text-xl font-bold text-center">{streak}</span>
            </div>
          </div>
        </div>

        <p className="text-center mb-6">Snippet Length: {snippetSeconds} seconds</p>

        {/* Visualizer / replay */}
        <div className="flex items-center justify-center w-full rounded-lg px-4 sm:px-6">
          {isPlaying ? (
            <div className="flex flex-col items-center py-4 mb-4 w-full">
              <canvas
                ref={canvasRef}
                width={800}
                height={80}
                className="w-full h-full mb-4"
                style={{ imageRendering: 'pixelated' }}
              />
              <motion.div
                className="text-sm"
                style={{ color: COLORS.grayblue }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                now playing...
              </motion.div>
            </div>
          ) : replayCount < 1 ? (
            <div className="flex justify-center mb-6">
              <button
                type="button"
                onClick={handleReplay}
                className="px-3 py-3 bg-white/10 hover:bg-white/20 rounded-3xl"
                aria-label="Replay"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5V1L7 6l5 5V7c3.314 0 6 2.686 6 6s-2.686 6-6 6-6-2.686-6-6H4c0 4.418 3.582 8 8 8s8-3.582 8-8-3.582-8-8-8z"
                    fill="white"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <p className="text-center mb-6">No more replays allowed for this round.</p>
          )}
        </div>

        {/* Guess input */}
        <form onSubmit={onSubmit} className="relative mb-6">
          <div className="relative bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-cyan-400/20 p-[2px] rounded-2xl">
            <div className="flex bg-darkblue/90 rounded-2xl overflow-hidden backdrop-blur-sm">
              <input
                type="text"
                value={guess}
                onChange={e => setGuess(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && guess.trim()) onSubmit(e as any);
                }}
                placeholder={concluded ? 'Round concluded' : 'Enter your answer here...'}
                className="flex-1 p-4 sm:p-5 text-sm sm:text-base bg-transparent text-white placeholder-gray-300 text-center focus:outline-none transition-all duration-300 focus:placeholder-transparent disabled:opacity-60"
                disabled={disable}
                autoFocus
              />

              <motion.button
                type="submit"
                disabled={disable || !guess.trim()}
                className={`px-6 sm:px-8 font-bold py-4 sm:py-5 transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
                  disable || !guess.trim()
                    ? 'bg-gray-700/50 cursor-not-allowed text-gray-500'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg hover:shadow-cyan-500/25'
                }`}
                whileHover={!disable && !!guess.trim() ? { scale: 1.02 } : {}}
                whileTap={!disable && !!guess.trim() ? { scale: 0.98 } : {}}
              >
                <span className="relative z-10 flex items-center gap-2">Submit</span>
              </motion.button>
            </div>
          </div>
        </form>

        {/* History */}
        <div
          className="rounded-2xl p-4 max-h-48 flex-grow overflow-y-auto pr-2"
          style={{ backgroundColor: COLORS.darkestblue }}
        >
          <h2 className="text-base sm:text-lg font-semibold mb-2">Your Guesses:</h2>
          <ul className="space-y-2 overflow-y-auto">
            {guessHistory.map(g => (
              <li key={g.guessNum} className="flex justify-between">
                <span>
                  Attempt {g.guessNum}: {g.userGuess}
                </span>
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

      {/* SETTINGS MODAL */}
      {settingsOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSettingsOpen(false)}
        >
          {/* Stop click-through inside the card */}
          <motion.div
            className="relative w-full max-w-3xl bg-white/5 rounded-3xl border border-white/10 shadow-2xl p-6 sm:p-8 text-white"
            style={{ backgroundColor: 'rgba(39,77,91,0.9)' }}
            initial={{ y: 20, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close X */}
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white text-xl"
            >
              ×
            </button>

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold">Game Settings</h2>
              <p className="text-sm mt-1" style={{ color: COLORS.grayblue }}>
                Adjust volume, manage your session, and see who’s playing.
              </p>
            </div>

            {/* Content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Players */}
              <section
                className="lg:col-span-2 rounded-2xl p-5"
                style={{
                  backgroundColor: 'rgba(20, 61, 77, 0.65)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <header className="flex items-center justify-between mb-4">
                  <h3 className="text-lg sm:text-xl font-semibold">Players</h3>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full border"
                    style={{
                      borderColor: COLORS.teal,
                      color: COLORS.grayblue,
                      backgroundColor: 'rgba(20, 61, 77, 0.35)',
                    }}
                  >
                    {players.length} {players.length === 1 ? 'player' : 'players'}
                  </span>
                </header>

                {players.length === 0 ? (
                  <p className="text-sm" style={{ color: COLORS.grayblue }}>
                    No players joined yet.
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {players.map(p => (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                          {p.avatarUrl ? (
                            <img
                              src={p.avatarUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold">
                              {p.name?.[0]?.toUpperCase() ?? 'P'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{p.name || 'Player'}</div>
                          <div className="text-xs" style={{ color: COLORS.grayblue }}>
                            Ready
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Controls */}
              <section
                className="rounded-2xl p-5 flex flex-col gap-6"
                style={{
                  backgroundColor: 'rgba(20, 61, 77, 0.65)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {/* Volume */}
                <div>
                  <h3 className="text-base sm:text-lg font-semibold mb-3">Volume</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm" style={{ color: COLORS.grayblue }}>
                      0
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volume}
                      onChange={e => setVolume(Number(e.target.value))}
                      className="flex-1 accent-cyan-400"
                      aria-label="Master volume"
                    />
                    <span className="text-sm w-10 text-right" style={{ color: COLORS.grayblue }}>
                      {volume}
                    </span>
                  </div>
                  <p className="text-xs mt-2" style={{ color: COLORS.grayblue }}>
                    Controls the game’s master volume.
                  </p>
                </div>

                {/* Back / Logout */}
                <div className="flex flex-col gap-3">
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
                    onClick={handleLogout}
                    className="w-full px-4 py-2 rounded-xl font-semibold"
                    style={{
                      background: 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)',
                      color: '#fff',
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Log Out
                  </motion.button>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default GameScreen;
