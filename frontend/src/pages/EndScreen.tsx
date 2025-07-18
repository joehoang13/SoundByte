import React, { use } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useGameStore from '../stores/GameStore';

const EndScreen = () => {
  const navigate = useNavigate();

  return (
    <>
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1,
          backgroundColor: '#143D4D',
          backgroundImage: `
                            radial-gradient(circle at 20% 30%, #0FC1E9 0%, transparent 40%),
                            radial-gradient(circle at 80% 70%, #274D5B 0%, transparent 50%),
                            radial-gradient(circle at 50% 50%, #90A4AB 0%, transparent 60%)
                            `,
          backgroundSize: '250% 250%',
        }}
        initial={{ backgroundPosition: '0% 0%' }}
        animate={{
          backgroundPosition: [
            '0% 0%',
            '25% 45%',
            '70% 30%',
            '85% 75%',
            '30% 60%',
            '20% 90%',
            '0% 0%',
          ],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      ></motion.div>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1,
          pointerEvents: 'none',
          backgroundImage: "url('/noise.png')",
          opacity: 0.4,
          mixBlendMode: 'overlay',
          backgroundRepeat: 'repeat',
        }}
      />

      <div className="min-h-screen flex items-center justify-center">
        <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen">
          <div className="bg-darkblue rounded-xl p-10 w-full max-w-[600px] h-[450px] flex flex-col justify-between shadow-lg relative text-white">
            <div className="flex flex-col items-center">
              <h1 className="text-3xl font-bold mb-5 text-center">Game Complete</h1>

              <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-full h-20 mb-3">
                <span className="text-xl font-bold text-center">
                  {useGameStore.getState().score}
                </span>
                <span className="text-sm text-center">Final Score</span>
              </div>

              <div className="flex flex-row justify-between items-center gap-4 w-full">
                <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                  <span className="text-xl font-bold text-center">
                    {useGameStore.getState().correctAnswers}
                  </span>
                  <span className="text-sm text-center">Correct Answers</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                  <span className="text-xl font-bold text-center">
                    {useGameStore.getState().streak}
                  </span>
                  <span className="text-sm text-center">Streak</span>
                </div>
              </div>
              <div className="flex flex-row justify-between items-center gap-4 w-full">
                <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                  <span className="text-xl font-bold text-center">
                    {useGameStore.getState().fastestTime === Infinity
                      ? 'N/A'
                      : useGameStore.getState().fastestTime + 's'}
                  </span>
                  <span className="text-sm text-center">Fastest Time</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                  <span className="text-xl font-bold text-center">
                    {useGameStore.getState().timeBonus}
                  </span>
                  <span className="text-sm text-center">Time Bonus</span>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <motion.button
                className="w-48 px-4 py-2 bg-darkestblue text-white py-2 rounded hover:bg-darkestblue transition"
                whileHover={{ scale: 1.05 }}
                onClick={() => {
                  useGameStore.getState().setScore(0);
                  useGameStore.getState().setStreak(0);
                  useGameStore.getState().setCorrectAnswers(0);
                  navigate('/');
                }}
              >
                Play Again
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EndScreen;
