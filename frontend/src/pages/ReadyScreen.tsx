import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import useGameStore from '../stores/GameSessionStore';
import ReadyScreenTips from '../components/ReadyScreenTips';
import { useAuth } from '../stores/auth';
import GamePrefModal from '../components/GameSteps/GamePrefModal';

const ReadyScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isStarting, setIsStarting] = useState(false);
  const [showGamePrefs, setShowGamePrefs] = useState(false);
  const gameMode = useGameStore(state => state.mode);
  const snippetLength = useGameStore(state => state.snippetSize);
  const { user, token } = useAuth();
  const [countdown, setCountdown] = useState(3);
  const [animationKey, setAnimationKey] = useState(0);

  const isAuthenticated = !!(user && token);

  // Check for state passed from previous page in case user hits back
  const modalState = location.state as {
    fromModal?: boolean;
    modalStep?: string;
    playMode?: string;
    gameMode?: string;
    snippetLength?: number;
  } | null;

  const handleStartGame = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setIsStarting(true);
    setCountdown(3);
  };

  // if user hits back from ready screen, return to game prefs if they came from there w/ data
  const handleBackToMenu = () => {
    if (modalState?.fromModal) {
      setShowGamePrefs(true);
    } else {
      navigate('/');
    }
  };

  const handleGamePrefsClose = () => {
    setShowGamePrefs(false);
    setAnimationKey(prev => prev + 1);
    navigate('/');
  };

  useEffect(() => {
    if (!isStarting) return;

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(countdownInterval);
          navigate('/gamescreen');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [isStarting, countdown, navigate]);

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
        <motion.div
          key={animationKey}
          className="flex flex-col bg-darkblue/80 backdrop-blur-sm rounded-2xl w-full max-w-[600px] min-h-[500px] shadow-lg text-white p-8 sm:p-12"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Header */}
          <motion.div
            className="text-center mb-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h1
              className="text-4xl sm:text-5xl font-bold mb-4 text-cyan-400"
              style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.5)' }}
            >
              Ready to Play?
            </h1>
            <div className="text-center">
              <ReadyScreenTips />
            </div>
          </motion.div>

          {/* Game Settings Display */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <h2 className="text-xl font-semibold mb-4 text-center">Game Settings</h2>

            <div className="bg-darkblue/60 rounded-xl p-6 mb-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Mode:</span>
                <span className="font-semibold text-cyan-400 capitalize">{gameMode}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Snippet Length:</span>
                <span className="font-semibold text-cyan-400">{snippetLength} seconds</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Max Guesses:</span>
                <span className="font-semibold text-cyan-400">5 per song</span>
              </div>
            </div>
          </motion.div>

          {/* Players */}
          <motion.div
            className="text-center mb-8 space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
          >
            <h3 className="text-lg font-semibold mb-4 text-white">Players</h3>
            {isAuthenticated && user ? (
              <div className="bg-darkblue/40 rounded-lg p-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    {(user.username || user.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-300">
                      {user.username || user.email.split('@')[0]}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 bg-red-900/20 rounded-lg p-4 border border-red-700/30">
                <span>Unable to load player data</span>
              </div>
            )}
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 mt-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
          >
            <button
              onClick={handleBackToMenu}
              className="sm:w-24 px-4 py-4 bg-gray-600/50 hover:bg-gray-600/70 text-white font-semibold rounded-xl transition-all duration-300"
            >
              ← Back
            </button>

            <motion.button
              onClick={handleStartGame}
              disabled={isStarting}
              className={`flex-1 px-8 py-4 font-bold rounded-xl transition-all duration-300 relative overflow-hidden ${
                isStarting
                  ? 'bg-gray-600/50 cursor-not-allowed text-gray-400'
                  : 'bg-cyan-500 hover:from-cyan-400 text-white shadow-lg hover:shadow-cyan-500/25'
              }`}
              whileHover={!isStarting ? { scale: 1.02 } : {}}
              whileTap={!isStarting ? { scale: 0.98 } : {}}
            >
              {!isStarting && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-blue-500/20"
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              Start Game
            </motion.button>
          </motion.div>

          {/* Countdown Animation */}
          {isStarting && (
            <motion.div
              className="absolute inset-0 bg-darkblue/90 backdrop-blur-sm rounded-2xl flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="text-6xl font-bold text-cyan-400"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {countdown}
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Show Game Preferences Modal w/ data */}
      {showGamePrefs && (
        <GamePrefModal
          onClose={handleGamePrefsClose}
          initialStep={
            (modalState?.modalStep as 'playMode' | 'gameMode' | 'difficulty') || 'playMode'
          }
          initialValues={{
            playMode: modalState?.playMode,
            gameMode: modalState?.gameMode,
            snippetLength: modalState?.snippetLength,
          }}
        />
      )}
    </>
  );
};

export default ReadyScreen;
