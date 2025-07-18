import React, { useState, useEffect, useRef, use } from 'react';
import { Howl } from 'howler';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useGameStore from '../stores/GameStore';
import { ClassicModeSnippet } from '../types/classicModeSnippets';
import { audio, nav } from 'framer-motion/client';

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

  const soundRef = useRef<Howl | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const sound = new Howl({
      src: [audioUrl],
      volume: 1.0,
      onplay: () => setupAnalyser(),
    });

    soundRef.current = sound;
    sound.play();

    timeoutRef.current = window.setTimeout(() => {
      sound.stop();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }, snippetLength * 1000);

    return () => {
      sound.stop();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [audioUrl, snippetLength]);

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

  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s']/g, '') // Remove special characters except apostrophes
      .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
      .trim(); // Trim leading and trailing spaces
  };

  const handleGuess = (userGuess: string) => {
    const isCorrect = normalize(userGuess) === normalize(currentSnippet.title);
    const timeElapsed = (Date.now() - startTime) / 1000;
    const timeTaken = Math.round(timeElapsed * 100) / 100; // Round to 2 decimal places
    const fastestTime = useGameStore.getState().fastestTime;

    const newGuess: Guess = {
      guessNum: guessHistory.length + 1,
      userGuess,
      isCorrect,
      timeTaken: timeTaken,
    };
    setGuessHistory(prev => [...prev, newGuess]);
    setCurrentGuess('');

    if (isCorrect) {
      useGameStore.getState().setScore(useGameStore.getState().score + 1);
      useGameStore.getState().setStreak(useGameStore.getState().streak + 1);
      useGameStore.getState().setCorrectAnswers(useGameStore.getState().correctAnswers + 1);
      if (fastestTime === Infinity || timeTaken < fastestTime) {
        useGameStore.getState().setFastestTime(timeTaken);
      }
      useGameStore.getState().setTimeBonus(useGameStore.getState().timeBonus + timeTaken);
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
            <div className="flex flex-row justify-between items-center">
              <h1 className="text-xl text-gray-500 font-bold mb-3 text-center">
                {' '}
                Score: {useGameStore.getState().score}
              </h1>
              <h1 className="text-3xl font-bold mb-3 text-center">Game Screen</h1>
              <h1 className="text-xl text-gray-500 font-bold mb-3 text-center">
                {' '}
                Streak: {useGameStore.getState().streak}
              </h1>
            </div>

            <p className="text-center text-gray-500 mb-6">
              Snippet Length: {useGameStore.getState().snippetLength} seconds
            </p>

            <canvas
              ref={canvasRef}
              width={600}
              height={150}
              className="border border-white rounded mb-6 block mx-auto"
            />

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
              className="w-full p-4 mb-4 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="max-h-48 flex flex-col overflow-y-auto pr-2">
              <h2 className="text-xl font-semibold">Your Previous Guesses:</h2>
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
      </div>
    </>
  );
};

export default GameScreen;
