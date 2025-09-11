// path: frontend/src/components/GameSteps/AuthStepSignUp.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { registerUser } from '../../api/api';
import { useAuth } from '../../stores/auth';

interface AuthStepSignUpProps {
  onClose: () => void;
  onSignUpSuccess: () => void;
  onSwitchToLogin: () => void;
  /** presentational only; used by parent for alignment */
  align?: 'start' | 'end';
  /** presentational only; parent sometimes hides a close button */
  hideClose?: boolean;
}

const AuthStepSignUp: React.FC<AuthStepSignUpProps> = ({ onSignUpSuccess }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { setAuth } = useAuth();

  const inputCls =
    'w-full py-3.5 px-4 rounded-2xl bg-white/5 text-white/90 placeholder-white/45 ' +
    'border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,.06)] ' +
    'focus:outline-none focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-400 ' +
    'transition-colors duration-200';

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
      const response = await registerUser({ email, username: username || undefined, password });
      setAuth(response.token, response.user);
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
    <div className="w-full">
      <h2 className="mb-6 text-2xl font-exo text-white text-center">Sign Up</h2>
      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-white/75">Email</label>
          <input
            className={inputCls}
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-white/75">
            Username <span className="text-white/50">(optional)</span>
          </label>
          <input
            className={inputCls}
            placeholder="yourname"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-white/75">Password</label>
          <input
            className={inputCls}
            placeholder="Create a password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-white/75">Confirm Password</label>
          <input
            className={inputCls}
            placeholder="Re-enter password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <motion.button
          className={`w-full py-3 rounded-2xl font-semibold transition-colors duration-200 ${
            busy
              ? 'bg-gray-600/50 text-white/70 cursor-not-allowed'
              : 'bg-cyan-600 text-white hover:bg-cyan-500'
          }`}
          whileHover={{ scale: busy ? 1 : 1.01 }}
          whileTap={{ scale: busy ? 1 : 0.99 }}
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
      </form>
    </div>
  );
};

export default AuthStepSignUp;
