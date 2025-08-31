import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const gameTips = [
  '♩ Listen carefully to each audio snippet',
  '♫ Faster guesses earn bonus points',
  '♪ Build streaks for higher scores',
  '♬ Guess the song before time runs out',
];

const ReadyScreenTips = () => {
  const [currentTip, setCurrentTip] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % gameTips.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-[50px] sm:h-[60px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTip}
          className="absolute w-full text-center text-gray-300 font-medium text-lg sm:text-xl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          {gameTips[currentTip]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ReadyScreenTips;
