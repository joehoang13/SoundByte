// path: frontend/src/pages/Login.tsx
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthStepLogin from '../components/GameSteps/AuthStepLogin';

/**
 * Adapter page for AuthStepLogin.
 * Note: AuthStepLoginProps.onLoginSuccess is typed as () => void (no args),
 * so we pass a zero-argument handler and only handle navigation here.
 */
export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-3">
        <AuthStepLogin
          onClose={() => navigate('/')} // close → back to landing
          onSwitchToSignUp={() => navigate('/signup')} // switch → signup route
          onLoginSuccess={() => {
            // If AuthStepLogin stores token itself, just navigate.
            // Otherwise, we can add a global store later.
            navigate('/gamescreen');
          }}
        />

        <p className="text-center text-sm">
          Don’t have an account?{' '}
          <Link className="underline" to="/signup">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
