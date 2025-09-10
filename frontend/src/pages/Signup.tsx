import { useNavigate, Link } from 'react-router-dom';
import AuthStepSignUp from '../components/Auth/AuthStepSignUp';

/** Adapter page for AuthStepSignUp expecting callbacks */
export default function Signup() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-3">
        <AuthStepSignUp
          onClose={() => navigate('/')} // back to landing
          onSwitchToLogin={() => navigate('/login')}
          onSignUpSuccess={() => {
            // If the inner component already persists auth, just navigate.
            navigate('/gamescreen');
          }}
        />

        <p className="text-center text-sm">
          Already have an account?{' '}
          <Link className="underline" to="/login">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
