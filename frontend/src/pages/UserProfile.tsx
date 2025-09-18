import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '../stores/auth';
import { logout } from '../api/auth';
import { getUserStats } from '../api/users';
import { useNavigate } from 'react-router-dom';
import Background from '../components/Background';
import type { UserStats } from '../types/users';

const UserProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    getUserStats()
      .then(data => setStats(data))
      .catch(err => console.error('Failed to fetch user stats:', err));
  }, [user?.id]);

  if (!user) {
    return (
      <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen font-montserrat">
        <p className="text-gray-600">You are not logged in.</p>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/welcome');
  };

  const handleReturn = () => {
    navigate('/');
  };

  return (
    <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen font-montserrat">
      <Background />
      <motion.div
        className="bg-darkblue/80 rounded-xl p-10 w-[90%] max-w-lg shadow-lg relative text-white text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <h2
          className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-center text-cyan-400"
          style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.5)' }}
        >
          User Profile
        </h2>
        <p className="text-l font-semibold mb-4 text-center">Welcome, {user.username}!</p>
        <p className="text-l font-semibold mb-4 text-center">Email: {user.email}</p>

        {stats && (
          <div className="text-left mt-6 space-y-2 text-sm sm:text-base">
            <p>
              Total Games Played: <span className="font-semibold">{stats.totalGamesPlayed}</span>
            </p>
            <p>
              Highest Score: <span className="font-semibold">{stats.highestScore}</span>
            </p>
            <p>
              Snippets Guessed: <span className="font-semibold">{stats.totalSnippetsGuessed}</span>
            </p>
          </div>
        )}

        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={handleReturn}
            className="px-6 py-2 text-white rounded-full border border-cyan-500 hover:bg-teal transition"
          >
            Return
          </button>
          <button
            onClick={handleLogout}
            className="px-6 py-2 text-white rounded-full border border-red-500 hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default UserProfile;
