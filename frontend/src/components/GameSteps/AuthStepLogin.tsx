// path: frontend/src/components/GameSteps/AuthStepLogin.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { loginUser } from '../../api/api';
import Background from "../Background";

interface AuthStepLoginProps {
  onClose: () => void;
  onLoginSuccess: () => void;
  onSwitchToSignUp: () => void;
}

const AuthStepLogin: React.FC<AuthStepLoginProps> = ({
  onClose,
  onLoginSuccess,
  onSwitchToSignUp,
}) => {
  const [email, setEmail] = useState(''); // use email for auth
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      await loginUser({ email, password }); // persists token via api.tsx
      onLoginSuccess(); // parent handles navigation
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
    console.log('Token after login:', localStorage.getItem('sb_token'));
  }

  return (
    <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen z-50 font-montserrat">

      {/* Animated Background Layer */}
      <Background />

      {/* Modal Content */}
      <div className="flex items-center justify-center p-4 w-full">
        <motion.div
          className="bg-darkblue/80 rounded-2xl w-full max-w-md shadow-2xl relative text-white overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 hover:text-white text-xl"
          >
            ×
          </button>

          <div className="p-8 pt-12 font-bold">
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <h2 className="text-2xl font-bold mb-4 text-center">Welcome to SoundByte</h2>
              <p className="text-sm text-center mb-6">Log in or create an account to start playing!</p>
            </motion.div>

            <div className="space-y-5 text-black">
              <motion.div
                className="w-full flex flex-col gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
              >
                <input
                  className="w-full p-3 bg-white/10 backdrop-blur-sm border-2 border-gray-400/30 rounded-lg text-white placeholder-gray-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <input
                  className="w-full p-3 bg-white/10 backdrop-blur-sm border-2 border-gray-400/30 rounded-lg text-white placeholder-gray-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </motion.div>

              <motion.button
                className={`w-full py-3 font-bold rounded-xl transition-all duration-300 relative overflow-hidden ${loading
                  ? 'bg-gray-600/50 cursor-not-allowed text-gray-400'
                  : 'bg-cyan-500 hover:from-cyan-400 text-white shadow-lg hover:shadow-cyan-500/25'
                  }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Log In'}
              </motion.button>

              {error && (
                <p className="text-red-400 text-center mt-2 text-sm" role="alert">
                  {error}
                </p>
              )}

              <p className="text-center text-sm text-white mt-4">Don't have an account?</p>
              <button
                className="w-full border-2 border-cyan-500 text-white py-2 rounded-lg 
                            font-semibold transition-all duration-300 
                          hover:shadow-lg hover:scale-105"
                onClick={onSwitchToSignUp}
              >
                Sign Up
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthStepLogin;
