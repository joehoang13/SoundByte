import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useGameStore from '../stores/GameStore';

const GameScreen = () => {
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
          <div className="bg-darkblue rounded-xl p-10 w-full max-w-[900px] h-[600px] shadow-lg relative text-white">
            <h1 className="text-3xl font-bold mb-3 text-center">Game Screen</h1>
            <p className="text-center text-gray-500 mb-6">
              Snippet Length: {useGameStore.getState().snippetLength} seconds
            </p>

            <input
              type="text"
              placeholder="Enter your answer here..."
              className="w-full p-4 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default GameScreen;
