import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import disc from '../assets/disc.svg';
import needle from '../assets/needle.svg';
import Background from '../components/Background';
import { useAuth } from '../stores/auth';
import { logout } from '../api/auth';
import GamePrefModal from '../components/GameSteps/GamePrefModal';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const isLoggedIn = !!(user && token);
  const [showGamePrefs, setShowGamePrefs] = useState(false);

  const handlePlay = () => {
    if (isLoggedIn) {
      setShowGamePrefs(true);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <Background />

      <div className="min-h-screen flex items-center justify-center font-montserrat p-4 relative">
        {/* User Badge - Top Left */}
        {user && (
          <div
            className="fixed top-10 left-6 z-[60] flex items-center gap-4 rounded-2xl px-5 py-4"
            style={{
              backgroundColor: 'rgba(20, 61, 77, 0.7)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 6px 24px rgba(15,193,233,0.20)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
              <span className="text-base font-bold text-teal">
                {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>

            <div className="leading-tight">
              <div className="text-xl font-extrabold text-white">
                {user.username || user.email?.split('@')[0] || 'User'}
              </div>
              <div className="text-xs text-grayblue">online</div>
            </div>
          </div>
        )}

        {/* Vinyl Navigation - Left Side */}
        <div className="absolute left-8 lg:left-16 z-50">
          <motion.div
            className="relative w-32 h-32 lg:w-40 lg:h-40 cursor-pointer select-none"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Vinyl Record */}
            <motion.img
              src={disc}
              alt="Vinyl control"
              className="w-full h-full select-none"
              draggable={false}
              onDragStart={e => e.preventDefault()}
              animate={{ rotate: 360 }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              style={{
                filter: 'hue-rotate(0deg) saturate(1.2) brightness(1.1)',
              }}
            />

            {/* Needle */}
            <motion.img
              src={needle}
              alt="Needle"
              className="absolute w-24 h-24 z-10 select-none pointer-events-none"
              style={{
                top: '-10%',
                right: '14%',
                transformOrigin: '85% 20%',
              }}
              animate={{ rotate: -15 }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
          </motion.div>
        </div>

        {/* Main Dashboard Content */}
        <motion.div
          className="flex flex-col bg-darkblue/80 backdrop-blur-sm rounded-2xl w-[80%] max-w-[1200px] min-h-[90vh] ml-64 shadow-lg relative text-white p-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-exo mb-4 text-center">Dashboard</h1>
          <p className="text-center text-lg md:text-xl lg:text-2xl mb-8">
            Welcome back,{' '}
            <span className="font-bold text-teal">
              {user?.username || user?.email?.split('@')[0] || 'User'}
            </span>
            !
          </p>
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 justify-center items-center">
            <button
              className="w-48 px-4 py-3 bg-teal text-white rounded-xl font-montserrat hover:bg-darkestblue transition"
              onClick={handlePlay}
            >
              Play Game
            </button>

            <motion.button
              className="w-48 px-4 py-3 bg-darkblue text-white rounded-xl font-montserrat hover:bg-darkestblue transition flex items-center justify-center gap-2"
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
            <motion.button
              className="fixed bottom-6 right-6 px-4 py-2 bg-darkblue/80 hover:bg-darkblue text-white rounded-xl font-semibold border border-grayblue/20 hover:border-teal/50 transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => logout().then(() => navigate('/'))}
            >
              Logout
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Game Settings Modal */}
      {showGamePrefs && <GamePrefModal onClose={() => setShowGamePrefs(false)} />}
    </>
  );
};

export default Dashboard;
