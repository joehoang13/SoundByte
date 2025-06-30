const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String },
  passwordHash: { type: String },
  authProvider: { type: String, default: 'firebase' },
  profilePicture: { type: String },
  createdAt: { type: Date, default: Date.now },
  highScores: {
    classic: Number,
    instrumental: Number,
    lyrics: Number,
    sampleHunt: Number,
    artistChallenge: Number,
  },
  totalGamesPlayed: { type: Number, default: 0 },
});

module.exports = mongoose.model('User', UserSchema);
