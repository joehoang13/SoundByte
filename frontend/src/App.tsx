import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import UserProfile from './pages/UserProfile';
import Dashboard from './pages/Dashboard';
import GameScreen from './pages/GameScreen';
import InferenceScreen from './pages/InferenceScreen';
import EndScreen from './pages/EndScreen';
import ReadyScreen from './pages/ReadyScreen';
import GroupLobby from './pages/GroupLobby';
import Login from './pages/Login';
import EmailVerified from './pages/EmailVerified';
import Signup from './pages/Signup';
import Background from './components/Background';
import RequireAuth from './components/RequireAuth';
import { GameProvider } from './stores/GameSessionStore';
import './App.css';

export default function App() {
  return (
    <GameProvider>
      <Router>
        <Background />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <UserProfile />
              </RequireAuth>
            }
          />
          <Route
            path="/ready"
            element={
              <RequireAuth>
                <ReadyScreen />
              </RequireAuth>
            }
          />
          <Route
            path="/grouplobby"
            element={
              <RequireAuth>
                <GroupLobby />
              </RequireAuth>
            }
          />
          <Route
            path="/gamescreen"
            element={
              <RequireAuth>
                <GameScreen />
              </RequireAuth>
            }
          />
          <Route
            path="/inference"
            element={
              <RequireAuth>
                <InferenceScreen />
              </RequireAuth>
            }
          />
          <Route path="/email-verified" element={<EmailVerified />} />

          {/* Shared */}
          <Route path="/endscreen" element={<EndScreen />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </GameProvider>
  );
}
