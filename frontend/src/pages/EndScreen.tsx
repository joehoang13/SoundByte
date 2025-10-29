import { useNavigate } from 'react-router-dom';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useState, useEffect } from 'react';
import useGameStore from '../stores/GameSessionStore';

const allTabs = [
  { id: 'overview', label: 'Overview', showInModes: ['classic', 'inference', 'multiplayer'] },
  { id: 'leaderboard', label: 'Leaderboard', showInModes: ['multiplayer'] },
  {
    id: 'songresults',
    label: 'Song Results',
    showInModes: ['classic', 'inference', 'multiplayer'],
  },
];

const EndScreen = () => {
  const navigate = useNavigate();
  const score = useGameStore(s => s.score);
  const correctAnswers = useGameStore(s => s.correctAnswers);
  const streak = useGameStore(s => s.streak);
  const fastestTime = useGameStore(s => s.fastestTime);
  const timeBonus = useGameStore(s => s.timeBonus);
  const songResults = useGameStore(s => s.songResults);
  const mode = useGameStore(s => s.mode);
  const reset = useGameStore(s => s.reset);

  const currentRound = useGameStore(s => s.currentRound);
  const rounds = useGameStore(s => s.rounds);
  const isComplete = currentRound + 1 >= rounds;

  const [showEarlyQuitModal, setShowEarlyQuitModal] = useState(!isComplete);

  const tabs = allTabs.filter(tab => tab.showInModes.includes(mode));
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const animatedScore = useSpring(0, { duration: 2000 });
  const animatedCorrectAnswers = useSpring(0, { duration: 1000 });
  const animatedStreak = useSpring(0, { duration: 1000 });
  const animatedTimeBonus = useSpring(0, { duration: 2000 });

  useEffect(() => {
    animatedScore.set(score);
    animatedCorrectAnswers.set(correctAnswers);
    animatedStreak.set(streak);
    animatedTimeBonus.set(timeBonus);
  }, [score, correctAnswers, streak, timeBonus]);

  const displayScore = useTransform(animatedScore, value => Math.floor(value));
  const displayCorrectAnswers = useTransform(animatedCorrectAnswers, value => Math.floor(value));
  const displayStreak = useTransform(animatedStreak, value => Math.floor(value));
  const displayTimeBonus = useTransform(animatedTimeBonus, value => Math.floor(value));

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="flex flex-col items-center w-full">
            <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-full h-20 mb-3">
              <motion.span className="text-xl font-bold text-center">{displayScore}</motion.span>
              <span className="text-sm text-center">Final Score</span>
            </div>

            <div className="flex flex-row justify-between items-center gap-4 w-full">
              <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                <motion.span className="text-xl font-bold text-center">
                  {displayCorrectAnswers}
                </motion.span>
                <span className="text-sm text-center">Correct Answers</span>
              </div>
              <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                <motion.span className="text-xl font-bold text-center">{displayStreak}</motion.span>
                <span className="text-sm text-center">Streak</span>
              </div>
            </div>

            <div className="flex flex-row justify-between items-center gap-4 w-full">
              <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                <span className="text-xl font-bold text-center">
                  {fastestTime === Infinity ? 'N/A' : `${fastestTime}s`}
                </span>
                <span className="text-sm text-center">Fastest Time</span>
              </div>
              <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                <motion.span className="text-xl font-bold text-center">
                  {displayTimeBonus}
                </motion.span>
                <span className="text-sm text-center">Time Bonus</span>
              </div>
            </div>
          </div>
        );

      case 'leaderboard':
        return (
          <div className="flex flex-col items-center w-full space-y-3">
            <h3 className="text-lg font-semibold mb-2">Top Players</h3>
            {/* Placeholder for leaderboard data */}
            {[
              { rank: 1, name: 'You', score: score, highlight: true },
              { rank: 2, name: 'Player2', score: 8500 },
              { rank: 3, name: 'Player3', score: 7200 },
              { rank: 4, name: 'Player4', score: 6800 },
              { rank: 5, name: 'Player5', score: 6100 },
            ].map(player => (
              <div
                key={player.rank}
                className={`flex justify-between items-center w-full px-4 py-3 rounded-xl ${
                  player.highlight ? 'bg-teal/20 border border-teal' : 'bg-darkestblue'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold w-6">{player.rank}</span>
                  <span className={player.highlight ? 'font-semibold' : ''}>{player.name}</span>
                </div>
                <span className="font-bold">{player.score}</span>
              </div>
            ))}
          </div>
        );

      case 'songresults':
        return (
          <div className="flex flex-col items-center w-full space-y-3">
            <h3 className="text-lg font-semibold mb-2">Your Song Results</h3>

            {songResults.length === 0 ? (
              <p className="text-sm text-gray-400">No songs played yet</p>
            ) : (
              songResults.map((song, index) => (
                <div
                  key={song.snippetId || index}
                  className="flex justify-between items-center w-full px-4 py-3 rounded-xl bg-darkestblue"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{song.songTitle}</span>
                    <span className="text-xs text-gray-400">{song.artistName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">
                      {song.correct && song.timeMs ? `${(song.timeMs / 1000).toFixed(1)}s` : '—'}
                    </span>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        song.correct ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    >
                      {song.correct ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
      <motion.div
        className="backdrop-blur-sm bg-darkblue/80 rounded-xl shadow-lg relative text-white overflow-hidden"
        style={{
          width: '100%',
          maxWidth: '600px',
          height: '600px',
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="flex flex-col h-full">
          {/* Header with Tabs */}
          <div className="flex-shrink-0 px-6 pt-8 pb-4">
            <h1 className="text-3xl font-bold mb-4 text-center">
              {isComplete ? 'Game Complete!' : 'Game Ended'}
            </h1>

            {isComplete && (
              <div className="border-b border-white/10 mb-4 flex justify-center">
                <div className="inline-block text-sm text-center mb-2 bg-white text-black rounded-full px-4 py-1">
                  First Place!
                </div>
              </div>
            )}

            {!isComplete && (
              <div className="border-b border-white/10 mb-4 flex justify-center">
                <div className="inline-block text-sm text-center mb-2 bg-teal/20 text-white border border-teal/30 rounded-full px-4 py-1">
                  Completed {currentRound + 1} of {rounds} rounds
                </div>
              </div>
            )}

            <div className="flex justify-center space-x-1 flex-wrap gap-y-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id ? '' : 'hover:text-white/60'
                  } relative rounded-full px-3 py-1.5 text-sm font-medium text-white outline-sky-400 transition focus-visible:outline-2 whitespace-nowrap`}
                  style={{
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {activeTab === tab.id && (
                    <motion.span
                      layoutId="underline"
                      className="absolute bottom-0 left-0 right-0 h-[3px] bg-white z-10"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-20">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 px-6 overflow-y-auto">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="pb-4"
            >
              {renderTabContent()}
            </motion.div>
          </div>

          {/* Footer with Play Again Button */}
          <div className="flex-shrink-0 px-6 py-6 border-t border-white/10">
            <motion.button
              className="w-full px-4 py-3 bg-darkestblue text-white rounded-xl hover:bg-teal transition-colors font-semibold"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                reset();
                navigate('/dashboard');
              }}
            >
              Play Again
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Early Quit Modal */}
      {showEarlyQuitModal && !isComplete && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-darkblue/95 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full shadow-2xl border border-teal/30"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
          >
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-teal/20 flex items-center justify-center">
                <span className="text-white text-4xl">☹</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-white mb-3">Game Ended Early</h2>

            {/* Message */}
            <p className="text-center text-white/90 mb-2">
              You completed <span className="font-bold text-teal">{currentRound + 1}</span> of{' '}
              <span className="font-bold text-teal">{rounds}</span> rounds.
            </p>
            <p className="text-center text-grayblue text-sm mb-6">
              These are your stats from the rounds you completed.
            </p>

            {/* Okay Button */}
            <motion.button
              onClick={() => setShowEarlyQuitModal(false)}
              className="w-full px-6 py-3 bg-teal hover:bg-teal/80 text-white rounded-xl font-bold transition-colors shadow-lg"
              style={{ boxShadow: '0 0 20px rgba(15, 193, 233, 0.3)' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Okay
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default EndScreen;
