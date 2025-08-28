// path: frontend/src/components/GameSteps/AuthStepLogin.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { loginUser } from '../../api/api';

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
  }

  return (
    <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen bg-black bg-opacity-25 z-50">
      <div className="bg-darkblue rounded-xl p-10 w-[90%] max-w-lg shadow-lg relative text-white">
        <button onClick={onClose} className="absolute top-4 right-4 hover:text-white text-xl">
          ×
        </button>

        <h2 className="text-2xl font-bold mb-4 text-center">Welcome to SoundByte</h2>
        <p className="text-sm text-center mb-6">Log in or create an account to start playing!</p>

        <div className="space-y-3 text-black">
          <input
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <motion.button
            className="w-full bg-darkestblue text-white py-2 rounded hover:bg-darkestblue transition disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
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

          <p className="text-center text-sm text-white mt-2">Don't have an account?</p>
          <button
            className="w-full border border-darkestblue text-white py-2 rounded hover:bg-darkestblue transition"
            onClick={onSwitchToSignUp}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthStepLogin;
