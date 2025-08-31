import React from 'react';
import { motion } from 'framer-motion';

const Background: React.FC = () => (
  <>
    {/* Gradient animation */}
    <motion.div
      className="fixed inset-0 -z-20"
      style={{
        backgroundColor: '#143D4D',
        backgroundImage: `
          radial-gradient(circle at 50% 40%, #0FC1E9 0%, transparent 65%),
          radial-gradient(circle at 60% 60%, #90A4AB 0%, transparent 70%),
          radial-gradient(circle at 85% 85%, #274D5B 0%, transparent 50%)
        `,
        backgroundSize: '250% 250%',
      }}
      initial={{ backgroundPosition: '0% 0%' }}
      animate={{
        backgroundPosition: [
          '30% 20%',
          '60% 40%',
          '40% 75%',
          '70% 60%',
          '20% 70%',
          '50% 50%',
          '30% 20%',
        ],
      }}
      transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
    />

    {/* Noise overlay */}
    <div
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        backgroundImage: "url('/noise.png')",
        opacity: 0.4,
        mixBlendMode: 'overlay',
        backgroundRepeat: 'repeat',
      }}
    />
  </>
);

export default Background;

