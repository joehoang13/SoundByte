import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import disc from '../assets/disc.svg';
import needle from '../assets/needle.svg';
import AuthModal from '../components/Auth/AuthModal';
import { useAuth } from '../stores/auth';

const Landing = () => {
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);

  const { user, token } = useAuth();
  const isLoggedIn = !!(user && token);

  const handlePlay = () => {
    if (isLoggedIn) {
      navigate('/dashboard');
    } else {
      setShowAuth(true);
    }
  };

  const handleAuthSuccess = () => {
    // After successful login/signup, close auth modal and show game settings
    setShowAuth(false);
    navigate('/dashboard');
  };

  const showSettings = () => navigate('/ready');

  return (
    <>
      {/* Landing content (dims when auth open) */}
      <div
        className={`min-h-screen flex items-start justify-center transition-all duration-300 relative z-40
      ${showAuth ? 'opacity-30 blur-[2px] pointer-events-none select-none' : ''}`}
      >
        <div className="flex flex-col items-center justify-center p-4 pt-40 text-center">
          <div className="relative w-32 h-32 mb-4">
            <motion.img
              src={disc}
              alt="SoundByte Logo"
              className="w-32 h-32 select-none cursor-pointer"
              draggable={false}
              onDragStart={e => e.preventDefault()}
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, ease: 'linear', duration: 10 }}
            />
            <motion.img
              src={needle}
              alt="Needle"
              className="absolute w-20 h-20 z-10 select-none pointer-events-none"
              style={{
                top: '-5%',
                right: '12%',
              }}
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
            <button
              className="w-48 px-4 py-2 bg-darkblue text-white rounded-xl font-montserrat hover:bg-darkestblue transition"
              onClick={handlePlay}
            >
              Play
            </button>
            <button
              className="w-48 px-4 py-2 bg-darkblue text-white rounded-xl font-montserrat hover:bg-darkestblue transition"
              onClick={showSettings}
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Authentication Modal */}
      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} onAuthSuccess={handleAuthSuccess} />
      )}
    </>
  );
};

export default Landing;
