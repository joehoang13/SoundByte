import React from 'react';
import { motion } from 'framer-motion';

type LeaderboardEntry = {
    id: string;
    name: string;
    score: number;
};

type Props = {
    players: LeaderboardEntry[];
    myUserId?: string;
    maxEntries?: number;
};

const LiveLeaderboard: React.FC<Props> = ({
    players,
    myUserId,
    maxEntries = 3,
}) => {

    // Sort players by score descending
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    // Limit to max entries
    const visiblePlayers = maxEntries
        ? sortedPlayers.slice(0, maxEntries)
        : sortedPlayers;

    return (
        <div
            className={`w-full rounded-2xl px-4 py-3 bg-darkblue/70 border border-white/10 backdrop-blur-md`}
            style={{
                boxShadow: '0 6px 24px rgba(15,193,233,0.20)',
            }}
        >
            {/* Header */}
            <div className="mb-2.5 flex items-center gap-1.5">
                <span className='text-white'>ᯓ♪</span>
                <h3 className="text-sm font-bold text-[#E6F6FA]">
                    Leaderboard
                </h3>
            </div>

            {/* Player List */}
            <div className="space-y-1.5">
                {visiblePlayers.map((player, index) => {
                    const rank = index + 1;
                    const isMe = player.id === myUserId;

                    return (
                        <motion.div
                            key={player.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className={`
                                rounded-lg overflow-hidden
                                ${isMe 
                                    ? 'bg-teal/25 border border-teal/50' 
                                    : 'bg-darkblue/65 border border-white/[0.08]'
                                }
                            `}
                            style={{
                                boxShadow: isMe ? '0 2px 12px rgba(15, 193, 233, 0.20)' : 'none',
                            }}
                        >
                            <div className="flex items-center justify-between px-2.5 py-1.5">
                                {/* Left: Rank + Name */}
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    
                                    {/* Rank */}
                                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/5 text-grayblue">
                                        {rank}
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`font-semibold truncate text-xs ${isMe ? 'text-[#E6F6FA]' : 'text-white'}`}>
                                                {player.name}
                                            </span>
                                            {isMe && (
                                                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-teal text-white">
                                                    YOU
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Score */}
                                <div className="flex-shrink-0 font-bold text-xs text-teal">
                                    {player.score}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Show more if there are more players */}
            {players.length > maxEntries && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-2 text-center text-[10px] text-grayblue"
                >
                    +{players.length - maxEntries} more
                </motion.div>
            )}
        </div>
    );
}

export default LiveLeaderboard;