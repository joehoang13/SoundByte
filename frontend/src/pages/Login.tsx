import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/auth';

export default function Login() {
  // keep local name but it now carries email OR username
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/gamescreen';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // backend accepts identifier/email/username in the same field
      await authApi.login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center">
      <form
        onSubmit={onSubmit}
        className="bg-slate-800/70 p-6 rounded-xl w-full max-w-md text-white"
      >
        <h1 className="text-xl font-bold mb-4">Welcome to SoundByte</h1>
        <input
          className="w-full mb-2 p-3 rounded bg-slate-900"
          placeholder="Email or username"
          type="text"
          autoComplete="username"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="w-full mb-2 p-3 rounded bg-slate-900"
          placeholder="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button
          disabled={loading}
          className="w-full p-3 rounded bg-cyan-500 text-black disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
        {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}
      </form>
    </div>
  );
}
