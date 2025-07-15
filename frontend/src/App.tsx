import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import GameScreen from './pages/GameScreen';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/gamescreen" element={<GameScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
