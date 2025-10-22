import { useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { logout } from '../api/auth';

const NavBar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between p-6 bg-darkblue/95 rounded-xl"
      style={{
        borderBottom: `1px solid rgba(255,255,255,0.10)`,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center space-x-8">
        <h1
          className="text-2xl font-exo font-bold text-teal tracking-widest cursor-pointer"
          style={{ textShadow: '0 0 20px rgba(15, 193, 233, 0.5)' }}
          onClick={() => navigate('/dashboard')}
        >
          SOUNDBYTE
        </h1>
      </div>

      {/* Navigation Tabs */}
      <div className="hidden md:flex space-x-6">
        <button
          className="px-4 py-2 text-sm text-white transition-colors hover:text-teal"
          onClick={() => navigate('/dashboard')}
        >
          HOME
        </button>
        <button
          className="px-4 py-2 text-sm text-white transition-colors hover:text-teal"
          onClick={() => navigate('/profile')}
        >
          PROFILE
        </button>
        <button
          className="px-4 py-2 text-sm text-white transition-colors hover:text-teal"
          onClick={() => navigate('/settings')}
        >
          SETTINGS
        </button>
      </div>

      {/* User Info */}
      {user && (
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-teal">
              {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <span className="text-sm text-grayblue">
            {user.username || user.email?.split('@')[0] || 'Player'}
          </span>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs rounded-xl transition-colors hover:bg-red-500"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)', color: 'white' }}
          >
            LOGOUT
          </button>
        </div>
      )}
    </nav>
  );
};

export default NavBar;
