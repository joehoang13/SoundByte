// path: frontend/src/pages/EmailVerified.tsx
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const EmailVerified: React.FC = () => {
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  // why: VITE_API_URL may be undefined in prod; prefer VITE_API_BASE or same-origin
  function resolveApiBase(): string {
    const raw =
      (import.meta as any).env?.VITE_API_BASE ||
      (import.meta as any).env?.VITE_API_URL ||
      window.location.origin;
    return String(raw).replace(/\/+$/, '');
  }

  async function tryJson(res: Response) {
    try { return await res.json(); } catch { return {}; }
  }

  useEffect(() => {
    let didCancel = false;

    (async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Missing verification token.');
        return;
      }

      const apiBase = resolveApiBase();
      const enc = encodeURIComponent(token);

      // candidate endpoints to try in order
      const attempts: Array<() => Promise<Response>> = [
        () => fetch(`${apiBase}/api/auth/verify-email?token=${enc}`, { method: 'GET' }),
        () => fetch(`${apiBase}/api/auth/verify?token=${enc}`, { method: 'GET' }),
        () =>
          fetch(`${apiBase}/api/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          }),
      ];

      try {
        let lastErrMsg = 'Verification failed.';
        for (const attempt of attempts) {
          const res = await attempt();
          const data = await tryJson(res);
          if (res.ok) {
            if (didCancel) return;
            setStatus('success');
            setMessage(data?.message || 'Email verified successfully!');
            return;
          }
          // capture error and continue to next fallback
          lastErrMsg = data?.message || `${res.status} ${res.statusText}`;
          // only fallback on routing/method issues
          if (![400, 404, 405].includes(res.status)) break;
        }
        if (!didCancel) {
          setStatus('error');
          setMessage(lastErrMsg);
        }
      } catch (err: any) {
        if (!didCancel) {
          setStatus('error');
          setMessage(err?.message || 'Verification failed.');
        }
      }
    })();

    return () => {
      didCancel = true;
    };
  }, [location.search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-darkblue text-white px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === 'pending' && (
          <div>
            <h1 className="text-3xl font-bold mb-2">Verifying...</h1>
            <p>Please wait while we verify your email.</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <h1 className="text-3xl font-bold text-green-400 mb-2">Success 🎉</h1>
            <p>{message}</p>
            <div className="mt-6 space-x-4">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold"
              >
                Go to Homepage
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-lg font-semibold"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div>
            <h1 className="text-3xl font-bold text-red-400 mb-2">Oops 😓</h1>
            <p>{message}</p>
            <div className="mt-6 space-x-4">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold"
              >
                Return Home
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-lg font-semibold"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailVerified;
