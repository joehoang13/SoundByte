// src/pages/Landing.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// ✅ use assets (old public/ paths removed)
// import discdb from '../../public/discdb.png'
// import needledb from '../../public/needledb.png'
import discdb from '../assets/discdb.png';
import needledb from '../assets/needledb.png';

// Auth modal (kept, but Play now opens GamePrefModal)
import Modal from './Modal';

// ⬇️ Game preferences modal
// If your file name differs, adjust this path (e.g. GameSettingsModal.tsx)
import GamePrefModal from '../components/GameSteps/GamePrefModal';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  // Auth modal (kept for when you want it)
  const [showAuth, setShowAuth] = useState(false);

  // Game preferences modal (new)
  const [showPrefs, setShowPrefs] = useState(false);

  // When either modal is open, dim/disable the background
  const dim = showAuth || showPrefs;

  return (
    <>
      {/* Landing content (dims when any modal is open) */}
      <div
        className={`min-h-screen flex items-center justify-center transition-all duration-300 ${
          dim ? 'opacity-30 blur-[2px] pointer-events-none select-none' : ''
        }`}
      >
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <div className="relative w-32 h-32 mb-4">
            <motion.img
              src={discdb}
              alt="SoundByte Logo"
              className="w-32 h-32 select-none cursor-pointer"
              draggable={false}
              onDragStart={e => e.preventDefault()}
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, ease: 'linear', duration: 10 }}
            />
            <motion.img
              src={needledb}
              alt="Needle"
              className="absolute w-20 h-20 z-10 select-none pointer-events-none"
              style={{ top: '-5%', right: '12%' }}
              initial={{ y: 0 }}
              animate={{ y: [0, -1, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            />
          </div>

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
            {/* Play now opens the Game Preferences modal */}
            <button
              className="w-48 px-4 py-2 bg-darkblue text-white rounded-xl font-montserrat hover:bg-darkestblue transition"
              onClick={() => setShowPrefs(true)}
            >
              Play
            </button>

            {/* Settings as before */}
            <button
              className="w-48 px-4 py-2 bg-darkblue text-white rounded-xl font-montserrat hover:bg-darkestblue transition"
              onClick={() => navigate('/ready')}
            >
              Settings
            </button>

            {/* Optional: expose Auth modal directly if you still want it here */}
            {/* <button
              className="w-48 px-4 py-2 bg-darkblue text-white rounded-xl font-montserrat hover:bg-darkestblue transition"
              onClick={() => setShowAuth(true)}
            >
              Log in / Sign up
            </button> */}
          </div>
        </div>
      </div>

      {/* Profile FAB */}
      <motion.button
        className={`fixed bottom-10 right-10 w-14 h-14 bg-darkblue text-white rounded-full shadow-lg flex items-center justify-center hover:bg-darkestblue transition-all duration-300 z-40 ${
          dim ? 'opacity-0 pointer-events-none' : ''
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/profile')}
        aria-label="Open User Profile"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 20c0-3.31 2.69-6 6-6s6 2.69 6 6"
          />
        </svg>
      </motion.button>

      {/* Game Preferences Modal */}
      {showPrefs && <GamePrefModal onClose={() => setShowPrefs(false)} />}

      {/* Auth Modal (kept) */}
      {showAuth && (
        <Modal
          onClose={() => setShowAuth(false)}
          onAuthed={() => {
            setShowAuth(false);
            navigate('/gamescreen');
          }}
          initialTab="login"
        />
      )}
    </>
  );
};

export default Landing;
