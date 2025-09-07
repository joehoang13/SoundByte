import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

/**
 * InferenceScreen — Inference mode (question + lyrics)
 * Adds a gamemode pill with a dropdown to switch to Classic mode.
 */

type Prompt = {
  id: string;
  question: string;
  lyrics: string;
  answer: string;
};

type GuessRow = {
  guessNum: number;
  userGuess: string;
  isCorrect: boolean;
};

const COLORS = {
  grayblue: '#90A4AB',
  darkblue: '#274D5B',
  teal: '#0FC1E9',
  darkestblue: '#143D4D',
};

const SAMPLE_PROMPTS: Prompt[] = [
  { id: 'p1', question: 'Which National Anthem opens with these lines?', lyrics: `"O say can you see, by the dawn’s early light,"`, answer: 'Star Spangled Banner' },
  { id: 'p2', question: 'Name the artist who sings this hook:', lyrics: `"Cause baby you’re a firework\nCome on, show ’em what you’re worth"`, answer: 'Katy Perry' },
  { id: 'p3', question: 'What song is this chorus from?', lyrics: `"Hello from the other side\nI must’ve called a thousand times"`, answer: 'Hello' },
];

function norm(x: string) {
  return x.toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
}

const InferenceScreen: React.FC = () => {
  const navigate = useNavigate();
  const prompts = useMemo(() => SAMPLE_PROMPTS, []);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [history, setHistory] = useState<GuessRow[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [concluded, setConcluded] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);

  const current = prompts[idx];
  const totalRounds = prompts.length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const g = guess.trim();
    if (!g || concluded) return;

    const correct = norm(g) === norm(current.answer);
    setHistory(prev => [...prev, { guessNum: prev.length + 1, userGuess: g, isCorrect: correct }]);
    setGuess('');

    if (correct) {
      setScore(s => s + 100);
      setStreak(s => s + 1);
      setConcluded(true);
    } else {
      setAttemptsLeft(a => a - 1);
      if (attemptsLeft - 1 <= 0) setConcluded(true);
    }
  };

  const goNext = () => {
    if (idx + 1 >= totalRounds) {
      navigate('/endscreen');
      return;
    }
    setIdx(i => i + 1);
    setAttemptsLeft(3);
    setHistory([]);
    setConcluded(false);
    setGuess('');
  };

  const disableInput = concluded || attemptsLeft <= 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
      <motion.div
        className="flex flex-col bg-darkblue/80 backdrop-blur-sm rounded-2xl w-full max-w-[900px] min-h-[90dvh] sm:min-h-[500px] h-auto shadow-lg relative text-white p-4 sm:p-10"
        style={{ backgroundColor: COLORS.darkblue }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Settings */}
        <motion.button
          className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/ready')}
          aria-label="Open Settings"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="currentColor"/>
            <path d="M19.43 12.98a7.94 7.94 0 0 0 .05-.98 7.94 7.94 0 0 0-.05-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.78 7.78 0 0 0-1.7-.98l-.38-2.65A.5.5 0 0 0 12 1h-4a.5.5 0 0 0-.49.41l-.38 2.65c-.62.24-1.2.56-1.74.95l-2.47-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64L2.57 11a7.94 7.94 0 0 0-.05.98c0 .33.02.66.05.98L.46 14.61a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.54.39 1.13.71 1.74.95l.38 2.65A.5.5 0 0 0 8 23h4a.5.5 0 0 0 .49-.41l.38-2.65c.62-.24 1.2-.56 1.74-.95l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64L19.43 12.98z" fill="currentColor"/>
          </svg>
        </motion.button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-4">
          <div className="flex-1 flex justify-center">
            <div className="flex flex-col items-center rounded-xl w-40 px-6 py-4" style={{ backgroundColor: 'rgba(20, 61, 77, 0.65)' }}>
              <span className="text-sm font-bold text-center">Score</span>
              <span className="text-xl font-bold text-center">{score}</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative">
            <h1 className="text-2xl font-bold text-center">Inference</h1>

            {/* Gamemode pill w/ dropdown */}
            <div className="mt-2 relative">
              <button
                onClick={() => setModeOpen(o => !o)}
                onBlur={() => setTimeout(() => setModeOpen(false), 150)}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs sm:text-sm tracking-wide"
                style={{
                  borderColor: COLORS.teal,
                  backgroundColor: 'rgba(20, 61, 77, 0.4)',
                  color: COLORS.grayblue,
                }}
                aria-haspopup="listbox"
                aria-expanded={modeOpen}
              >
                <span className="inline-block rounded-full" style={{ width: 8, height: 8, backgroundColor: COLORS.teal }} />
                Inference Mode
                <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-80">
                  <path fill="currentColor" d="M7 10l5 5 5-5z" />
                </svg>
              </button>

              {modeOpen && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 mt-2 w-44 rounded-xl border shadow-lg overflow-hidden z-20"
                  role="listbox"
                  style={{ backgroundColor: COLORS.darkestblue, borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => navigate('/gamescreen')}
                  >
                    Classic Mode
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => navigate('/inference')}
                  >
                    Inference Mode
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="flex flex-col items-center rounded-xl w-40 px-6 py-4" style={{ backgroundColor: 'rgba(20, 61, 77, 0.65)' }}>
              <span className="text-sm font-bold text-center">Streak</span>
              <span className="text-xl font-bold text-center">{streak}</span>
            </div>
          </div>
        </div>

        {/* Round progress */}
        <p className="text-center mb-6" style={{ color: COLORS.grayblue }}>
          Round {idx + 1} / {totalRounds} • Attempts left: {attemptsLeft}
        </p>

        {/* Prompt Card */}
        <div
          className="w-full rounded-2xl px-5 py-6 mb-6 shadow-inner"
          style={{
            background: `linear-gradient(180deg, rgba(15,193,233,0.08), rgba(20,61,77,0.35))`,
            border: `1px solid rgba(255,255,255,0.08)`,
          }}
        >
          <div className="mb-3 text-sm tracking-wide" style={{ color: COLORS.grayblue }}>
            Question
          </div>
          <h3 className="text-xl sm:text-2xl font-semibold mb-5 leading-snug">
            {current.question}
          </h3>

          <div className="mb-2 text-sm tracking-wide" style={{ color: COLORS.grayblue }}>
            Lyrics Excerpt
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(144,164,171,0.35)' }}>
            <pre className="whitespace-pre-wrap font-mono text-sm sm:text-base" style={{ color: '#E9F1F5' }}>
{current.lyrics}
            </pre>
          </div>
        </div>

        {/* Answer input */}
        <form onSubmit={submit} className="relative mb-6">
          <div className="relative bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-cyan-400/20 p-[2px] rounded-2xl">
            <div className="flex rounded-2xl overflow-hidden backdrop-blur-sm" style={{ backgroundColor: 'rgba(20,61,77,0.9)' }}>
              <input
                type="text"
                value={guess}
                onChange={e => setGuess(e.target.value)}
                placeholder={concluded ? 'Round concluded' : 'Type your answer here…'}
                className="flex-1 p-4 sm:p-5 text-sm sm:text-base bg-transparent text-white placeholder-gray-300 text-center focus:outline-none transition-all duration-300 focus:placeholder-transparent disabled:opacity-60"
                disabled={disableInput}
                autoFocus
              />

              <motion.button
                type="submit"
                disabled={disableInput || !guess.trim()}
                className={`px-6 sm:px-8 font-bold py-4 sm:py-5 transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
                  disableInput || !guess.trim()
                    ? 'bg-gray-700/50 cursor-not-allowed text-gray-500'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg hover:shadow-cyan-500/25'
                }`}
                whileHover={!disableInput && !!guess.trim() ? { scale: 1.02 } : {}}
                whileTap={!disableInput && !!guess.trim() ? { scale: 0.98 } : {}}
              >
                <span className="relative z-10 flex items-center gap-2">Submit</span>
              </motion.button>
            </div>
          </div>
        </form>

        {/* Actions when concluded */}
        {concluded && (
          <div className="flex flex-col items-center gap-3 mb-4">
            <p className="text-sm" style={{ color: COLORS.grayblue }}>
              Correct answer: <span className="font-semibold text-white">{current.answer}</span>
            </p>
            <motion.button
              onClick={goNext}
              className="px-5 py-2 rounded-xl font-semibold"
              style={{ background: 'linear-gradient(90deg, #0FC1E9 0%, #3B82F6 100%)', color: '#fff' }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              {idx + 1 >= totalRounds ? 'Finish' : 'Next'}
            </motion.button>
          </div>
        )}

        {/* Guess history */}
        <div className="rounded-2xl p-4 max-h-48 flex-grow overflow-y-auto pr-2" style={{ backgroundColor: COLORS.darkestblue }}>
          <h2 className="text-base sm:text-lg font-semibold mb-2">Your Guesses:</h2>
          <ul className="space-y-2 overflow-y-auto">
            {history.map(g => (
              <li key={g.guessNum} className="flex justify-between">
                <span>Attempt {g.guessNum}: {g.userGuess}</span>
                <span className={g.isCorrect ? 'text-green-400' : 'text-red-400'}>
                  {g.isCorrect ? 'Correct' : 'Incorrect'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </div>
  );
};

export default InferenceScreen;

