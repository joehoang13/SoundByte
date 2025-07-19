import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import GameScreen from './pages/GameScreen';
import EndScreen from './pages/EndScreen';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/gamescreen" element={<GameScreen />} />
        <Route path="/endscreen" element={<EndScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
