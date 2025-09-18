import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useGameStore from '../stores/GameSessionStore';

const EndScreen = () => {
  const navigate = useNavigate();
  const score = useGameStore(s => s.score);
  const correctAnswers = useGameStore(s => s.correctAnswers);
  const streak = useGameStore(s => s.streak);
  const fastestTime = useGameStore(s => s.fastestTime);
  const timeBonus = useGameStore(s => s.timeBonus);
  const reset = useGameStore(s => s.reset);

  return (
    <>
      <motion.div /* animated bg */
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1,
          backgroundColor: '#143D4D',
          backgroundImage: `radial-gradient(circle at 50% 40%, #0FC1E9 0%, transparent 65%),radial-gradient(circle at 60% 60%, #90A4AB 0%, transparent 70%),radial-gradient(circle at 85% 85%, #274D5B 0%, transparent 50%)`,
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

      <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
        <div className="bg-darkblue rounded-xl w-full max-w-[600px] min-h-[450px] h-auto flex flex-col justify-between shadow-lg relative text-white p-6 sm:p-10">
          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-bold mb-5 text-center">Game Complete</h1>

            <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-full h-20 mb-3">
              <span className="text-xl font-bold text-center">{score}</span>
              <span className="text-sm text-center">Final Score</span>
            </div>

            <div className="flex flex-row justify-between items-center gap-4 w-full">
              <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                <span className="text-xl font-bold text-center">{correctAnswers}</span>
                <span className="text-sm text-center">Correct Answers</span>
              </div>
              <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                <span className="text-xl font-bold text-center">{streak}</span>
                <span className="text-sm text-center">Streak</span>
              </div>
            </div>
            <div className="flex flex-row justify-between items-center gap-4 w-full">
              <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                <span className="text-xl font-bold text-center">
                  {fastestTime === Infinity ? 'N/A' : `${fastestTime}s`}
                </span>
                <span className="text-sm text-center">Fastest Time</span>
              </div>
              <div className="flex flex-col items-center justify-center bg-darkestblue rounded-xl px-6 py-4 w-1/2 h-20 mb-3">
                <span className="text-xl font-bold text-center">{timeBonus}</span>
                <span className="text-sm text-center">Time Bonus</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
            <motion.button
              className="w-48 px-4 py-2 bg-darkestblue text-white rounded hover:bg-darkestblue transition"
              whileHover={{ scale: 1.05 }}
              onClick={() => {
                reset();
                navigate('/dashboard');
              }}
            >
              Play Again
            </motion.button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EndScreen;
