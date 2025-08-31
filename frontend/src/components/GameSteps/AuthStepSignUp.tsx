// path: frontend/src/components/GameSteps/AuthStepSignUp.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { registerUser } from '../../api/api';
import Background from "../Background";

interface AuthStepSignUpProps {
  onClose: () => void;
  onSignUpSuccess: () => void;
  onSwitchToLogin: () => void;
}

const AuthStepSignUp: React.FC<AuthStepSignUpProps> = ({
  onClose,
  onSignUpSuccess,
  onSwitchToLogin,
}) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setBusy(true);
    try {
      await registerUser({ email, username: username || undefined, password });
      // token is persisted by api.tsx; notify parent and reset
      onSignUpSuccess();
      setEmail('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setError(e?.message || 'Signup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen z-50 font-montserrat">

      {/* Animated Background Layer */}
      <Background />

      {/* Modal Content */}
      <div className="flex items-center justify-center p-4 w-full">
        <motion.div
          className="bg-darkblue/80 rounded-2xl w-full max-w-md shadow-2xl relative text-white overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 hover:text-black dark:hover:text-white text-xl"
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
              <h2 className="text-2xl mb-4 text-center">
                Welcome to SoundByte
              </h2>
              <p className="text-sm text-center mb-6">Create an account to start playing!</p>
            </motion.div>


            <div className="space-y-5">
              <form onSubmit={handleSignup} className="space-y-3 text-black">
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
                    placeholder="Username (optional)"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                  />
                  <input
                    className="w-full p-3 bg-white/10 backdrop-blur-sm border-2 border-gray-400/30 rounded-lg text-white placeholder-gray-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <input
                    className="w-full p-3 bg-white/10 backdrop-blur-sm border-2 border-gray-400/30 rounded-lg text-white placeholder-gray-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300"
                    placeholder="Confirm Password"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </motion.div>

                <motion.button
                  className={`w-full py-3 font-bold rounded-xl transition-all duration-300 relative overflow-hidden ${busy
                    ? 'bg-gray-600/50 cursor-not-allowed text-gray-400'
                    : 'bg-cyan-500 hover:from-cyan-400 text-white shadow-lg hover:shadow-cyan-500/25'
                    }`}
                  whileHover={{ scale: busy ? 1 : 1.02 }}
                  whileTap={{ scale: busy ? 1 : 0.98 }}
                  type="submit"
                  disabled={busy}
                >
                  {busy ? 'Creating account…' : 'Sign Up'}
                </motion.button>

                {error && (
                  <p className="text-red-300 text-sm text-center" role="alert" aria-live="polite">
                    {error}
                  </p>
                )}

                <p className="text-center text-sm text-white mt-4">
                  Already have an account?
                </p>
                <button
                  type="button"
                  className="w-full border-2 border-cyan-500 text-white py-2 rounded-lg 
                            font-semibold transition-all duration-300 
                            hover:shadow-lg hover:scale-105"
                  onClick={onSwitchToLogin}
                >
                  Log In
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthStepSignUp;
