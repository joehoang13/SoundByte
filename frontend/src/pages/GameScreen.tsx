// src/pages/GameScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Howl, Howler } from 'howler';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../stores/GameSessionStore';
import { motion, useReducedMotion, type Transition } from 'framer-motion';
import discdb from '../../public/discdb.png';
import needledb from '../../public/needledb.png';
import { io, Socket } from 'socket.io-client';

import { useAuth } from '../stores/auth';
import { logout } from '../api/auth';

/**
 * GameScreen — Classic mode + Party (Socket.IO)
 * - Solo / Group switch (fixed top-center, outside the card)
 * - Group lobby: create/join room, invite link, show players, choose game mode
 * - Username badge (top-left) kept
 * - No autoplay: click the disc to start/pause/replay
 * - Settings modal (players, volume, back, logout)
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

type Player = {
  id: string;
  name: string;
  avatarUrl?: string;
};

const COLORS = {
  grayblue: '#90A4AB',
  darkblue: '#274D5B',
  teal: '#0FC1E9',
  darkestblue: '#143D4D',
};

const EASE_LINEAR: [number, number, number, number] = [0, 0, 1, 1];
const EASE_IN_OUT: [number, number, number, number] = [0.42, 0, 0.58, 1];

// Teal-ish filter for PNG tinting
const TEAL_TINT_FILTER =
  'brightness(0) saturate(100%) invert(76%) sepia(63%) saturate(6240%) hue-rotate(157deg) brightness(101%) contrast(97%)';

type PartyMode = 'solo' | 'group';
type GroupGameMode = 'classic' | 'inference';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

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

  const { user } = useAuth();
  const username = user?.username ?? 'Player';
  const avatarUrl = user?.avatarUrl as string | undefined;

  // local players list (store may or may not have one)
  // @ts-ignore optional players in store
  const storePlayers: Player[] = useGameStore.getState?.().players ?? [];

  const [guess, setGuess] = useState('');
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [guessHistory, setGuessHistory] = useState<GuessRow[]>([]);
  const [modeOpen, setModeOpen] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const shouldReduceMotion = useReducedMotion();
  const howl = useHowl(current?.audioUrl, true);

  const stopTimerRef = useRef<number | undefined>(undefined);
  const startedOnceRef = useRef(false);
  const roundStartMsRef = useRef<number>(Date.now());
  const remainingMsRef = useRef<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const animRef = useRef<number | null>(null);

  const snippetSeconds = useMemo(() => snippetSize ?? 5, [snippetSize]);

  // ───────────────────── Socket.IO / Group Lobby ─────────────────────
  const socketRef = useRef<Socket | null>(null);
  const [partyMode, setPartyMode] = useState<PartyMode>('solo');
  const [roomId, setRoomId] = useState<string>('');
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [groupGameMode, setGroupGameMode] = useState<GroupGameMode>('classic');
  const [socketStatus, setSocketStatus] = useState<'disconnected' | 'connecting' | 'connected'>(
    'disconnected'
  );

  // connect socket once
  useEffect(() => {
    if (socketRef.current) return;
    setSocketStatus('connecting');
    const s = io(SOCKET_URL, {
      transports: ['websocket'],
      withCredentials: true,
    });
    socketRef.current = s;

    s.on('connect', () => {
      setSocketStatus('connected');
      // say hello so server can track display name
      s.emit('lobby:hello', { name: username });
    });

    s.on('disconnect', () => setSocketStatus('disconnected'));

    // room created / joined / updates
    s.on('room:created', ({ roomId: id, players }: { roomId: string; players: Player[] }) => {
      setRoomId(id);
      setLobbyPlayers(players || []);
    });
    s.on('room:joined', ({ roomId: id, players }: { roomId: string; players: Player[] }) => {
      setRoomId(id);
      setLobbyPlayers(players || []);
    });
    s.on('room:left', () => {
      setRoomId('');
      setLobbyPlayers([]);
    });
    s.on('lobby:update', ({ roomId: id, players }: { roomId: string; players: Player[] }) => {
      if (id) setRoomId(id);
      setLobbyPlayers(players || []);
    });

    return () => {
      try {
        s.disconnect();
      } catch { }
      socketRef.current = null;
    };
  }, [username]);

  const createRoom = () => {
    socketRef.current?.emit('createRoom', { name: username });
  };
  const joinRoom = (code: string) => {
    if (!code.trim()) return;
    socketRef.current?.emit('joinRoom', { roomId: code.trim(), name: username });
  };
  const leaveRoom = () => {
    socketRef.current?.emit('leaveRoom', { roomId });
  };

  // invite link builder
  const inviteUrl = useMemo(() => {
    if (!roomId) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    return url.toString();
  }, [roomId]);

  // auto-join if ?room=ID present and in Group
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('room');
    if (partyMode === 'group' && r && !roomId) {
      joinRoom(r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyMode]);

  // ─────────────────────────── Core game ────────────────────────────

  // Start session once
  useEffect(() => {
    if (!sessionId && !loading) start(userId || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, loading, start, userId]);

  // Prepare round when audio changes (NO AUTOPLAY)
  useEffect(() => {
    setGuess('');
    setReady(false);
    setReplayCount(0);
    setGuessHistory([]);
    startedOnceRef.current = false;

    setIsPlaying(false);
    setIsPaused(false);
    setIsFinished(false);
    remainingMsRef.current = snippetSeconds * 1000;

    const h = howl.current;
    if (!h) return;

    const handleLoad = () => setReady(true);
    h.once('load', handleLoad);

    return () => {
      window.clearTimeout(stopTimerRef.current);
      teardownAnalyser();
      h.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [howl, current?.audioUrl, snippetSeconds]);

  // Stop on conclusion
  useEffect(() => {
    if (lastResult?.concluded) finishWindow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastResult?.concluded]);

  async function startWindowPlay(windowMs: number) {
    const h = howl.current;
    if (!h || windowMs <= 0) return finishWindow();

    if (!startedOnceRef.current) {
      startedOnceRef.current = true;
      try {
        await markRoundStarted();
      } catch { }
    }

    setIsPlaying(true);
    setIsPaused(false);
    setIsFinished(false);
    roundStartMsRef.current = Date.now();

    setupAnalyser();
    h.play();

    window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = window.setTimeout(() => {
      if (howl.current?.playing()) {
        howl.current.stop();
      }
      finishWindow();
    }, windowMs) as unknown as number;

  }

  function pauseWindow() {
    if (!howl.current || !isPlaying) return;
    const elapsed = Date.now() - roundStartMsRef.current;
    remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsed);
    window.clearTimeout(stopTimerRef.current);
    howl.current.pause();
    setIsPlaying(false);
    setIsPaused(true);
    teardownAnalyser();
  }

  function finishWindow(forceStopAudio = false) {
    const h = howl.current;
    window.clearTimeout(stopTimerRef.current);
    if (h) forceStopAudio ? h.stop() : h.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setIsFinished(true);
    remainingMsRef.current = 0;
    teardownAnalyser();
  }

  function replayWindow() {
    if (replayCount >= 1 || !ready || !howl.current) return;
    remainingMsRef.current = snippetSeconds * 1000;
    setReplayCount(c => c + 1);
    startWindowPlay(remainingMsRef.current);
  }

  // Visualizer
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
      } catch { }
      try {
        analyser.connect(ctx.destination);
      } catch { }

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyserRef.current = analyser;
      dataArrayRef.current = data;

      drawBars();
    } catch { }
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

  // Submit guess
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const g = guess.trim();
    if (!g) return;

    const res = await submitGuess(g);
    const elapsedMs = Date.now() - roundStartMsRef.current;
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

  // Disc click handler
  const onDiscClick = () => {
    if (!ready || !howl.current) return;
    if (!isPlaying && !isPaused && !isFinished) return startWindowPlay(remainingMsRef.current);
    if (isPlaying) return pauseWindow();
    if (isPaused && !isFinished) return startWindowPlay(remainingMsRef.current);
    if (isFinished) return replayWindow();
  };

  const concluded = !!lastResult?.concluded;
  const disable = !ready || concluded || (attemptsLeft !== undefined && attemptsLeft <= 0);

  const shouldSpin = isPlaying && !shouldReduceMotion;
  const discTransition: Transition = shouldSpin
    ? { repeat: Infinity, repeatType: 'loop', ease: EASE_LINEAR, duration: 10 }
    : { duration: 0.2 };
  const needleTransition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { repeat: Infinity, duration: 2, ease: EASE_IN_OUT };

  const handleLogout = async () => {
    await logout().catch(() => { });
    try {
      localStorage.removeItem('token');
    } catch { }
    navigate('/welcome');
  };

  // merged list for Settings modal (self + others)
  const settingsPlayers: Player[] = [
    ...(user ? [{ id: 'self', name: username, avatarUrl }] : []),
    ...(roomId ? lobbyPlayers : storePlayers),
  ];

  return (
    <>
      {/* USERNAME BADGE — fixed, outside the card */}
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
              {socketStatus === 'connected' ? 'online' : socketStatus}
            </div>
          </div>
        </div>
      )}

      {/* SOLO / GROUP SWITCH — fixed, top-center */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60]">
        <div
          className="flex items-center gap-1 rounded-full px-1 py-1"
          style={{
            backgroundColor: 'rgba(20, 61, 77, 0.7)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(6px)',
          }}
        >
          {(['solo', 'group'] as PartyMode[]).map(mode => (
            <button
              key={mode}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition"
              style={{
                background:
                  partyMode === mode ? 'linear-gradient(90deg, #0FC1E9, #3B82F6)' : 'transparent',
                color: partyMode === mode ? '#fff' : COLORS.grayblue,
              }}
              onClick={() => setPartyMode(mode)}
            >
              {mode === 'solo' ? 'Solo' : 'Group'}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
        <motion.div
          className="flex flex-col bg-darkblue/80 backdrop-blur-sm rounded-2xl w-full max-w-[900px] min-h-[90dvh] sm:min-h-[500px] h-auto shadow-lg relative text-white p-4 sm:p-10"
          style={{ backgroundColor: COLORS.darkblue }}
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
              <path d="M19.43 12.98a7.94 7.94 0 0 0 .05-.98 7.94 7.94 0 0 0-.05-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.78 7.78 0 0 0-1.7-.98l-.38-2.65A.5.5 0 0 0 12 1h-4a.5.5 0 0 0-.49.41l-.38 2.65c-.62.24-1.2.56-1.74.95l-2.47-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64L2.57 11a7.94 7.94 0 0 0-.05.98c0 .33.02.66.05.98L.46 14.61a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.54.39 1.13.71 1.74.95l.38 2.65A.5.5 0 0 0 8 23h4a.5.5 0 0 0 .49-.41l.38-2.65c.62-.24 1.2-.56 1.74-.95l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64L19.43 12.98z" fill="currentColor" />
            </svg>
          </motion.button>

          {/* ───────────── Main area: Solo OR Group ───────────── */}
          {partyMode === 'group' ? (
            // GROUP LOBBY
            <div className="flex flex-col gap-6">
              <header className="text-center">
                <h1 className="text-2xl font-bold">Group Lobby</h1>
                <p className="text-sm mt-1" style={{ color: COLORS.grayblue }}>
                  Invite friends or join a room. Choose a game mode and start together.
                </p>
              </header>

              {/* Create / Join */}
              {!roomId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    className="rounded-2xl p-5"
                    style={{ backgroundColor: 'rgba(20,61,77,0.65)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <h3 className="font-semibold mb-3">Create a Room</h3>
                    <motion.button
                      type="button"
                      onClick={createRoom}
                      className="w-full px-4 py-2 rounded-xl font-semibold"
                      style={{ background: 'linear-gradient(90deg, #0FC1E9 0%, #3B82F6 100%)', color: '#fff' }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Create Room
                    </motion.button>
                  </div>

                  <div
                    className="rounded-2xl p-5"
                    style={{ backgroundColor: 'rgba(20,61,77,0.65)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <h3 className="font-semibold mb-3">Join a Room</h3>
                    <div className="flex gap-2">
                      <input
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value)}
                        placeholder="Enter room code"
                        className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 outline-none"
                      />
                      <motion.button
                        type="button"
                        onClick={() => joinRoom(joinCode)}
                        className="px-4 py-2 rounded-xl font-semibold"
                        style={{ background: 'linear-gradient(90deg, #0FC1E9 0%, #3B82F6 100%)', color: '#fff' }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Join
                      </motion.button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Room info + invite */}
                  <div
                    className="rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 justify-between"
                    style={{ backgroundColor: 'rgba(20,61,77,0.65)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div>
                      <div className="text-sm" style={{ color: COLORS.grayblue }}>
                        Room ID
                      </div>
                      <div className="text-lg font-semibold">{roomId}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={inviteUrl}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 w-[320px] text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => inviteUrl && navigator.clipboard.writeText(inviteUrl)}
                        className="px-3 py-2 rounded-xl border border-white/10 hover:bg-white/10 text-sm"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={leaveRoom}
                        className="px-3 py-2 rounded-xl border border-red-500 text-red-300 hover:bg-red-500/10 text-sm"
                      >
                        Leave
                      </button>
                    </div>
                  </div>

                  {/* Game mode & players */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <section
                      className="rounded-2xl p-5 flex flex-col gap-4"
                      style={{ backgroundColor: 'rgba(20,61,77,0.65)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <h3 className="font-semibold">Game Mode</h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setGroupGameMode('classic')}
                          className="px-4 py-2 rounded-xl font-semibold"
                          style={{
                            background:
                              groupGameMode === 'classic'
                                ? 'linear-gradient(90deg, #0FC1E9, #3B82F6)'
                                : 'rgba(255,255,255,0.06)',
                            color: groupGameMode === 'classic' ? '#fff' : COLORS.grayblue,
                          }}
                        >
                          Classic
                        </button>
                        <button
                          type="button"
                          onClick={() => setGroupGameMode('inference')}
                          className="px-4 py-2 rounded-xl font-semibold"
                          style={{
                            background:
                              groupGameMode === 'inference'
                                ? 'linear-gradient(90deg, #0FC1E9, #3B82F6)'
                                : 'rgba(255,255,255,0.06)',
                            color: groupGameMode === 'inference' ? '#fff' : COLORS.grayblue,
                          }}
                        >
                          Inference
                        </button>
                      </div>

                      <motion.button
                        type="button"
                        onClick={() =>
                          groupGameMode === 'classic'
                            ? navigate('/gamescreen')
                            : navigate('/inference')
                        }
                        className="mt-2 px-4 py-2 rounded-xl font-semibold"
                        style={{ background: 'linear-gradient(90deg, #0FC1E9 0%, #3B82F6 100%)', color: '#fff' }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Start Game
                      </motion.button>
                    </section>

                    <section
                      className="lg:col-span-2 rounded-2xl p-5"
                      style={{ backgroundColor: 'rgba(20,61,77,0.65)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <header className="flex items-center justify-between mb-4">
                        <h3 className="text-lg sm:text-xl font-semibold">Lobby</h3>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full border"
                          style={{
                            borderColor: COLORS.teal,
                            color: COLORS.grayblue,
                            backgroundColor: 'rgba(20, 61, 77, 0.35)',
                          }}
                        >
                          {lobbyPlayers.length + 1} {lobbyPlayers.length + 1 === 1 ? 'player' : 'players'}
                        </span>
                      </header>

                      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {/* you */}
                        <li
                          key="self"
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold">{username[0].toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate" style={{ color: COLORS.teal }}>
                              {username}
                            </div>
                            <div className="text-xs" style={{ color: COLORS.grayblue }}>
                              You
                            </div>
                          </div>
                        </li>

                        {lobbyPlayers.map(p => (
                          <li
                            key={p.id}
                            className="flex items-center gap-3 p-3 rounded-xl"
                            style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm font-bold">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{p.name || 'Player'}</div>
                              <div className="text-xs" style={{ color: COLORS.grayblue }}>
                                Ready
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                </>
              )}
            </div>
          ) : (
            // SOLO GAME (your original card)
            <>
              {/* Header */}
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

                  {/* Gamemode pill */}
                  <div className="mt-2 relative">
                    <button
                      type="button"
                      onClick={() => setModeOpen(o => !o)}
                      onBlur={() => setTimeout(() => setModeOpen(false), 150)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm tracking-wide"
                      style={{
                        borderColor: COLORS.teal,
                        backgroundColor: 'rgba(20, 61, 77, 0.4)',
                        color: COLORS.grayblue,
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={modeOpen}
                    >
                      <span className="inline-block rounded-full" style={{ width: 8, height: 8, backgroundColor: COLORS.teal }} />
                      Classic Mode
                      <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-80">
                        <path fill="currentColor" d="M7 10l5 5 5-5z" />
                      </svg>
                    </button>

                    {modeOpen && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 rounded-xl border shadow-lg overflow-hidden z-20"
                        role="listbox"
                        style={{
                          backgroundColor: COLORS.darkestblue,
                          borderColor: 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => navigate('/gamescreen')}
                        >
                          Classic Mode
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                          onMouseDown={(e) => e.preventDefault()}
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
                    className="flex flex-col items-center rounded-xl w-44 px-6 py-5"
                    style={{ backgroundColor: 'rgba(20, 61, 77, 0.65)' }}
                  >
                    <span className="text-sm font-bold text-center">Streak</span>
                    <span className="text-2xl font-bold text-center">{streak}</span>
                  </div>
                </div>
              </div>

              {/* Disc + needle control */}
              <div className="flex items-center justify-center w-full px-4 sm:px-6 mt-2 mb-4">
                <div className="relative w-28 h-28">
                  <motion.img
                    src={discdb}
                    alt="Vinyl control"
                    className="w-28 h-28 select-none cursor-pointer"
                    draggable={false}
                    onDragStart={e => e.preventDefault()}
                    initial={{ rotate: 0 }}
                    animate={shouldSpin ? { rotate: 360 } : { rotate: 0 }}
                    transition={discTransition}
                    whileHover={!shouldReduceMotion ? { scale: 1.03 } : undefined}
                    whileTap={!shouldReduceMotion ? { scale: 0.98 } : undefined}
                    onClick={onDiscClick}
                    style={{
                      willChange: 'transform',
                      filter: TEAL_TINT_FILTER,
                      boxShadow: '0 0 20px rgba(15, 193, 233, 0.35)',
                      borderRadius: '50%',
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

              {/* Status / visualizer */}
              <div className="flex items-center justify-center w-full rounded-lg px-4 sm:px-6">
                {isPlaying ? (
                  <div className="flex flex-col items-center py-2 mb-2 w-full">
                    <canvas
                      ref={canvasRef}
                      width={800}
                      height={80}
                      className="w-full h-full mb-3"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <motion.div
                      className="text-sm"
                      style={{ color: COLORS.grayblue }}
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      now playing… (click the record to pause)
                    </motion.div>
                  </div>
                ) : (
                  <div className="text-center mb-2" style={{ color: COLORS.grayblue }}>
                    {isFinished
                      ? replayCount < 1
                        ? 'Snippet Finished — Click the Record to Replay'
                        : 'No more replays for this round'
                      : ready
                        ? 'Ready — Click the Record to Play'
                        : 'Loading…'}
                  </div>
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
                      onKeyDown={e => { if (e.key === 'Enter' && guess.trim()) onSubmit(e as any); }}
                      placeholder={concluded ? 'Round concluded' : '                          Enter your answer here'}
                      className="flex-1 p-5 text-base sm:text-lg bg-transparent text-white placeholder-gray-300 text-center focus:outline-none transition-all duration-300 focus:placeholder-transparent disabled:opacity-60"
                      disabled={disable}
                      autoFocus
                    />
                    <motion.button
                      type="submit"
                      disabled={disable || !guess.trim()}
                      className={`px-8 font-bold py-5 text-base transition-all duration-300 whitespace-nowrap relative overflow-hidden ${disable || !guess.trim()
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

              {/* Guess history */}
              <div
                className="rounded-2xl p-5 max-h-48 flex-grow overflow-y-auto pr-2"
                style={{ backgroundColor: COLORS.darkestblue }}
              >
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
            </>
          )}
        </motion.div>
      </div>

      {/* SETTINGS MODAL */}
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
                    {settingsPlayers.length}{' '}
                    {settingsPlayers.length === 1 ? 'player' : 'players'}
                  </span>
                </header>

                <ul className="grid grid-cols-1 gap-3">
                  {settingsPlayers.map(p => (
                    <li
                      key={p.id}
                      className="w-full flex items-center gap-4 p-4 rounded-xl"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                    >
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold">{p.name?.[0]?.toUpperCase() ?? 'P'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate" style={{ color: p.id === 'self' ? COLORS.teal : undefined }}>
                          {p.name || 'Player'}
                        </div>
                        <div className="text-xs" style={{ color: COLORS.grayblue }}>
                          {p.id === 'self' ? 'You' : 'Ready'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
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
    </>
  );
};

export default GameScreen;
