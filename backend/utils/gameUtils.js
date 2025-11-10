// backend/utils/gameUtils.js
const Snippet = require('../models/Snippet');

function difficultyFromSize(n) {
  const x = Number(n);
  if (x === 3) return 'hard';
  if (x === 5) return 'medium';
  if (x === 10) return 'easy';
  return 'medium';
}

async function generateGameQuestions(rounds = 10) {
  const match = { type: 'classic' };

  const available = await Snippet.countDocuments(match).exec();
  if (available === 0) throw new Error('No available snippets for this game mode.');

  const take = Math.min(rounds, available);

  const docs = await Snippet.aggregate([
    { $match: match },
    { $sample: { size: take } },
    // include snippetSize so difficultyFromSize has consistent input
    { $project: { _id: 1, audioUrl: 1, title: 1, artist: 1, snippetSize: 1 } },
  ]).exec();

  return {
    rounds: take,
    difficulty: difficultyFromSize(docs[0]?.snippetSize ?? 5),
    snippets: docs.map(d => ({
      snippetId: d._id.toString(),
      audioUrl: d.audioUrl,
      title: d.title,
      artist: d.artist,
    })),
  };
}

module.exports = { generateGameQuestions };
