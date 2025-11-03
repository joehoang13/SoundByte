import React, { useEffect, useState, useCallback, useRef } from 'react';
import useGameStore from '../../stores/GameSessionStore';
import { motion, useReducedMotion } from 'framer-motion';
import { useSocketStore } from '../../stores/SocketStore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../stores/auth';
import discdb from '../../assets/discdb.png';
import needledb from '../../assets/needledb.png';
import type { AuthUser } from '../../stores/auth';
import type { Placing, RoundMeta } from '../../stores/GameSessionStore';

interface Props {
  user: AuthUser | undefined;
}

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

const MultiplayerGameHandler: React.FC<Props> = ({ user }) => {
  const {
    roomCode,
    score,
    streak,
    multiplayerQuestions,
    currentRound,
    snippetSize,
    sessionId,
    rounds,
    attemptsLeft,
    correctAnswers,
    timeBonus,
    timeBonusTotal,
    fastestTime,
    next,
    start,
    submitGuess,
    setScore,
    setStreak,
    setCorrectAnswers,
    setTimeBonus,
    setTimeBonusTotal,
    setFastestTime,
    setLeaderboard,
  } = useGameStore();

  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const username = user?.username ?? 'Player';
  const avatarUrl = user?.profilePicture;
  const userId = user?.id;

  const [hintsUnlocked, setHintsUnlocked] = useState(0);
  const [current, setCurrent] = useState<RoundMeta>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [guessHistory, setGuessHistory] = useState<GuessRow[]>([]);
  const [guessStartTime, setGuessStartTime] = useState<number | null>(null);
  const [playbackCount, setPlaybackCount] = useState(0);
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('sb_volume');
    const initial = saved ? Math.min(100, Math.max(0, Number(saved))) : 80;
    Howler.volume(initial / 100);
    return initial;
  });

  const audioRef = useRef<Howl | null>(null);
  const timerRef = useRef<number | null>(null);

  const TEAL_TINT_FILTER = 'brightness(1.1) sepia(0.4) hue-rotate(160deg) saturate(2)';
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

  const [guess, setGuess] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const { socket, connect, disconnect } = useSocketStore();

  function formatInitials(fullString: string, revealedWords = 1): string {
    const words = (fullString || '').split(' ');
    return words
      .map((word, i) =>
        i < revealedWords
          ? word[0].toUpperCase() + '_'.repeat(Math.max(1, word.length - 1))
          : '____'
      )
      .join(' ');
  }

  const handleGuessSubmit = useCallback(
    (e?: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
      e?.preventDefault();

      if (!roomCode || !current?.snippetId || !guess || !socket) return;

      const g = guess.trim();
      if (!g) return;
      const elapsedMs = Date.now() - (guessStartTime ?? Date.now());
      const elapedSeconds = Math.round((elapsedMs / 1000) * 100) / 100;
      socket.emit(
        'game:answer',
        {
          code: roomCode,
          userId,
          roundIndex: currentRound,
          guess: g,
        },
        (res: any) => {
          if (!res) return;
          setLastResult(res);
          setGuessHistory(prev => [
            ...prev,
            {
              guessNum: prev.length + 1,
              userGuess: g,
              isCorrect: res.correct,
              timeTakenSec: elapedSeconds,
            },
          ]);
          setGuess('');
          if (res.correct) {
            setScore(res.score);
            setCorrectAnswers(correctAnswers + 1);
            setStreak(streak + 1);
            setTimeBonus(timeBonus + (res.breakdown?.timeBonus || 0));
            setTimeBonusTotal(timeBonusTotal + (res.breakdown?.timeBonus || 0));
            if (Math.round((elapsedMs / 1000) * 100) / 100 < fastestTime) {
              setFastestTime(elapedSeconds);
            }
          } else {
            setStreak(0);
            setHintsUnlocked(prev => Math.min(prev + 1, 3)); // hints cap at 3 levels
          }

          if (res.concluded || guessHistory.length > 4) {
            setTimeout(async () => {
              await handleNext();
            }, 400);
          }
        }
      );
    },
    [guess, roomCode, current?.snippetId, currentRound, userId]
  );

  const handleNext = () => {
    const totalRounds = multiplayerQuestions.length;
    if (currentRound + 1 >= totalRounds) {
      finish();
    } else {
      useGameStore.setState({
        currentRound: currentRound + 1,
        lastResult: undefined,
        attemptsLeft: undefined,
      });
      setGuess('');
      setGuessHistory([]);
      setPlaybackCount(0);
      setLastResult(null);
    }
  };

  const handleQuitGame = async () => {
    await finish();
    disconnect();
    navigate('/endscreen');
  };

  const finish = async () => {
    socket?.emit('endGame', { roomCode, userId: user?.id }, (res: any) => {
      if (res.allDone) {
        setIsWaiting(false);
      } else {
        setIsWaiting(true);
      }
    });
  };

  useEffect(() => {
    socket?.on('game:end', (players: Placing[]) => {
      setLeaderboard(players);
      disconnect();
      navigate('/endscreen');
    });
  }, [socket]);

  useEffect(() => {
    if (!sessionId || !current) start(user?.id || '');
  }, [sessionId, current, start, user?.id]);
  // Volume effect

  useEffect(() => {
    Howler.volume(volume / 100);
    localStorage.setItem('sb_volume', String(volume));
  }, [volume]);

  useEffect(() => {
    if (current?.audioUrl) {
      audioRef.current?.unload();
      audioRef.current = new Howl({
        src: [multiplayerQuestions[currentRound].audioUrl],
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
    setCurrent(multiplayerQuestions[currentRound]);
    setPlaybackCount(0);
    setHintsUnlocked(0);
  }, [currentRound]);

  const startSnippetPlayback = () => {
    if (!audioRef.current || playbackCount >= 2) return;

    audioRef.current.stop();
    audioRef.current.seek(0);
    audioRef.current.play();
    setIsPlaying(true);
    setGuessStartTime(Date.now());
    setPlaybackCount(count => count + 1);

    timerRef.current = window.setTimeout(
      () => {
        audioRef.current?.stop();
        setIsPlaying(false);
      },
      (snippetSize || 0) * 1000
    );
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

  useEffect(() => {
    if (current?.snippetId) {
      socket?.emit('game:roundStarted', {
        code: roomCode,
        userId,
        roundIndex: currentRound,
      });
    }
  }, [currentRound, current?.snippetId, roomCode, userId]);

  if (!current) return <div>Loading round...</div>;

  return isWaiting ? (
    <motion.button>Waiting!</motion.button>
  ) : (
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
              <h1 className="text-2xl font-bold text-center">Multi</h1>
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
          <form onSubmit={handleGuessSubmit} className="relative mb-6 mx-auto w-full max-w-md">
            <div className="relative bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-cyan-400/20 p-[2px] rounded-2xl">
              <div className="flex bg-darkblue/90 rounded-2xl overflow-hidden backdrop-blur-sm">
                <input
                  type="text"
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && guess.trim()) {
                      handleGuessSubmit(e as any);
                    }
                  }}
                  placeholder={
                    lastResult?.concluded ? 'Round concluded' : ' Enter your answer here'
                  }
                  className="flex-1 p-5 text-base sm:text-lg bg-transparent text-white placeholder-gray-300 text-center focus:outline-none transition-all duration-300 focus:placeholder-transparent disabled:opacity-60"
                  disabled={
                    lastResult?.concluded || (attemptsLeft !== undefined && attemptsLeft <= 0)
                  }
                  autoFocus
                />
                <motion.button
                  type="submit"
                  disabled={
                    lastResult?.concluded ||
                    !guess.trim() ||
                    (attemptsLeft !== undefined && attemptsLeft <= 0)
                  }
                  className={`px-8 font-bold py-5 text-base transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
                    lastResult?.concluded ||
                    !guess.trim() ||
                    (attemptsLeft !== undefined && attemptsLeft <= 0)
                      ? 'bg-gray-700/50 cursor-not-allowed text-gray-500'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg hover:shadow-cyan-500/25'
                  }`}
                  whileHover={
                    !(
                      lastResult?.concluded ||
                      !guess.trim() ||
                      (attemptsLeft !== undefined && attemptsLeft <= 0)
                    )
                      ? { scale: 1.02 }
                      : {}
                  }
                  whileTap={
                    !(
                      lastResult?.concluded ||
                      !guess.trim() ||
                      (attemptsLeft !== undefined && attemptsLeft <= 0)
                    )
                      ? { scale: 0.98 }
                      : {}
                  }
                >
                  <span className="relative z-10 flex items-center gap-2">Submit</span>
                </motion.button>
              </div>
            </div>
          </form>

          {hintsUnlocked > 0 && current?.title && current?.artist && (
            <div className="mt-2 mb-4 text-center text-cyan-300 text-sm sm:text-base font-semibold">
              <p className="mb-1"> Hint Unlocked:</p>
              {hintsUnlocked >= 1 && <p> Title: {formatInitials(current.title, hintsUnlocked)}</p>}
              {hintsUnlocked >= 2 && (
                <p> Artist: {formatInitials(current.artist, hintsUnlocked - 1)}</p>
              )}
            </div>
          )}

          {/* Guess History */}
          <div
            className="rounded-2xl p-5 max-h-48 flex-grow overflow-y-auto pr-2"
            style={{ backgroundColor: COLORS.darkestblue }}
          >
            <h2 className="text-lg font-semibold mb-2">Your Guesses:</h2>
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
                style={{
                  backgroundColor: 'rgba(20, 61, 77, 0.65)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
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
                    style={{
                      background: 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)',
                      color: '#fff',
                    }}
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

export default MultiplayerGameHandler;
