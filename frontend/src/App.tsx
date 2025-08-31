// path: frontend/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import UserProfile from './pages/UserProfile';
import GameScreen from './pages/GameScreen';
import EndScreen from './pages/EndScreen';
import ReadyScreen from './pages/ReadyScreen';
import Login from './pages/Login';
import Signup from './pages/Signup';
import RequireAuth from './components/RequireAuth';
import Background from './components/Background';
import './App.css';

export default function App() {
  return (
    <Router>
      <Background />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
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
          path="/gamescreen"
          element={
            <RequireAuth>
              <GameScreen />
            </RequireAuth>
          }
        />
        <Route path="/endscreen" element={<EndScreen />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
