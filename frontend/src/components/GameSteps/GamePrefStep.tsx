import React, { useState } from 'react';
import { motion } from 'framer-motion';
import useGameStore from '../../stores/GameSessionStore';
import type { SnippetSize } from '../../types/game';
import Background from '../Background';

interface GamePrefStepProps {
  onClose: () => void;
  onStartGame: (snippetLength: number) => void;
}

const GamePrefStep: React.FC<GamePrefStepProps> = ({ onClose, onStartGame }) => {
  const [formData, setFormData] = useState<{ snippetLength: number | null }>({
    snippetLength: null,
  });
  const setConfig = useGameStore(state => state.setConfig);

  const handleInputChange = (field: string, value: string) => {
    const difficulty = parseInt(value);
    setFormData(prev => ({ ...prev, [field]: difficulty }));
  };

  const handleSubmit = () => {
    if (formData.snippetLength === null) {
      alert('Please select a snippet length before starting.');
      return;
    }

    setConfig({ snippetSize: formData.snippetLength as SnippetSize });
    onStartGame(formData.snippetLength);
  };

  return (
    <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen">
      <Background />
      <motion.div
        className="bg-darkblue/80 rounded-xl p-10 w-[90%] max-w-lg shadow-lg relative text-white"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 hover:text-black dark:hover:text-white text-s"
        >
          Logout
        </button>

        <h2
          className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-center text-cyan-400"
          style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.5)' }}
        >
          Game Difficulty
        </h2>
        <p className="text-sm sm:text-base text-center mb-6">Select desired clip snippet length</p>

        <div className="space-y-3 mb-6">
          <div className="grid gap-3 mb-6">
            {[3, 5, 10].map(len => (
              <motion.button
                key={len}
                onClick={() => setFormData({ snippetLength: len })}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-3 font-bold rounded-xl transition-all duration-300
                  ${
                    formData.snippetLength === len
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                      : 'bg-darkblue/60 text-gray-300 hover:bg-darkblue/80'
                  }`}
              >
                {len} Seconds
              </motion.button>
            ))}
          </div>
        </div>

        <motion.button
          className={`w-full py-3 font-bold rounded-xl transition-all duration-300 border border-cyan-500 relative overflow-hidden hover:bg-cyan-400 text-white shadow-lg hover:shadow-cyan-500/25`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
        >
          Next
        </motion.button>
      </motion.div>
    </div>
  );
};

export default GamePrefStep;
