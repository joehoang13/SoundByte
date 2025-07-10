import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AuthStep from './AuthStep';
import GamePrefStep from './GamePrefStep';

interface GameStepsModalProps {
  onClose: () => void;
}

const GameStepsModal: React.FC<GameStepsModalProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'auth' | 'gamepref'>('auth');

  const handleLoginSuccess = () => {
    setStep('gamepref');
  };

  const handleClose = () => {
    onClose();
  };

  const handleStartGame = (snippetLength: number) => {
    console.log('Start game with snippet length:', snippetLength);
    navigate('/gamescreen');
  };

  return (
    <>
      {step === 'auth' && <AuthStep onLoginSuccess={handleLoginSuccess} onClose={handleClose} />}
      {step === 'gamepref' && <GamePrefStep onClose={handleClose} onStartGame={handleStartGame} />}
    </>
  );
};

export default GameStepsModal;
