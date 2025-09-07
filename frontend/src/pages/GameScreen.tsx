import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Howl, Howler } from 'howler';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../stores/GameSessionStore';
import { motion } from 'framer-motion';

/**
 * GameScreen — restored UI (visualizer + replay + gradient input) with the current backend-driven logic.
 * Why: keep functionality identical while bringing back the previous look & feel.
 */

// --- local helpers ---
function useHowl(url?: string, useWebAudio = true) {
  const ref = useRef<Howl | null>(null);
  useEffect(() => {
    ref.current?.unload();
    if (url) {
      // Use WebAudio when possible so the visualizer can attach to the graph.
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

  const [guess, setGuess] = useState('');
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [guessHistory, setGuessHistory] = useState<GuessRow[]>([]);

  const howl = useHowl(current?.audioUrl, true);
  const stopTimer = useRef<number | undefined>(undefined);
  const startedOnceRef = useRef(false); // why: don't re-send round started on replay
  const roundStartMs = useRef<number>(Date.now());

  // Visualizer refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const animRef = useRef<number | null>(null);

  const snippetSeconds = useMemo(() => snippetSize ?? 5, [snippetSize]);

  // Start only once per mount
  useEffect(() => {
    if (!sessionId && !loading) start(userId || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, loading, start, userId]);

  // Load & play current snippet; stop exactly at snippetSeconds
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
      // only mark the very first time this round is actually started
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
      h.stop(); // avoid bleed across rounds/unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [howl, markRoundStarted, current?.audioUrl, snippetSeconds]);

  // Stop audio when round concludes (correct or out of attempts)
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
    // don't re-mark round started; just re-play snippet window
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
      if (!ctx) return; // html5 fallback — no visualizer

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      // Reach into Howler internals for current buffer source (WebAudio mode only)
      const raw = (howl.current as any)?._sounds?.[0];
      const srcNode: AudioNode | undefined =
        raw?._node?.bufferSource || raw?._node?._panner || raw?._node;
      if (!srcNode || !('connect' in srcNode)) return; // guard: html5 audio path

      // Chain: src -> analyser -> destination (in parallel so audio still plays)
      try {
        (srcNode as any).connect(analyser);
      } catch {
        /* already connected */
      }
      try {
        analyser.connect(ctx.destination);
      } catch {
        /* ignore */
      }

      const bufferLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufferLen);
      analyserRef.current = analyser;
      dataArrayRef.current = data;

      drawBars();
    } catch {
      // fail-soft if WebAudio graph isn't accessible
    }
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
        gradient.addColorStop(0, '#0FC1E9');
        gradient.addColorStop(1, '#90A4AB');
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
    // push into local history purely for UI purposes
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

    // on conclude, either go next or finish
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

  const concluded = !!lastResult?.concluded;
  const disable = !ready || concluded || (attemptsLeft !== undefined && attemptsLeft <= 0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
      <motion.div
        className="flex flex-col bg-darkblue/80 backdrop-blur-sm rounded-2xl w-full max-w-[900px] min-h-[90dvh] sm:min-h-[500px] h-auto shadow-lg relative text-white p-4 sm:p-10"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Settings button (top-right of the game card) */}
        <motion.button
          className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20
                     flex items-center justify-center transition-colors"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/ready')}
          aria-label="Open Settings"
          title="Settings"
        >
          {/* Gear icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="currentColor" />
            <path
              d="M19.43 12.98a7.94 7.94 0 0 0 .05-.98 7.94 7.94 0 0 0-.05-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.78 7.78 0 0 0-1.7-.98l-.38-2.65A.5.5 0 0 0 12 1h-4a.5.5 0 0 0-.49.41l-.38 2.65c-.62.24-1.2.56-1.74.95l-2.47-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64L2.57 11a7.94 7.94 0 0 0-.05.98c0 .33.02.66.05.98L.46 14.61a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.54.39 1.13.71 1.74.95l.38 2.65A.5.5 0 0 0 8 23h4a.5.5 0 0 0 .49-.41l.38-2.65c.62-.24 1.2-.56 1.74-.95l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64L19.43 12.98z"
              fill="currentColor"
            />
          </svg>
        </motion.button>

        {/* Header with score and streak */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-4">
          <div className="flex-1 flex justify-center">
            <div className="flex flex-col items-center bg-darkblue/75 rounded-xl w-40 px-6 py-4">
              <span className="text-sm font-bold text-center">Score</span>
              <span className="text-xl font-bold text-center">{score}</span>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <h1 className="text-2xl font-bold text-center">Game Screen</h1>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="flex flex-col items-center bg-darkblue/75 rounded-xl w-40 px-6 py-4">
              <span className="text-sm font-bold text-center">Streak</span>
              <span className="text-xl font-bold text-center">{streak}</span>
            </div>
          </div>
        </div>

        {/* Snippet length label */}
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
                style={{ color: '#90A4AB' }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                now playing...
              </motion.div>
            </div>
          ) : replayCount < 1 ? (
            <div className="flex justify-center mb-6">
              <button
                onClick={handleReplay}
                className="px-3 py-3 bg-white/10 hover:bg-white/20 rounded-3xl"
                aria-label="Replay"
              >
                {/* inline replay icon to avoid asset dependency */}
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
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

        {/* Guess input with animated glow */}
        <div className="relative mb-6">
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
                onClick={e => onSubmit(e as any)}
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

          {guess.trim() && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl"
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{ zIndex: -1 }}
            />
          )}
        </div>

        {/* Guess history */}
        <div className="bg-darkblue rounded-2xl p-4 max-h-48 flex-grow overflow-y-auto pr-2">
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
    </div>
  );
};

export default GameScreen;
