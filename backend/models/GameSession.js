const mongoose = require('mongoose');

const GuessSchema = new mongoose.Schema(
  {
    guess: { type: String, required: true },
    correct: { type: Boolean, default: false },
    timeMs: { type: Number },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AnswerSchema = new mongoose.Schema(
  {
    snippetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Snippet', required: true },
    startedAt: { type: Date },
    answeredAt: { type: Date },
    userAnswer: { type: String },
    correct: { type: Boolean },
    timeTaken: { type: Number },
    pointsAwarded: { type: Number },
    matched: { title: { type: Boolean }, artist: { type: Boolean } },

    // Multi-attempt support
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    guesses: { type: [GuessSchema], default: [] },
  },
  { _id: false }
);

const GameSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mode: { type: String, enum: ['classic'], default: 'classic' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
  snippetSize: { type: Number, enum: [3, 5, 10], default: 5 },

  rounds: { type: Number, default: 10 },
  currentRound: { type: Number, default: 0 },

  score: { type: Number, default: 0 },
  // keep both names for compatibility
  streak: { type: Number, default: 0 },
  answerStreak: { type: Number, default: 0 },
  fastestTimeMs: { type: Number },
  timeBonusTotal: { type: Number, default: 0 },

  answers: { type: [AnswerSchema], default: [] },

  status: { type: String, enum: ['active', 'finished'], default: 'active' },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
});

module.exports = mongoose.model('GameSession', GameSessionSchema);
