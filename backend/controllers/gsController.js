// backend/controllers/gsController.js — full merged version

const mongoose = require('mongoose');
const GameSession = require('../models/GameSession');
const Snippet = require('../models/Snippet');
const User = require('../models/Users');
const { normalize, titleArtistMatch } = require('../utils/scoringUtils');

// ---------- helpers ----------
const now = () => new Date();

function difficultyFromSize(n) {
  const x = Number(n);
  if (x === 3) return 'hard';
  if (x === 5) return 'medium';
  if (x === 10) return 'easy';
  return 'medium';
}

const MAX_ATTEMPTS = 5;

// Load snippet fields used by the client
async function loadSnippet(snippetId) {
  return Snippet.findById(snippetId, { title: 1, artist: 1, audioUrl: 1 }).lean();
}

function currentAnswer(session) {
  return session.answers[session.currentRound];
}

// ---------- handlers ----------

// POST /api/gs/game/start
// backend/controllers/gsController.js

// …
exports.startGame = async function startGame(req, res) {
  try {
    const userId = req.user?.id || req.body?.userId; // ok if blank in dev
    const snippetSize = Number(req.body?.snippetSize) || 5;

    // Derive difficulty from the snippet size (3->hard, 5->medium, 10->easy)
    const difficulty = difficultyFromSize(snippetSize);

    const roundsReq = Math.max(1, Math.min(Number(req.body?.rounds) || 10, 20));

    // ✅ Just match classic type now (no snippetSize filter)
    const match = { type: 'classic' };

    const available = await Snippet.countDocuments(match).exec();
    if (!available) {
      return res.status(400).json({
        error: 'No classic snippets available',
        filters: match,
      });
    }

    const take = Math.min(roundsReq, available);
    const docs = await Snippet.aggregate([
      { $match: match },
      { $sample: { size: take } },
      { $project: { _id: 1, audioUrl: 1 } },
    ]).exec();

    const answers = docs.map(d => ({
      snippetId: d._id,
      startedAt: null,
      answeredAt: null,
      guesses: [],
      attempts: 0,
      correct: false,
      timeTaken: 0,
      pointsAwarded: 0,
      matched: { title: false, artist: false },
      maxAttempts: 5,
    }));

    const session = await GameSession.create({
      userId,
      mode: 'classic',
      difficulty, // still stored
      snippetSize, // still stored — frontend uses it
      rounds: take,
      answers,
      currentRound: 0,
      score: 0,
      streak: 0,
      timeBonusTotal: 0,
      fastestTimeMs: null,
      status: 'active',
    });

    const first = docs[0];
    return res.json({
      sessionId: session._id.toString(),
      roundIndex: 0,
      rounds: take,
      round: { snippetId: first._id.toString(), audioUrl: first.audioUrl },
    });
  } catch (err) {
    console.error('[gs] start error', err);
    return res.status(500).json({ error: 'Failed to start game' });
  }
};

// POST /api/gs/game/:sessionId/round/started
exports.setRoundStarted = async function setRoundStarted(req, res) {
  try {
    const { sessionId } = req.params;
    const { roundIndex } = req.body || {};
    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (roundIndex !== session.currentRound)
      return res.status(400).json({ error: 'Round index mismatch' });

    const answer = currentAnswer(session);
    if (!answer.startedAt) answer.startedAt = now();
    await session.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error('[gs] setRoundStarted error', err);
    return res.status(500).json({ error: 'Failed to set round started' });
  }
};

// POST /api/gs/game/:sessionId/guess
exports.submitGuess = async function submitGuess(req, res) {
  try {
    const { sessionId } = req.params;
    const roundIndex = Number(req.body?.roundIndex);
    const rawGuess = (req.body?.guess ?? '').toString().trim();

    if (!sessionId || Number.isNaN(roundIndex))
      return res.status(400).json({ error: 'Missing sessionId or roundIndex' });
    if (!rawGuess) return res.status(400).json({ error: 'Guess required' });

    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (roundIndex < 0 || roundIndex >= session.answers.length)
      return res.status(400).json({ error: 'Invalid round index' });

    const ans = session.answers[roundIndex];
    if (ans.answeredAt) {
      // round already concluded – return current scoreboard
      return res.json({
        correct: ans.correct,
        concluded: true,
        attempts: ans.attempts ?? ans.guesses?.length ?? 0,
        attemptsLeft: Math.max(
          0,
          (ans.maxAttempts || 5) - (ans.attempts ?? ans.guesses?.length ?? 0)
        ),
        timeMs: ans.timeTaken ?? 0,
        score: session.score,
        streak: session.streak,
        breakdown: { base: 0, timeBonus: 0, penalty: 0, total: 0 },
      });
    }

    // look up the snippet to score
    const snippet = await Snippet.findById(ans.snippetId);
    if (!snippet) return res.status(404).json({ error: 'Snippet not found' });

    const { titleHit, artistHit, correct } = titleArtistMatch(
      rawGuess,
      snippet.title || '',
      snippet.artist || ''
    );

    // build the guess entry — include `guess` (required by schema)
    const guessEntry = {
      guess: rawGuess,
      normalized: normalize(rawGuess),
      correct,
      partialTitle: titleHit && !correct,
      partialArtist: artistHit && !correct,
      createdAt: new Date(),
    };

    ans.guesses = ans.guesses || [];
    ans.guesses.push(guessEntry);
    ans.attempts = (ans.attempts || 0) + 1;

    // compute timing & points
    const nowMs = Date.now();
    const startedAt = ans.startedAt ? new Date(ans.startedAt).getTime() : nowMs;
    const timeMs = Math.max(0, nowMs - startedAt);

    let base = 0,
      timeBonus = 0,
      penalty = 0,
      total = 0;

    if (correct) {
      ans.answeredAt = new Date();
      ans.correct = true;
      ans.timeTaken = timeMs;

      // simple scoring model
      base = 1000;
      // faster => more bonus, dampened by snippet size to keep it fair
      const snippetSeconds = session.snippetSize || 5;
      timeBonus = Math.max(0, Math.round((snippetSeconds * 1000 - timeMs) / 20)); // ~ up to ~500
      penalty = 0;
      total = base + timeBonus;

      session.score += total;
      session.streak = (session.streak || 0) + 1;
      session.timeBonusTotal = (session.timeBonusTotal || 0) + timeBonus;

      // fastest time
      if (
        session.fastestTimeMs === undefined ||
        session.fastestTimeMs === null ||
        timeMs < session.fastestTimeMs
      ) {
        session.fastestTimeMs = timeMs;
      }
    } else {
      // wrong attempt
      penalty = 0;
      total = 0;

      // if out of attempts, conclude the round
      const maxAttempts = ans.maxAttempts || 5;
      if (ans.attempts >= maxAttempts) {
        ans.answeredAt = new Date();
        ans.correct = false;
        ans.timeTaken = timeMs;
        session.streak = 0;
      }
    }

    await session.save();

    const concluded = !!ans.answeredAt;
    const attemptsLeft = Math.max(0, (ans.maxAttempts || 5) - (ans.attempts || 0));

    return res.json({
      correct,
      concluded,
      attempts: ans.attempts || ans.guesses.length,
      attemptsLeft,
      timeMs,
      score: session.score,
      streak: session.streak,
      breakdown: { base, timeBonus, penalty, total },
    });
  } catch (err) {
    console.warn('[gs] submitGuess error', err);
    return res.status(500).json({ error: 'Failed to submit guess' });
  }
};

// POST /api/gs/game/:sessionId/next
exports.nextRound = async function nextRound(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.currentRound + 1 >= session.rounds) {
      return res.status(400).json({ error: 'No more rounds' });
    }

    session.currentRound += 1;
    await session.save();

    const ans = currentAnswer(session);
    const snip = await loadSnippet(ans.snippetId);

    return res.json({
      roundIndex: session.currentRound,
      round: { snippetId: snip._id.toString(), audioUrl: snip.audioUrl },
    });
  } catch (err) {
    console.error('[gs] nextRound error', err);
    return res.status(500).json({ error: 'Failed to fetch next round' });
  }
};

// POST /api/gs/game/:sessionId/finish
exports.finishGame = async function finishGame(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'completed';
    await session.save();

    // 🧠 Update user stats
    if (session.userId) {
      const user = await User.findById(session.userId);

      if (user) {
        // Update total games played
        user.totalGamesPlayed = (user.totalGamesPlayed || 0) + 1;

        // Update highest score
        if (!user.highestScore || session.score > user.highestScore) {
          user.highestScore = session.score;
        }

        // Count correct answers from this session
        const correctCount = session.answers.filter(a => a.correct).length;
        user.totalSnippetsGuessed = (user.totalSnippetsGuessed || 0) + correctCount;

        await user.save();
      }
    }

    // For each answer, load snippet details for title/artist
    const songDetails = await Promise.all(
      session.answers.map(async ans => {
        const snippet = await Snippet.findById(ans.snippetId, {
          title: 1,
          artist: 1,
        }).lean();

        return {
          snippetId: ans.snippetId.toString(),
          title: snippet?.title || 'Unknown Song',
          artist: snippet?.artist || 'Unknown Artist',
          correct: ans.correct || false,
          pointsAwarded: ans.pointsAwarded || 0,
          timeMs: ans.timeTaken || 0,
          attempts: ans.attempts || 0,
        };
      })
    );

    return res.json({
      sessionId: session._id.toString(),
      score: session.score,
      streak: session.streak,
      fastestTimeMs: session.fastestTimeMs ?? undefined,
      timeBonusTotal: session.timeBonusTotal ?? 0,
      rounds: session.rounds,
      answers: songDetails,
    });
  } catch (err) {
    console.error('[gs] finishGame error', err);
    return res.status(500).json({ error: 'Failed to finish game' });
  }
};

// GET /api/gs/inventory
exports.inventory = async function inventory(req, res) {
  try {
    const data = await Snippet.aggregate([
      { $match: { type: 'classic' } },
      { $group: { _id: { snippetSize: '$snippetSize' }, count: { $sum: 1 } } },
      { $sort: { '_id.snippetSize': 1 } },
    ]).exec();
    return res.json(
      data.map(r => ({
        snippetSize: r._id.snippetSize,
        difficulty: difficultyFromSize(r._id.snippetSize),
        count: r.count,
      }))
    );
  } catch (err) {
    console.error('[gs] inventory error', err);
    return res.status(500).json({ error: 'inventory failed' });
  }
};
