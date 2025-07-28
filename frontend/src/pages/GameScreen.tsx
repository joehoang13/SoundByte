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

      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const barWidth = (WIDTH / dataArray.length) * 2.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * HEIGHT;
        ctx.fillStyle = '#3b82f6';
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
                  className="block mx-auto w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl h-[100px] border border-white rounded mb-4"
                />
                <div className="text-sm">now playing...</div>
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
          <input
            type="text"
            value={currentGuess}
            onChange={e => setCurrentGuess(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleGuess(currentGuess);
              }
            }}
            placeholder="Enter your answer here..."
            className="w-full p-3 sm:p-4 text-sm sm:text-base mb-4 rounded-2xl bg-darkblue text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

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
