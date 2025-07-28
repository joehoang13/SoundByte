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

  return (
    <>
      {/* Background animation using Framer Motion */}
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1,
          backgroundColor: '#143D4D',
         backgroundImage: `
          radial-gradient(circle at 50% 40%, #0FC1E9 0%, transparent 65%),
          radial-gradient(circle at 60% 60%, #90A4AB 0%, transparent 70%),
          radial-gradient(circle at 85% 85%, #274D5B 0%, transparent 50%)
        `,
          // light teal color
          // second darkest blue color
          // gray color
          backgroundSize: '250% 250%',
        }}
        initial={{ backgroundPosition: '0% 0%' }}
        animate={{
          backgroundPosition: [
            '30% 20%',
            '60% 40%',
            '40% 75%',
            '70% 60%',
            '20% 70%',
            '50% 50%',
            '30% 20%'
          ],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      ></motion.div>

      {/* Overlay for noise effect */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1,
          pointerEvents: 'none',
          backgroundImage: "url('/noise.png')",
          opacity: 0.4,
          mixBlendMode: 'overlay',
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Main content of the landing page */}
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <h1 className="text-7xl font-exo text-darkestblue mb-2 tracking-wider flex gap-1">
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
          <h2 className="text-3xl font-montserrat text-darkestblue">HEAR IT. NAME IT.</h2>
          <div className="grid grid-cols-1 gap-4 mt-6">
            <button
              className="w-48 px-4 py-2 bg-darkblue text-white rounded font-montserrat hover:bg-darkestblue transition"
              onClick={() => setShowModal(true)}
            >
              Play
            </button>
            <button
              className="w-48 px-4 py-2 bg-darkblue text-white rounded font-montserrat hover:bg-darkestblue transition"
              onClick={startGame}
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
