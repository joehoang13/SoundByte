const mongoose = require('mongoose');

const SnippetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  genre: { type: String },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  type: { type: String, enum: ['classic'], default: 'classic' },
  audioUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Snippet', SnippetSchema);
