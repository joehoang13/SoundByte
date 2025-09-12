import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import useGameStore from '../stores/GameSessionStore';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../stores/auth';
import GamePrefModal from '../components/GameSteps/GamePrefModal';

type Player = {
    id: string;
    name: string;
    avatarUrl?: string;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

const GroupLobby: React.FC = () => {

    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const username = user?.username ?? 'Player';
    const avatarUrl = user?.avatarUrl as string | undefined;
    // local players list (store may or may not have one)
    // @ts-ignore optional players in store
    const storePlayers: Player[] = useGameStore.getState?.().players ?? [];
    const [showGamePrefs, setShowGamePrefs] = useState(false);

    const modalState = location.state as {
        fromModal?: boolean;
        modalStep?: 'playMode' | 'createOrJoin' | 'gameMode' | 'difficulty';
        playMode?: string;
        createOrJoin?: 'create' | 'join';
        role?: 'join' | 'create';
        // role?: 'create' // for testing
        gameMode?: string;
        snippetLength?: number;
    } | null;


    const role = modalState?.role || 'create';
    // const role = 'create'; // for testing
    const gameMode = modalState?.gameMode || 'classic';
    const snippetLength = modalState?.snippetLength;


    // ───────────────────── Socket.IO / Group Lobby ─────────────────────
    const socketRef = useRef<Socket | null>(null);
    const [roomId, setRoomId] = useState<string>('');
    const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>(storePlayers);
    // const [roomId, setRoomId] = useState<string>('DEMO123'); // for testing
    {/* const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([
        // MOCK DATA FOR TESTING
        { id: '1', name: 'Alex', avatarUrl: undefined },
        { id: '2', name: 'Sam', avatarUrl: undefined },
        { id: '3', name: 'Jordan', avatarUrl: undefined },
    ]); */}
    const [joinCode, setJoinCode] = useState('');
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
            if (role === 'create') {
                setTimeout(() => createRoom(), 100); // Small delay to ensure connection is stable
            }
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

    // auto-join if ?room=ID present and in join mode
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        if (role === 'join' && roomParam && !roomId && socketStatus === 'connected') {
            joinRoom(roomParam);
        }
    }, [role, roomId, socketStatus]);

    const handleStartGame = () => {
        if (gameMode === 'classic') {
            navigate('/gamescreen');
        } else if (gameMode === 'inference') {
            navigate('/inference');
        }
    };

    const handleBackToMenu = () => {
        if (modalState?.fromModal) {
            setShowGamePrefs(true);
        } else {
            navigate('/');
        }
    };

    const handleGamePrefsClose = () => {
        setShowGamePrefs(false);
        navigate('/');
    };

    return (
        <>
            {/* MAIN CARD */}
            <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
                <motion.div
                    className="flex flex-col bg-darkblue/80 backdrop-blur-sm rounded-2xl w-full max-w-[900px] min-h-[90dvh] sm:min-h-[500px] h-auto shadow-lg relative text-white p-4 sm:p-10"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                    <header className="text-center mb-8">
                        <h1 className="text-3xl font-bold mb-2 text-cyan-400" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.5)' }}>
                            Group Lobby
                        </h1>
                        <p className="text-sm text-grayblue">
                            {role === 'create' ? 'You are hosting this game' : 'You joined this game'}
                        </p>
                        {gameMode && roomId && (
                            <div className="mt-2 inline-block px-3 py-1 rounded-full border border-teal bg-darkestblue/40 text-sm text-grayblue">
                                {gameMode === 'classic' ? 'Classic Mode' : 'Inference Mode'}
                                {snippetLength && gameMode === 'classic' && ` • ${snippetLength}s clips`}
                            </div>
                        )}

                        <div className="text-xs text-gray-400 mt-4">
                            Status: {socketStatus}, Role: {role}, Room: {roomId || '—'}
                        </div>

                    </header>

                    <button
                        onClick={handleBackToMenu}
                        className="fixed top-6 left-6 z-[60] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                    >
                        ←
                    </button>

                    <div className="flex flex-col gap-6">

                        {role === 'join' && !roomId && (
                            <div className="rounded-2xl p-5 bg-darkestblue/65 mb-3 flex flex-col gap-3">
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
                                        style={{
                                            background: 'linear-gradient(90deg, #0FC1E9 0%, #3B82F6 100%)',
                                            color: '#fff',
                                        }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        Join
                                    </motion.button>
                                </div>
                            </div>
                        )}

                        {roomId && (
                            <>
                                {/* Room info + invite */}
                                <div className="rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 justify-between bg-darkestblue/65 mb-3">
                                    <div>
                                        <div className="text-sm text-grayblue">Room ID</div>
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
                                <div className="rounded-2xl p-5 bg-darkestblue/65 mb-3 flex-1">
                                    <header className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg sm:text-xl font-semibold">Lobby</h3>
                                        <span
                                            className="text-xs px-2 py-0.5 rounded-full border border-teal text-grayblue"
                                            style={{
                                                backgroundColor: 'rgba(20, 61, 77, 0.35)',
                                            }}
                                        >
                                            {lobbyPlayers.length + 1}{' '}
                                            {lobbyPlayers.length + 1 === 1 ? 'player' : 'players'}
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
                                                    <img
                                                        src={avatarUrl}
                                                        alt={username}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-bold">{username[0].toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold truncate text-teal">
                                                    {username}
                                                </div>
                                                <div className="text-xs text-grayblue">
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
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold truncate">{p.name || 'Player'}</div>
                                                    <div className="text-xs text-grayblue">
                                                        Ready
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </>
                        )}
                    </div>
                    {/* Game Controls */}
                    <div className="flex flex-col gap-4 justify-center items-center mt-2">
                        <div className="text-sm text-grayblue text-center">
                            {lobbyPlayers.length + 1 >= 2 ? (
                                role === 'create' ?
                                    'Ready to start! Click Start Game when everyone is ready.' :
                                    'Waiting for host to start the game...'
                            ) : (
                                'Need at least 2 players to start'
                            )}
                        </div>

                        <div className="flex gap-3">
                            {role === 'create' && roomId && (
                                <motion.button
                                    onClick={handleStartGame}
                                    disabled={lobbyPlayers.length + 1 < 2}
                                    className={`px-8 py-3 rounded-xl font-semibold ${lobbyPlayers.length + 1 >= 2
                                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                                        : 'bg-gray-600/50 cursor-not-allowed text-gray-400'
                                        }`}
                                    whileHover={lobbyPlayers.length + 1 >= 2 ? { scale: 1.02 } : {}}
                                    whileTap={lobbyPlayers.length + 1 >= 2 ? { scale: 0.98 } : {}}
                                >
                                    Start Game
                                </motion.button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>

            {showGamePrefs && (
                <GamePrefModal
                    onClose={handleGamePrefsClose}
                    initialStep={
                        (modalState?.modalStep as 'playMode' | 'gameMode' | 'difficulty') || 'playMode'
                    }
                    initialValues={{
                        playMode: modalState?.playMode,
                        createOrJoin: modalState?.createOrJoin,
                        gameMode: modalState?.gameMode,
                        snippetLength: modalState?.snippetLength,
                    }}
                />
            )}
        </>
    );
};

export default GroupLobby;