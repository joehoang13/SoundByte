import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const t = params.get('token');
    if (t) setToken(t);
    else setMessage('Missing token.');
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage('Passwords do not match.');
      return;
    }
    setStatus('loading');
    try {
      const apiBase = import.meta.env.VITE_API_URL.replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setStatus('success');
      setMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-darkblue text-white px-4">
      <div className="max-w-md w-full p-6 bg-darkblue/80 backdrop-blur-sm rounded-xl text-center space-y-6 border border-white/10">
        <h2 className="text-2xl font-bold">Reset Password</h2>

        {status === 'success' ? (
          <p className="text-green-400">{message}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full py-3 px-4 rounded-xl bg-white/5 text-white"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full py-3 px-4 rounded-xl bg-white/5 text-white"
            />
            <button
              type="submit"
              className={`w-full py-3 rounded-xl font-semibold transition-colors duration-200 ${
                status === 'loading'
                  ? 'bg-gray-600/50 text-white/70 cursor-not-allowed'
                  : 'bg-cyan-600 text-white hover:bg-cyan-500'
              }`}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Resetting...' : 'Set New Password'}
            </button>
            {message && <p className="text-sm text-red-300">{message}</p>}
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
