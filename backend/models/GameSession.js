const mongoose = require('mongoose');

const GameSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mode: { type: String, enum: ['classic'], default: 'classic' },
  score: { type: Number, default: 0 },
  answerStreak: { type: Number, default: 0 },
  snippetSize: { type: Number, enum: [3, 5, 10] },
  answers: [{
    snippetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Snippet' },
    userAnswer: String,
    correct: Boolean,
    timeTaken: Number
  }],
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
});

module.exports = mongoose.model('GameSession', GameSessionSchema);
