// path: frontend/src/components/GameSteps/AuthStepSignUp.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { registerUser } from '../../api/api';

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
    <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen bg-black bg-opacity-25">
      <div className="bg-darkblue rounded-xl p-10 w-[90%] max-w-lg shadow-lg relative text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 hover:text-black dark:hover:text-white text-xl"
        >
          ×
        </button>

        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 text-center">
          Welcome to SoundByte
        </h2>
        <p className="text-sm sm:text-base text-center mb-6">Create an account to start playing!</p>

        <form onSubmit={handleSignup} className="space-y-3 text-black">
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
            placeholder="Username (optional)"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <input
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />

          <motion.button
            className="w-full bg-darkestblue text-white py-2 rounded hover:bg-darkestblue transition disabled:opacity-50"
            whileHover={{ scale: busy ? 1 : 1.05 }}
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

          <p className="text-center text-sm sm:text-base text-white mt-2">
            Already have an account?
          </p>
          <button
            type="button"
            className="w-full border border-darkestblue text-white py-2 rounded hover:bg-darkestblue hover:text-white transition"
            onClick={onSwitchToLogin}
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthStepSignUp;
