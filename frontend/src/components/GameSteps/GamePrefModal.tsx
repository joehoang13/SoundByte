import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../../stores/GameSessionStore';
import Background from '../Background';
import type { SnippetSize } from '../../types/game';

interface GamePrefModalProps {
  onClose: () => void;

  // props to prefill data / start at a specific step
  initialStep?: 'playMode' | 'gameMode' | 'difficulty';
  initialValues?: {
    playMode?: string;
    gameMode?: string;
    snippetLength?: number;
  };
}

type PlayMode = 'solo' | 'multiplayer';
type GameMode = 'classic' | 'inference';

const GamePrefModal: React.FC<GamePrefModalProps> = ({
  onClose,
  initialStep = 'playMode',
  initialValues = {},
}) => {
  const navigate = useNavigate();
  const setConfig = useGameStore(state => state.setConfig);

  // Current step in the modal
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Form data - if data exists from props, use it to prefill
  const [playMode, setPlayMode] = useState<PlayMode | null>(
    (initialValues.playMode as PlayMode) || null
  );
  const [gameMode, setGameMode] = useState<GameMode | null>(
    (initialValues.gameMode as GameMode) || null
  );
  const [snippetLength, setSnippetLength] = useState<number | null>(
    initialValues.snippetLength || null
  );

  const handleNext = () => {
    if (currentStep === 'playMode' && playMode) {
      setCurrentStep('gameMode');
    } else if (currentStep === 'gameMode' && gameMode) {
      if (gameMode === 'inference') {
        handleStartGame();
      } else {
        setCurrentStep('difficulty');
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 'gameMode') {
      setCurrentStep('playMode');
    } else if (currentStep === 'difficulty') {
      setCurrentStep('gameMode');
    }
  };

  const handleStartGame = () => {
    if (gameMode === 'inference') {
      onClose();
      navigate('/inference');
      return;
    }

    if (!playMode || !gameMode || !snippetLength) {
      alert('Please complete before starting.');
      return;
    }

    setConfig({ snippetSize: snippetLength as SnippetSize });

    onClose();

    if (playMode === 'solo') {
      // pass data to ready screen via state in case user hits back
      navigate('/ready', {
        state: {
          fromModal: true,
          modalStep: 'difficulty',
          playMode,
          gameMode,
          snippetLength,
        },
      });
    } else if (playMode === 'multiplayer') {
      navigate('/gamescreen');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <Background />
        <motion.div
          className="bg-darkblue/80 rounded-xl p-10 w-[90%] max-w-lg shadow-lg relative text-white"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 hover:text-cyan-400 text-white/70 text-xl"
            aria-label="Close"
          >
            ×
          </button>

          {/* Solo/Multiplayer Step */}
          {currentStep === 'playMode' && (
            <div className="space-y-4">
              <h2
                className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-center text-cyan-400"
                style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.5)' }}
              >
                Play Mode
              </h2>
              <p className="text-sm sm:text-base text-center mb-6">Choose your play mode</p>

              <motion.button
                className={`w-full py-3 font-bold rounded-xl transition-all duration-300
                          ${
                            playMode === 'solo'
                              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                              : 'bg-darkblue/60 text-gray-300 hover:bg-darkblue/80'
                          }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setPlayMode('solo');
                }}
              >
                <div className="font-bold">Solo</div>
                <div className="text-sm font-light">Play by yourself and track your score</div>
              </motion.button>
              <motion.button
                className={`w-full py-3 font-bold rounded-xl transition-all duration-300
                          ${
                            playMode === 'multiplayer'
                              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                              : 'bg-darkblue/60 text-gray-300 hover:bg-darkblue/80'
                          }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setPlayMode('multiplayer');
                }}
              >
                <div className="font-bold">Multiplayer</div>
                <div className="text-sm font-light">Compete against friends in real-time</div>
              </motion.button>
            </div>
          )}

          {/* Game Mode Step */}
          {currentStep === 'gameMode' && (
            <div className="space-y-4">
              <h2
                className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-center text-cyan-400"
                style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.5)' }}
              >
                Game Mode
              </h2>
              <p className="text-sm sm:text-base text-center mb-6">Choose your game mode</p>
              <motion.button
                className={`w-full py-3 font-bold rounded-xl transition-all duration-300
                          ${
                            gameMode === 'classic'
                              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                              : 'bg-darkblue/60 text-gray-300 hover:bg-darkblue/80'
                          }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setGameMode('classic');
                }}
              >
                <div className="font-bold">Classic</div>
                <div className="text-sm font-light">Identify tracks from snippets</div>
              </motion.button>
              <motion.button
                className={`w-full py-3 font-bold rounded-xl transition-all duration-300
                          ${
                            gameMode === 'inference'
                              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                              : 'bg-darkblue/60 text-gray-300 hover:bg-darkblue/80'
                          }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setGameMode('inference');
                }}
              >
                <div className="font-bold">Inference</div>
                <div className="text-sm font-light">Identify tracks from lyrics</div>
              </motion.button>
            </div>
          )}

          {/* Snippet Length Step */}
          {currentStep === 'difficulty' && (
            <div className="space-y-4">
              <h2
                className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-center text-cyan-400"
                style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.5)' }}
              >
                Game Difficulty
              </h2>
              <p className="text-sm sm:text-base text-center mb-6">
                Select desired clip snippet length
              </p>

              <div className="space-y-3 mb-6">
                <div className="grid gap-3 mb-6">
                  {[
                    { label: 'Easy', value: 10 },
                    { label: 'Normal', value: 5 },
                    { label: 'Hard', value: 3 },
                  ].map(len => (
                    <motion.button
                      key={len.value}
                      onClick={() => setSnippetLength(len.value)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full py-3 font-bold rounded-xl transition-all duration-300
                              ${
                                snippetLength === len.value
                                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                                  : 'bg-darkblue/60 text-gray-300 hover:bg-darkblue/80'
                              }`}
                    >
                      <div className="font-bold">{len.label}</div>
                      <div className="text-sm font-light">{len.value} Seconds</div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-6">
            {(currentStep === 'gameMode' || currentStep === 'difficulty') && (
              <motion.button
                className="px-6 py-3 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBack}
              >
                Back
              </motion.button>
            )}

            <motion.button
              className={`w-full py-3 font-bold rounded-xl transition-all duration-300 border border-cyan-500 relative overflow-hidden hover:bg-cyan-400 text-white shadow-lg hover:shadow-cyan-500/25`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={currentStep === 'difficulty' ? handleStartGame : handleNext}
            >
              Next
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GamePrefModal;
