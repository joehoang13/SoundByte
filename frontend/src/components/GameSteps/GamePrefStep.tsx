import React, { useState } from 'react';
import { motion } from 'framer-motion';
import useGameStore from '../../stores/GameStore';

interface GamePrefStepProps {
  onClose: () => void;
  onStartGame: (snippetLength: number) => void;
}

const GamePrefStep: React.FC<GamePrefStepProps> = ({ onClose, onStartGame }) => {
  const [formData, setFormData] = useState<{ snippetLength: number | null }>({
    snippetLength: null,
  });
  const setSnippetLength = useGameStore(state => state.setSnippetLength);

  const handleInputChange = (field: string, value: string) => {
    const difficulty = parseInt(value);
    setFormData(prev => ({ ...prev, [field]: difficulty }));
  };

  const handleSubmit = () => {
    if (formData.snippetLength === null) {
      alert('Please select a snippet length before starting.');
      return;
    }

    setSnippetLength(formData.snippetLength);
    onStartGame(formData.snippetLength);
  };

  return (
    <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen">
      <div className="bg-darkblue rounded-xl p-10 w-[90%] max-w-lg shadow-lg relative text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 hover:text-black dark:hover:text-white text-s"
        >
          Logout
        </button>

        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-center">
          Game Difficulty
        </h2>
        <p className="text-sm sm:text-base text-center mb-6">Select desired clip snippet length</p>

        <div className="space-y-3 mb-6">
          <div className="flex flex-col items-center space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="snippetLength"
                value="3"
                checked={formData.snippetLength === 3}
                onChange={e => handleInputChange('snippetLength', e.target.value)}
              />
              <span>3 Seconds</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="snippetLength"
                value="5"
                checked={formData.snippetLength === 5}
                onChange={e => handleInputChange('snippetLength', e.target.value)}
              />
              <span>5 Seconds</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="snippetLength"
                value="10"
                checked={formData.snippetLength === 10}
                onChange={e => handleInputChange('snippetLength', e.target.value)}
              />
              <span>10 Seconds</span>
            </label>
          </div>
        </div>

        <button
          className="w-full bg-darkestblue text-white py-2 rounded hover:bg-darkestblue transition"
          onClick={handleSubmit}
        >
          Start Game
        </button>
      </div>
    </div>
  );
};

export default GamePrefStep;
