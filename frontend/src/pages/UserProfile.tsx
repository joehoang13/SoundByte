import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '../stores/auth';
import { logout } from '../api/auth';
import { getUserStats } from '../api/users';
import { useNavigate } from 'react-router-dom';
import Background from '../components/Background';
import NavBar from '../components/NavBar';
import type { UserStats } from '../types/users';

const UserProfile = () => {
  const { user, token } = useAuth();
  const isLoggedIn = !!(user && token);
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getUserStats()
      .then(data => {
        setStats(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch user stats:', err);
        setIsLoading(false);
      });
  }, [user?.id]);

  if (!user) {
    return (
      <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen font-montserrat">
        <p className="text-gray-600">You are not logged in.</p>
      </div>
    );
  }

  // Mock data for game history
  const recentGames = [
    { id: 1, mode: 'Classic Mode', score: 850, date: '2 hours ago', result: 'win' },
    { id: 2, mode: 'Multiplayer', score: 920, date: '1 day ago', result: 'win' },
    { id: 3, mode: 'Inference Mode', score: 650, date: '2 days ago', result: 'loss' },
    { id: 4, mode: 'Classic Mode', score: 780, date: '3 days ago', result: 'win' },
  ];

  return (
    <div className="min-h-screen font-montserrat p-4">
      <Background />
      <NavBar />

      <div className="max-w-7xl mx-auto mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT SIDE - User Info Card */}
        <motion.div
          className="lg:col-span-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="bg-darkblue/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/10 h-full flex flex-col justify-center">
            {/* Profile Picture */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center text-teal text-5xl font-bold mb-4 shadow-lg">
                {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </div>

              <h2 className="text-2xl font-bold text-white mb-1">{user.username}</h2>
            </div>

            {/* User Details */}
            <div className="space-y-4 mb-6">
              <div className="border-b border-white/10 pb-3">
                <p className="text-xs text-gray-400 tracking-wide mb-1">EMAIL</p>
                <p className="text-sm text-white break-all">{user.email}</p>
              </div>

              <div className="border-b border-white/10 pb-3">
                <p className="text-xs text-gray-400 tracking-wide mb-1">PASSWORD</p>
                <p className="text-sm text-white">******</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 tracking-wide mb-1">LOCATION</p>
                <p className="text-sm text-white">United States</p>
              </div>
            </div>
            <div className="space-y-3">
              <button
                className="w-full py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors"
                onClick={async () => {
                  const confirm = window.confirm(
                    'We’ll send a reset password link to your registered email. Continue?'
                  );
                  if (!confirm) return;
                  try {
                    const apiBase = import.meta.env.VITE_API_URL.replace(/\/$/, '');
                    const res = await fetch(`${apiBase}/api/auth/request-password-reset`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: user.email }),
                    });
                    const data = await res.json();
                    alert(data.message || 'Check your email for reset instructions.');
                  } catch (err) {
                    console.error(err);
                    alert('Something went wrong while requesting a reset email.');
                  }
                }}
              >
                Reset Password
              </button>
            </div>
          </div>
        </motion.div>

        {/* RIGHT SIDE - Stats & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Overview Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-400 animate-pulse">Loading stats...</p>
              </div>
            ) : stats ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Games Played */}
                <div className="bg-darkblue/80 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/30 hover:border-cyan-500/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-3xl font-bold text-cyan-400">{stats.totalGamesPlayed}</p>
                    <span className="text-2xl text-white">♫</span>
                  </div>
                  <p className="text-sm text-gray-300">Total Games</p>
                  <div className="mt-2 h-1 bg-cyan-500/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full"
                      style={{ width: `${Math.min((stats.totalGamesPlayed / 10) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* High Score */}
                <div className="bg-darkblue/80 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 hover:border-purple-500/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-3xl font-bold text-cyan-400">{stats.highestScore}</p>
                    <span className="text-2xl text-white">♪</span>
                  </div>
                  <p className="text-sm text-gray-300">High Score</p>
                  <div className="mt-2 h-1 bg-cyan-500/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full"
                      style={{ width: `${Math.min((stats.highestScore / 1000) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Snippets Guessed */}
                <div className="bg-darkblue/80 backdrop-blur-sm rounded-xl p-6 border border-teal-500/30 hover:border-teal-500/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-3xl font-bold text-cyan-400">{stats.totalSnippetsGuessed}</p>
                    <span className="text-2xl text-white">♬</span>
                  </div>
                  <p className="text-sm text-gray-300">Snippets Guessed</p>
                  <div className="mt-2 h-1 bg-cyan-500/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full"
                      style={{
                        width: `${Math.min((stats.totalSnippetsGuessed / 200) * 100, 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">Failed to load stats</p>
            )}
          </motion.div>

          {/* Recent Game History */}
          <motion.div
            className="bg-darkblue/80 backdrop-blur-sm rounded-xl p-6 border border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h3 className="text-xl font-bold text-white mb-4">Recent Games</h3>
            <div className="space-y-3">
              {recentGames.map(game => (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-all"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-2 h-2 rounded-full ${game.result === 'win' ? 'bg-green-400' : 'bg-red-400'}`}
                    ></div>
                    <div>
                      <p className="text-sm font-semibold text-white">{game.mode}</p>
                      <p className="text-xs text-gray-400">{game.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-cyan-400">{game.score}</p>
                    <p className="text-xs text-gray-400">points</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
