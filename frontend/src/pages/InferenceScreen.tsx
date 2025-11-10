import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Howler } from "howler";
import { useAuth } from "../stores/auth";
import discdb from "../assets/disc.svg";
import needledb from "../assets/needle.svg";

type Question = {
  _id: string;
  question: string;
  answer: string;
  difficulty?: string;
  type?: string;
};

type GuessRow = {
  guessNum: number;
  userGuess: string;
  isCorrect: boolean;
  timeTakenSec: number;
};

const COLORS = {
  grayblue: "#90A4AB",
  darkblue: "#274D5B",
  teal: "#0FC1E9",
  darkestblue: "#143D4D",
};

const MAX_ATTEMPTS = 3;
const SIMILARITY_THRESHOLD = 0.8;

const InferenceScreen: React.FC = () => {
  const { user } = useAuth();
  const username = user?.username ?? "Player";
  const avatarUrl = user?.profilePicture;
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [guessHistory, setGuessHistory] = useState<GuessRow[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [showAnswer, setShowAnswer] = useState(false);
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem("sb_volume");
    const initial = saved ? Math.min(100, Math.max(0, Number(saved))) : 80;
    Howler.volume(initial / 100);
    return initial;
  });

  const current = questions[currentIndex];
  const totalRounds = questions.length;

  /* ---------------- Fetch Questions ---------------- */
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/questions/random?limit=5");
        const data = await res.json();
        if (data.ok && data.items) setQuestions(data.items);
      } catch (err) {
        console.error("Error fetching inference questions:", err);
      }
    };
    fetchQuestions();
  }, []);

  /* ---------------- Volume persistence ---------------- */
  useEffect(() => {
    Howler.volume(volume / 100);
    localStorage.setItem("sb_volume", String(volume));
  }, [volume]);

  /* ---------------- Start new round ---------------- */
  useEffect(() => {
    if (current) {
      setStartTime(Date.now());
      setGuessHistory([]);
      setAttemptsLeft(MAX_ATTEMPTS);
      setShowAnswer(false);
    }
  }, [current]);

  const handleNextQuestion = () => {
    if (currentIndex + 1 < totalRounds) setCurrentIndex(i => i + 1);
    else navigate("/endscreen");
  };

  /* ---------------- String normalization ---------------- */
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  /* ---------------- Levenshtein Distance ---------------- */
  const levenshtein = (a: string, b: string) => {
    const m = a.length,
      n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  };

  const similarity = (a: string, b: string) => {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - levenshtein(a, b) / maxLen;
  };

  /* ---------------- Guess Handling ---------------- */
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || !current || attemptsLeft <= 0 || showAnswer) return;

    const elapsedMs = Date.now() - (startTime ?? Date.now());

    // Split "Artist - Title" so player only needs Title
    const [artistPart, titlePart] = current.answer.split(" - ");
    const normGuess = normalize(guess);
    const normArtist = normalize(artistPart || "");
    const normTitle = normalize(titlePart || current.answer);
    const normAnswer = normalize(current.answer);

    // Player correct if matches Title or entire Answer closely
    const titleMatch = similarity(normGuess, normTitle) >= SIMILARITY_THRESHOLD;
    const fullMatch = similarity(normGuess, normAnswer) >= SIMILARITY_THRESHOLD;
    const correct = titleMatch || fullMatch;

    setGuessHistory(prev => [
      ...prev,
      {
        guessNum: prev.length + 1,
        userGuess: guess.trim(),
        isCorrect: correct,
        timeTakenSec: Math.round((elapsedMs / 1000) * 100) / 100,
      },
    ]);

    if (correct) {
      setScore(s => s + 100);
      setStreak(s => s + 1);
      setShowAnswer(true);
    } else {
      setStreak(0);
      setAttemptsLeft(a => a - 1);
      if (attemptsLeft - 1 <= 0) setShowAnswer(true);
    }

    setGuess("");
  };

  if (!questions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <span>Loading questions…</span>
      </div>
    );
  }

  const TEAL_TINT_FILTER =
    "brightness(0) saturate(100%) invert(76%) sepia(63%) saturate(6240%) hue-rotate(157deg) brightness(101%) contrast(97%)";
  const needleTransition = {
    repeat: Infinity,
    duration: 2,
    ease: "easeInOut" as const,
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-montserrat p-4">
      <motion.div
        className="flex flex-col bg-darkblue/80 backdrop-blur-sm rounded-2xl w-full max-w-[900px] min-h-[90dvh] h-auto shadow-lg relative text-white p-4 sm:p-10"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {/* Progress */}
        <div className="w-full h-3 rounded-full mb-6 overflow-hidden bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${((currentIndex + 1) / totalRounds) * 100}%`,
              background: "linear-gradient(90deg, #0FC1E9 0%, #3B82F6 100%)",
              transition: "width 0.5s ease-in-out",
            }}
          />
        </div>

        {/* Score / Round / Streak */}
        <div className="flex justify-between items-center mb-6 text-center">
          <div className="flex-1">
            <div className="bg-[#143D4D]/70 rounded-full px-5 py-2 text-sm font-bold">
              Score: {score}
            </div>
          </div>
          <div className="flex-1 text-xl font-bold">Round {currentIndex + 1}</div>
          <div className="flex-1">
            <div className="bg-[#143D4D]/70 rounded-full px-5 py-2 text-sm font-bold">
              Streak: {streak}
            </div>
          </div>
        </div>

        {/* Vinyl Animation */}
        <div className="flex items-center justify-center mt-2 mb-4">
          <div className="relative w-28 h-28">
            <motion.img
              src={discdb}
              alt="vinyl"
              className="w-28 h-28 select-none"
              draggable={false}
              animate={{ rotate: shouldReduceMotion ? 0 : 360 }}
              transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
              style={{
                filter: TEAL_TINT_FILTER,
                borderRadius: "50%",
                boxShadow: "0 0 20px rgba(15, 193, 233, 0.35)",
              }}
            />
            <motion.img
              src={needledb}
              alt=""
              className="absolute w-16 h-16 z-10 select-none pointer-events-none"
              style={{
                top: "-6%",
                right: "14%",
                transformOrigin: "85% 20%",
                filter: TEAL_TINT_FILTER,
              }}
              animate={{
                rotate: shouldReduceMotion ? -2 : [-2, -3, -2],
              }}
              transition={needleTransition}
            />
          </div>
        </div>

        {/* Question */}
        <motion.div
          key={current._id}
          className="text-center text-xl sm:text-2xl font-semibold mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {current.question}
        </motion.div>

        {/* Answer */}
        {showAnswer && (
          <motion.div
            className="text-center text-lg font-semibold mb-6 text-teal-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            Correct Answer: {current.answer}
          </motion.div>
        )}

        {/* Input / Next */}
        {!showAnswer ? (
          <form onSubmit={onSubmit} className="relative mb-6">
            <div className="relative bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-cyan-400/20 p-[2px] rounded-2xl">
              <div className="flex bg-[#143D4D]/90 rounded-2xl overflow-hidden">
                <input
                  type="text"
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  placeholder="Enter your answer here"
                  className="flex-1 p-5 text-base sm:text-lg bg-transparent text-white placeholder-gray-300 text-center focus:outline-none"
                  disabled={attemptsLeft <= 0 || showAnswer}
                />
                <motion.button
                  type="submit"
                  disabled={attemptsLeft <= 0 || showAnswer}
                  className={`px-8 font-bold py-5 text-base ${
                    attemptsLeft <= 0
                      ? "bg-gray-700/50 cursor-not-allowed text-gray-400"
                      : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white"
                  }`}
                  whileHover={attemptsLeft > 0 ? { scale: 1.02 } : {}}
                  whileTap={attemptsLeft > 0 ? { scale: 0.98 } : {}}
                >
                  Submit
                </motion.button>
              </div>
            </div>
          </form>
        ) : (
          <motion.button
            onClick={handleNextQuestion}
            className="mx-auto mt-4 px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Next Question →
          </motion.button>
        )}

        {/* Guess History */}
        <div
          className="rounded-2xl p-5 max-h-48 flex-grow overflow-y-auto pr-2 mt-6"
          style={{ backgroundColor: COLORS.darkestblue }}
        >
          <h2 className="text-lg font-semibold mb-2">Your Guesses:</h2>
          <ul className="space-y-2 overflow-y-auto">
            {guessHistory.map(g => (
              <li key={g.guessNum} className="flex justify-between">
                <span>
                  Attempt {g.guessNum}: {g.userGuess}
                </span>
                <span className={g.isCorrect ? "text-green-400" : "text-red-400"}>
                  {g.isCorrect ? "Correct" : `Incorrect (${g.timeTakenSec}s)`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm opacity-80">Attempts left: {attemptsLeft}</p>
        </div>
      </motion.div>
    </div>
  );
};

export default InferenceScreen;
