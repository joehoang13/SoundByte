import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AuthStepLogin from './AuthStepLogin';
import AuthStepSignUp from './AuthStepSignUp';
import GamePrefStep from './GamePrefStep';

interface GameStepsModalProps {
  onClose: () => void;
}

const GameStepsModal: React.FC<GameStepsModalProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'login' | 'signup' | 'gamepref'>('login');
  const handleSwitchToSignUp = () => setStep('signup');
  const handleSwitchToLogin = () => setStep('login');

  const handleLoginSuccess = () => {
    setStep('gamepref');
  };

  const handleSignUpSuccess = () => {
    setStep('login');
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
      {step === 'login' && (
        <AuthStepLogin
          onLoginSuccess={handleLoginSuccess}
          onClose={handleClose}
          onSwitchToSignUp={handleSwitchToSignUp}
        />
      )}
      {step === 'signup' && (
        <AuthStepSignUp
          onSignUpSuccess={handleSignUpSuccess}
          onClose={handleClose}
          onSwitchToLogin={handleSwitchToLogin}
        />
      )}
      {step === 'gamepref' && <GamePrefStep onClose={handleClose} onStartGame={handleStartGame} />}
    </>
  );
};

export default GameStepsModal;
