import React, { useEffect, useState, useCallback, useRef } from 'react';
import useGameStore from '../../stores/GameSessionStore';
import { motion, useReducedMotion } from 'framer-motion';
import { Howl, Howler } from 'howler';
import { useSocketStore } from '../../stores/SocketStore';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../../stores/auth';
import discdb from '../../assets/disc.svg';
import needledb from '../../assets/needle.svg';
import type { Placing, RoundMeta } from '../../stores/GameSessionStore';
import LiveLeaderboard from '../LiveLeaderboard';

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
    attemptsLeft,
    correctAnswers,
    timeBonus,
    timeBonusTotal,
    fastestTime,
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
  const { disconnect } = useSocketStore();

  const [multiSongResults, setMultiSongResults] = useState<
    Array<{
      snippetId: string;
      songTitle: string;
      artistName: string;
      correct: boolean;
    }>
  >([]);

  const [leaderboardData, setLeaderboardData] = useState<
    Array<{
      id: string;
      name: string;
      score: number;
    }>
  >([]);

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

  const [guess, setGuess] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    correct: boolean;
    concluded: boolean;
    attempts: number;
    attemptsLeft: number;
    timeMs?: number;
  } | null>(null);

  const audioRef = useRef<Howl | null>(null);
  const timerRef = useRef<number | null>(null);
  const { socket } = useSocketStore();

  const TEAL_TINT_FILTER =
    'brightness(0) saturate(100%) invert(76%) sepia(63%) saturate(6240%) hue-rotate(157deg) brightness(101%) contrast(97%)';
  const shouldSpin = isPlaying && !shouldReduceMotion;
  const discTransition = shouldSpin
    ? { repeat: Infinity, repeatType: 'loop' as const, ease: [0, 0, 1, 1] as const, duration: 10 }
    : { duration: 0.2 };
  const needleTransition = { repeat: Infinity, duration: 2, ease: 'easeInOut' as const };

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
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!roomCode || !current?.snippetId || !guess || !socket) return;

      const g = guess.trim();
      if (!g) return;

      const elapsedMs = Date.now() - (guessStartTime ?? Date.now());
      const elapsedSeconds = Math.round((elapsedMs / 1000) * 100) / 100;

      socket.emit(
        'game:answer',
        {
          code: roomCode,
          userId,
          roundIndex: currentRound,
          guess: g,
          snippetSize,
          elapsedMs,
        },
        (res: any) => {
          if (!res) return;

          const attemptsNow = (guessHistory.length ?? 0) + 1;
          const attemptsLeftNow =
            typeof res.attemptsLeft === 'number' ? res.attemptsLeft : Math.max(0, 5 - attemptsNow);

          const lr = {
            correct: !!res.correct,
            concluded: !!res.concluded,
            attempts: attemptsNow,
            attemptsLeft: attemptsLeftNow,
            timeMs: res.timeMs,
          };
          setLastResult(lr);
          useGameStore.setState({ attemptsLeft: lr.attemptsLeft, lastResult: lr });

          if (!res.correct) setHintsUnlocked(prev => Math.min(prev + 1, 3));

          setGuessHistory(prev => [
            ...prev,
            {
              guessNum: prev.length + 1,
              userGuess: g,
              isCorrect: !!res.correct,
              timeTakenSec: elapsedSeconds,
            },
          ]);
          setGuess('');

          if (res.correct) {
            setCorrectAnswers(correctAnswers + 1);

            const tb = res.breakdown?.timeBonus || 0;
            setTimeBonus(timeBonus + tb);
            setTimeBonusTotal(timeBonusTotal + tb);

            if (elapsedSeconds < fastestTime) setFastestTime(elapsedSeconds);

            setMultiSongResults(prev => {
              const idx = prev.findIndex(r => r.snippetId === current.snippetId);
              const row = {
                snippetId: current.snippetId,
                songTitle: current.title || 'Unknown Song',
                artistName: current.artist || 'Unknown Artist',
                correct: true,
              };
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = row;
                return copy;
              }
              return [...prev, row];
            });
          } else if (res.concluded) {
            setStreak(0); // UI smoothing
            setMultiSongResults(prev => {
              const exists = prev.some(r => r.snippetId === current.snippetId);
              if (exists) return prev;
              return [
                ...prev,
                {
                  snippetId: current.snippetId,
                  songTitle: current.title || 'Unknown Song',
                  artistName: current.artist || 'Unknown Artist',
                  correct: false,
                },
              ];
            });
          }

          if (res.concluded || res.attemptsLeft === 0) {
            setTimeout(() => {
              handleNext();
            }, 400);
          }
        }
      );
    },
    [
      guess,
      roomCode,
      current?.snippetId,
      currentRound,
      userId,
      snippetSize,
      guessStartTime,
      guessHistory.length,
      correctAnswers,
      timeBonus,
      timeBonusTotal,
      fastestTime,
      current,
      setCorrectAnswers,
      setTimeBonus,
      setTimeBonusTotal,
      setFastestTime,
      setStreak,
      socket,
    ]
  );

  const handleNext = () => {
    const totalRounds = multiplayerQuestions.length;
    if (currentRound + 1 >= totalRounds) {
      // Wait for host to end the room.
      setIsWaiting(true);
      useGameStore.setState({ songResults: multiSongResults });
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
      setHintsUnlocked(0);
    }
  };

  // Host/non-host use the same Quit. Host's quit will broadcast game:end.
  // IMPORTANT: don't navigate/disconnect here; wait for `game:end` so
  // everyone (including host) gets the leaderboard payload.
  const handleQuitGame = async () => {
    // persist local results for EndScreen
    useGameStore.setState({ songResults: multiSongResults });

    if (socket && roomCode && userId) {
      // Wrap each emit in a Promise
      const leaveRoomPromise = new Promise<void>((resolve) => {
        socket.emit('leaveRoom', { roomId: roomCode, userId }, () => {
          resolve();
        });
      });

      const endGamePromise = new Promise<void>((resolve) => {
        socket.emit('endGame', { roomCode, userId }, () => {
          resolve();
        });
      });

      // Wait for both to complete
      await Promise.all([leaveRoomPromise, endGamePromise]);

      console.log('Both leaveRoom and endGame have completed.');
    }

    disconnect();
    navigate('/endscreen', {
      state: {
        roomCode,
        leaderboard: useGameStore.getState().leaderboard || [],
      },
    });
  };

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    // Server emits { roomCode, leaderboard } when host ends.
    const onEnd = (payload: any) => {
      const leaderboard: Placing[] = Array.isArray(payload) ? payload : payload?.leaderboard || [];

      // ✅ ensure everyone's Song Results make it to EndScreen (non-host too)
      useGameStore.setState({ songResults: multiSongResults });

      setLeaderboard(leaderboard);
      navigate('/endscreen', {
        state: {
          roomCode: (payload && payload.roomCode) || roomCode,
          leaderboard,
        },
      });
    };

    // Authoritative score/streak for THIS player
    const onScoreUpdate = (u: any) => {
      if (!u) return;
      if (userId && u.userId !== userId) return;
      setScore(u.score);
      setStreak(u.streak);
    };

    // Track per-round result (server-authoritative)
    const onRoundResult = (r: any) => {
      if (!r || r.userId !== userId) return;
      const row = {
        snippetId: r.snippetId,
        songTitle: r.title || 'Unknown Song',
        artistName: r.artist || 'Unknown Artist',
        correct: !!r.correct,
      };
      setMultiSongResults(prev => {
        const idx = prev.findIndex(x => x.snippetId === row.snippetId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        }
        return [...prev, row];
      });
    };

    const onLeaderboardUpdate = (data: any) => {
      console.log('📊 Leaderboard update:', data);

      // update local leaderboard display
      setLeaderboardData(data);

      // update global store leaderboard
      setLeaderboard(data);
    };

    socket.on('game:end', onEnd);
    socket.on('game:scoreUpdate', onScoreUpdate);
    socket.on('game:roundResult', onRoundResult);
    socket.on('game:leaderboardUpdate', onLeaderboardUpdate);
    return () => {
      socket.off('game:end', onEnd);
      socket.off('game:scoreUpdate', onScoreUpdate);
      socket.off('game:roundResult', onRoundResult);
      socket.off('game:leaderboardUpdate', onLeaderboardUpdate);
    };
  }, [socket, userId, roomCode, setScore, setStreak, setLeaderboard, navigate, multiSongResults]);

  // Volume
  useEffect(() => {
    Howler.volume(volume / 100);
    localStorage.setItem('sb_volume', String(volume));
  }, [volume]);

  // Load audio
  useEffect(() => {
    if (multiplayerQuestions[currentRound]?.audioUrl) {
      audioRef.current?.unload();
      audioRef.current = new Howl({
        src: [multiplayerQuestions[currentRound].audioUrl],
        html5: true,
        volume: 1.0,
      });
    }
    return () => {
      audioRef.current?.unload();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [multiplayerQuestions, currentRound]);

  // Round switch/UI resets
  useEffect(() => {
    setCurrent(multiplayerQuestions[currentRound]);
    setPlaybackCount(0);
    setHintsUnlocked(0);
    useGameStore.setState({ attemptsLeft: undefined, lastResult: undefined });
    setLastResult(null);
    setGuessHistory([]);
  }, [currentRound, multiplayerQuestions]);

  const startSnippetPlayback = () => {
    if (!audioRef.current || playbackCount >= 2) return;
    audioRef.current.stop();
    audioRef.current.seek(0);
    audioRef.current.play();
    setIsPlaying(true);
    setGuessStartTime(Date.now());
    setPlaybackCount(c => c + 1);
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
      if (timerRef.current) clearTimeout(timerRef.current);
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
  }, [currentRound, current?.snippetId, roomCode, userId, socket]);

  if (!current) return <div>Loading round...</div>;

  return isWaiting ? (
    <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
      <motion.div
        className="flex flex-col items-center gap-6 bg-darkblue/80 backdrop-blur-sm rounded-2xl p-12 shadow-lg text-white"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="w-20 h-20 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />

        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">Game Complete!</h2>
          <p className="text-xl text-grayblue">Waiting for other players to finish...</p>
        </div>
      </motion.div>
    </div>
  ) : (
    <>
      {/* Username Badge */}
      {user && (
        <div
          className="fixed top-6 left-6 z-[60] flex items-center gap-2.5 rounded-2xl px-4 py-3"
          style={{
            backgroundColor: 'rgba(20, 61, 77, 0.7)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 6px 24px rgba(15,193,233,0.20)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <span className="text-base font-bold" style={{ color: COLORS.teal }}>
                {username?.[0]?.toUpperCase() ?? 'P'}
              </span>
            )}
          </div>
          <div className="leading-tight">
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-base font-extrabold" style={{ color: '#E6F6FA' }}>
                {username}
              </div>
            </div>
            <div className="text-xs" style={{ color: COLORS.grayblue }}>
              online
            </div>
          </div>

          {/* Settings button */}
          <motion.button
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors ml-2"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSettingsOpen(true)}
            aria-label="Open Settings"
            title="Settings"
          >
            <span className="text-white text-2xl -mt-0.5"> ⚙︎ </span>
          </motion.button>
        </div>
      )}

      {leaderboardData.length > 0 && (
        <motion.div
          className="fixed top-6 right-4 z-[60] w-64 max-h-[calc(100vh-3rem)]"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <LiveLeaderboard players={leaderboardData} myUserId={userId} />
        </motion.div>
      )}

      <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
        <motion.div
          className="flex flex-col bg-darkblue/80 backdrop-blur-sm rounded-2xl w-full max-w-[900px] min-h-[90dvh] sm:min-h-[500px] h-auto shadow-lg relative text-white p-4 sm:p-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* Progress Bar */}
          <div
            className="w-full h-3 rounded-full mb-6 overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${
                  ((currentRound + (lastResult?.concluded ? 1 : 0)) / multiplayerQuestions.length) *
                  100
                }%`,
                background: 'linear-gradient(90deg, #0FC1E9 0%, #3B82F6 100%)',
                transition: 'width 0.5s ease-in-out',
              }}
            />
          </div>

          {/* Score / Streak Panel */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-4">
            <div className="flex-1 flex justify-center">
              <div
                className="flex items-center gap-2 rounded-full px-5 py-2 backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(20, 61, 77, 0.65)' }}
              >
                <span className="text-sm font-bold text-center">Score</span>
                <span className="text-2xl font-bold text-center">{score}</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <h1 className="text-2xl font-bold text-center">Round {currentRound + 1}</h1>
            </div>
            <div className="flex-1 flex justify-center">
              <div
                className="flex items-center gap-2 rounded-full px-5 py-2 backdrop-blur-sm"
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

          {/* Status */}
          <div className="flex items-center justify-center w-full px-4 sm:px-6 mb-4">
            {isPlaying ? (
              <motion.div
                className="text-sm text-center"
                style={{ color: COLORS.grayblue }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                now playing… (click the record to stop)
              </motion.div>
            ) : (
              <div className="text-sm text-center text-grayblue">
                {playbackCount >= 2
                  ? 'No more replays for this round'
                  : 'Ready — Click the Record to Play'}
              </div>
            )}
          </div>

          {/* Guess Input */}
          <form onSubmit={handleGuessSubmit} className="relative mb-6">
            <div className="relative bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-cyan-400/20 p-[2px] rounded-2xl">
              <div className="flex bg-darkblue/90 rounded-2xl overflow-hidden backdrop-blur-sm">
                <input
                  type="text"
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && guess.trim()) handleGuessSubmit(e as any);
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

            <div className="grid grid-cols-1 gap-6">
              <section
                className="rounded-2xl p-5 max-w-2xl mx-auto w-full"
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
