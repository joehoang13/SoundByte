// path: frontend/src/components/GameSteps/AuthStepLogin.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { loginUser } from '../../api/api';
import { useAuth } from '../../stores/auth';

interface AuthStepLoginProps {
  onClose: () => void;
  onLoginSuccess: () => void;
  onSwitchToSignUp: () => void;
  /** presentational only; used by parent for alignment */
  align?: 'start' | 'end';
  /** presentational only; parent sometimes hides a close button */
  hideClose?: boolean;
}

const AuthStepLogin: React.FC<AuthStepLoginProps> = ({
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setAuth } = useAuth();

  const inputCls =
    'w-full py-3.5 px-4 rounded-2xl bg-white/5 text-white/90 placeholder-white/45 ' +
    'border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,.06)] ' +
    'focus:outline-none focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-400 ' +
    'transition-colors duration-200';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser({ email, password });
      setAuth(response.token, response.user);
      onLoginSuccess();
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <h2 className="mb-6 text-2xl font-exo text-white text-center">Log In</h2>
      {/* Added pl-6 to push content slightly right */}
      <form onSubmit={handleLogin} className="space-y-4 pl-6">
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
          <label className="block text-sm font-medium text-white/75">Password</label>
          <input
            className={inputCls}
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <motion.button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-2xl font-semibold bg-cyan-600 text-white
                     hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed
                     transition-colors duration-200"
          whileHover={{ scale: loading ? 1 : 1.01 }}
          whileTap={{ scale: loading ? 1 : 0.99 }}
        >
          {loading ? 'Logging in…' : 'Log In'}
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

export default AuthStepLogin;
