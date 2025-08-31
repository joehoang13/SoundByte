import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import GameStepsModal from '../components/GameSteps/GameStepsModal';

const Landing = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const startGame = () => {
    console.log('Navigating to GameScreen');
    navigate('/gamescreen');
  };

  const showSettings = () => {
    console.log('Navigating to Settings');
    navigate('/ready');
  };

  return (
    <>
      {/* Main content of the landing page */}
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-exo text-darkestblue mb-2 tracking-wider flex gap-1">
            {'SOUNDBYTE'.split('').map((char, index) => (
              <motion.span
                key={index}
                whileHover={{ y: -10, rotate: -5 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                style={{ display: 'inline-block' }}
              >
                {char}
              </motion.span>
            ))}
          </h1>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-montserrat text-darkestblue">
            HEAR IT. NAME IT.
          </h2>
          <div className="grid grid-cols-1 gap-4 mt-6">
            <button
              className="w-48 px-4 py-2 bg-darkblue text-white rounded font-montserrat hover:bg-darkestblue transition"
              onClick={() => setShowModal(true)}
            >
              Play
            </button>
            <button
              className="w-48 px-4 py-2 bg-darkblue text-white rounded font-montserrat hover:bg-darkestblue transition"
              onClick={showSettings}
            >
              Settings
            </button>
          </div>
        </div>
      </div>
      {showModal && <GameStepsModal onClose={() => setShowModal(false)} />}
    </>
  );
};

export default Landing;
