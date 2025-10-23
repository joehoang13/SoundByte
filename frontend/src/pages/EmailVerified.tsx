import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const EmailVerified: React.FC = () => {
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let didCancel = false;

    const verifyEmail = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Missing verification token.');
        return;
      }

      try {
        const apiBase = import.meta.env.VITE_API_URL.replace(/\/$/, '');
        const res = await fetch(`${apiBase}/api/auth/verify-email?token=${token}`);
        if (!res.ok) throw new Error((await res.json()).message);

        const data = await res.json();
        if (!didCancel) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        }
      } catch (err: any) {
        console.error(err);
        if (!didCancel) {
          setStatus('error');
          setMessage(err.message || 'Verification failed.');
        }
      }
    };

    verifyEmail();

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
