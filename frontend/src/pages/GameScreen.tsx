import React, { useState, useEffect, useRef, use } from 'react';
import { Howl } from 'howler';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useGameStore from '../stores/GameStore';
import { ClassicModeSnippet } from '../types/classicModeSnippets';
import { timeBonusPtSystem } from '../utils/timeBonusPtSystem';
import replayIcon from '../assets/replay-white.png';
import { audio, nav, s } from 'framer-motion/client';

interface Guess {
  guessNum: number;
  userGuess: string;
  isCorrect: boolean;
  timeTaken: number;
}

const GameScreen = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState(ClassicModeSnippet);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [currentGuess, setCurrentGuess] = useState('');
  const [guessHistory, setGuessHistory] = useState<Guess[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const snippetLength = useGameStore.getState().snippetLength;
  const currentSnippet = questions[currentQuestion];
  const correctAnswer = currentSnippet.title;
  const audioUrl = currentSnippet.audioUrl;
  const [isPlaying, setIsPlaying] = useState(true);
  const [replayCount, setReplayCount] = useState(0);

  const soundRef = useRef<Howl | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);

  // plays the audio snippet and sets up the analyser
  useEffect(() => {
    const sound = new Howl({
      src: [audioUrl],
      volume: 1.0,
      onplay: () => setupAnalyser(),
      onend: () => setIsPlaying(false),
    });

    soundRef.current = sound;
    sound.play();

    timeoutRef.current = window.setTimeout(() => {
      sound.stop();
      setIsPlaying(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }, snippetLength * 1000);

    setReplayCount(0);
    setIsPlaying(true);

    return () => {
      sound.stop();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [audioUrl, snippetLength]);

  const handleReplay = (): void => {
    if (!soundRef.current || replayCount >= 1) return;

    soundRef.current.play();
    setupAnalyser();

    timeoutRef.current = window.setTimeout(() => {
      soundRef.current?.stop();
      setIsPlaying(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }, snippetLength * 1000);

    setReplayCount(prev => prev + 1);
    setIsPlaying(true);
  };

  const setupAnalyser = () => {
    const ctx = Howler.ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    const rawSound = (soundRef.current as any)?._sounds?.[0];
    const srcNode = rawSound?._node?.bufferSource;

    if (srcNode) {
      srcNode.connect(analyser);
      analyser.connect(ctx.destination);
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyserRef.current = analyser;
    dataArrayRef.current = dataArray;

    draw();
  };

  const draw = () => {
    if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const drawLoop = () => {
      if (!ctx || !analyser) return;

      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // const barWidth = (WIDTH / Math.min(dataArray.length, 64)) * 0.8;
      const barWidth = (WIDTH / dataArray.length) * 2.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * HEIGHT;
        const gradient = ctx.createLinearGradient(0, HEIGHT, 0, HEIGHT - barHeight);
        gradient.addColorStop(0, '#0FC1E9');
        gradient.addColorStop(1, '#90A4AB');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(drawLoop);
    };

    drawLoop();
  };

  // This function removes special characters and normalizes the case
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s']/g, '') // Remove special characters except apostrophes
      .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
      .trim(); // Trim leading and trailing spaces
  };

  // Calculates the time bonus based on the time taken and the game mode
  const getTimeBonus = (timeTaken: number): number => {
    const gameMode = useGameStore.getState().gameMode;
    const snippetLength = useGameStore.getState().snippetLength;

    const thresholds = timeBonusPtSystem[gameMode]?.[snippetLength];
    if (!thresholds) return 0;

    for (const { time, points } of thresholds) {
      if (timeTaken < time) return points;
    }

    return 0;
  };

  // Handles the user's guess, checks if it's correct, and updates the game state
  const handleGuess = (userGuess: string) => {
    const isCorrect = normalize(userGuess) === normalize(currentSnippet.title);
    const timeElapsed = (Date.now() - startTime) / 1000;
    const timeTaken = Math.round(timeElapsed * 100) / 100; // Round to 2 decimal places
    const timeBonusPts = getTimeBonus(timeTaken);
    const fastestTime = useGameStore.getState().fastestTime;
    const updateGuessNum = guessHistory.length + 1;

    const newGuess: Guess = {
      guessNum: guessHistory.length + 1,
      userGuess,
      isCorrect,
      timeTaken: timeTaken,
    };
    setGuessHistory(prev => [...prev, newGuess]);
    setCurrentGuess('');

    if (updateGuessNum > 4 && !isCorrect) {
      alert('You have reached the maximum number of guesses for this question.');
      setCurrentQuestion(prev => prev + 1);
      setGuessHistory([]);
      setStartTime(Date.now());
      if (currentQuestion + 1 >= questions.length) {
        navigate('/endscreen'); // Navigate to EndScreen when all questions are answered
      }
      return;
    }

    if (isCorrect) {
      useGameStore.getState().setStreak(useGameStore.getState().streak + 1);
      useGameStore.getState().setCorrectAnswers(useGameStore.getState().correctAnswers + 1);
      if (fastestTime === Infinity || timeTaken < fastestTime) {
        useGameStore.getState().setFastestTime(timeTaken);
      }
      useGameStore.getState().setTimeBonus(useGameStore.getState().timeBonus + timeBonusPts);

      useGameStore.getState().setScore(useGameStore.getState().score + 1000 + timeBonusPts);

      console.log(
        `%c[RESULT] Q${currentQuestion + 1}: "${currentSnippet.title}" | Time: ${timeTaken}s | Bonus: ${timeBonusPts} pts`,
        'color: #4ade80; font-weight: bold;'
      );

      console.log(
        `%c[SCORE] Base: 1000 pts + Bonus: ${timeBonusPts} pts → Total: ${useGameStore.getState().score} pts`,
        'color: #facc15; font-weight: bold;'
      );

      console.log(
        `%c[TIME BONUS] +${timeBonusPts} pts → Accumulated Total: ${useGameStore.getState().timeBonus} pts`,
        'color: #38bdf8; font-weight: bold;'
      );

      setCurrentQuestion(prev => prev + 1);
      setStartTime(Date.now());
      setGuessHistory([]);
      if (currentQuestion + 1 >= questions.length) {
        setCurrentQuestion(0);
        setGuessHistory([]);
        navigate('/endscreen'); // Navigate to EndScreen when all questions are answered
      }
    } else {
      useGameStore.getState().setStreak(0);
    }
  };

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
        <div className="flex flex-col bg-darkblue/80 backdrop-blur-sm rounded-2xl w-full max-w-[900px] min-h-[90dvh] sm:min-h-[500px] h-auto shadow-lg relative text-white p-4 sm:p-10">
          {/* Header with score and streak display */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-4">
            <div className="flex-1 flex justify-center">
              <div className="flex flex-col items-center bg-darkblue/75 rounded-xl w-40 px-6 py-4">
                <span className="text-sm font-bold text-center">Score</span>
                <span className="text-xl font-bold text-center">
                  {useGameStore.getState().score}
                </span>
              </div>
            </div>

            <div className="flex-1 flex justify-center">
              <h1 className="text-2xl font-bold text-center">Game Screen</h1>
            </div>

            <div className="flex-1 flex justify-center">
              <div className="flex flex-col items-center bg-darkblue/75 rounded-xl w-40 px-6 py-4">
                <span className="text-sm font-bold text-center">Streak</span>
                <span className="text-xl font-bold text-center">
                  {useGameStore.getState().streak}
                </span>
              </div>
            </div>
          </div>

          {/* Current audio display */}
          <p className="text-center mb-6">
            Snippet Length: {useGameStore.getState().snippetLength} seconds
          </p>

          <div className="flex items-center justify-center w-full rounded-lg px-4 sm:px-6">
            {/* Add bg-darkblue/75 back to the class to create a container */}
            {isPlaying ? (
              <div className="flex flex-col items-center py-4 mb-4 w-full">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={80}
                  className="w-full h-full mb-4"
                  style={{ imageRendering: 'pixelated' }}
                />
                <motion.div
                  className="text-sm"
                  style={{ color: '#90A4AB' }}
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  now playing...
                </motion.div>
              </div>
            ) : replayCount < 1 ? (
              <div className="flex justify-center mb-6">
                <button
                  onClick={handleReplay}
                  className="px-3 py-3 bg-white/10 hover:bg-white/20 rounded-3xl"
                >
                  <img src={replayIcon} alt="Replay" className="w-6 h-6" />
                </button>
              </div>
            ) : (
              <p className="text-center mb-6">No more replays allowed for this round.</p>
            )}
          </div>

          {/* Guess input and history display */}
          <div className="relative mb-6">
            <div className="relative bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-cyan-400/20 p-[2px] rounded-2xl">
              <div className="flex bg-darkblue/90 rounded-2xl overflow-hidden backdrop-blur-sm">
                <input
                  type="text"
                  value={currentGuess}
                  onChange={e => setCurrentGuess(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && currentGuess.trim()) {
                      handleGuess(currentGuess.trim());
                    }
                  }}
                  placeholder="Enter your answer here..."
                  className="flex-1 p-4 sm:p-5 text-sm sm:text-base bg-transparent text-white placeholder-gray-300 text-center focus:outline-none transition-all duration-300 focus:placeholder-transparent"
                  style={{ textShadow: '0 0 10px rgba(15, 193, 233, 0.3)' }}
                />

                <motion.button
                  onClick={() => {
                    if (currentGuess.trim()) {
                      handleGuess(currentGuess.trim());
                    }
                  }}
                  disabled={!currentGuess.trim()}
                  className={`px-6 sm:px-8 font-bold py-4 sm:py-5 transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
                    !currentGuess.trim()
                      ? 'bg-gray-700/50 cursor-not-allowed text-gray-500'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg hover:shadow-cyan-500/25'
                  }`}
                  whileHover={currentGuess.trim() ? { scale: 1.02 } : {}}
                  whileTap={currentGuess.trim() ? { scale: 0.98 } : {}}
                >
                  <span className="relative z-10 flex items-center gap-2">Submit</span>
                </motion.button>
              </div>
            </div>

            {currentGuess.trim() && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl"
                animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.02, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{ zIndex: -1 }}
              />
            )}
          </div>

          <div className="bg-darkblue rounded-2xl p-4 max-h-48 flex-grow overflow-y-auto pr-2">
            <h2 className="text-base sm:text-lg font-semibold mb-2">Your Guesses:</h2>
            <ul className="space-y-2 overflow-y-auto">
              {guessHistory.map(guess => (
                <li key={guess.guessNum} className="flex justify-between">
                  <span>
                    Attempt {guess.guessNum}: {guess.userGuess}
                  </span>
                  <span className={guess.isCorrect ? 'text-green-400' : 'text-red-400'}>
                    {guess.isCorrect ? 'Correct' : `Incorrect (${guess.timeTaken} seconds)`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default GameScreen;
