// backend/controllers/gsController.js
// Only the changed file. Adds `correctSoFar` to resume payload.

const mongoose = require('mongoose');
const GameSession = require('../models/GameSession');
const Snippet = require('../models/Snippet');
const User = require('../models/Users');
const { normalize, titleArtistMatch } = require('../utils/scoringUtils');
const { cacheSetSession, cacheGetSession } = require('../utils/redisClient');

const now = () => new Date();

function difficultyFromSize(n) {
  const x = Number(n);
  if (x === 3) return 'hard';
  if (x === 5) return 'medium';
  if (x === 10) return 'easy';
  return 'medium';
}

const MAX_ATTEMPTS = 5;

async function loadSnippet(snippetId) {
  return Snippet.findById(snippetId, { title: 1, artist: 1, audioUrl: 1 }).lean();
}

function currentAnswer(session) {
  return session.answers[session.currentRound];
}

function countCorrectSoFar(session) {
  // Why: after refresh we need an authoritative count for UI
  return (session.answers || []).filter(a => a && a.answeredAt && a.correct).length;
}

function toResumePayload(session, snip) {
  return {
    sessionId: session._id.toString(),
    roundIndex: session.currentRound,
    rounds: session.rounds,
    round: snip
      ? {
          snippetId: snip._id.toString(),
          audioUrl: snip.audioUrl,
          title: snip.title,
          artist: snip.artist,
        }
      : null,
    score: session.score,
    streak: session.streak,
    status: session.status,
    seq: session.seq || 0,
    updatedAt: session.updatedAt?.toISOString?.() || new Date().toISOString(),
    correctSoFar: countCorrectSoFar(session), // NEW
  };
}

async function cacheSessionSnapshot(session) {
  const ans = currentAnswer(session);
  const snip = ans ? await loadSnippet(ans.snippetId) : null;
  const payload = toResumePayload(session, snip);
  await cacheSetSession(session._id.toString(), payload);
  return payload;
}

// ---------- handlers (unchanged except resume uses toResumePayload) ----------

exports.startGame = async function startGame(req, res) {
  try {
    const userId = req.user?.id || req.body?.userId;
    const snippetSize = Number(req.body?.snippetSize) || 5;

    const difficulty = difficultyFromSize(snippetSize);
    const roundsReq = Math.max(1, Math.min(Number(req.body?.rounds) || 10, 20));
    const match = { type: 'classic' };

    const available = await Snippet.countDocuments(match).exec();
    if (!available) {
      return res.status(400).json({ error: 'No classic snippets available', filters: match });
    }

    const take = Math.min(roundsReq, available);
    const docs = await Snippet.aggregate([
      { $match: match },
      { $sample: { size: take } },
      { $project: { _id: 1, audioUrl: 1, title: 1, artist: 1 } },
    ]).exec();

    const answers = docs.map((d, i) => ({
      snippetId: d._id,
      startedAt: i === 0 ? now() : null,
      answeredAt: null,
      guesses: [],
      attempts: 0,
      correct: false,
      timeTaken: 0,
      pointsAwarded: 0,
      matched: { title: false, artist: false },
      maxAttempts: MAX_ATTEMPTS,
    }));

    const session = await GameSession.create({
      userId,
      mode: 'classic',
      difficulty,
      snippetSize,
      rounds: take,
      answers,
      currentRound: 0,
      score: 0,
      streak: 0,
      timeBonusTotal: 0,
      fastestTimeMs: null,
      status: 'active',
      seq: 0,
    });

    const first = docs[0];
    await cacheSessionSnapshot(session);

    return res.json({
      sessionId: session._id.toString(),
      roundIndex: 0,
      rounds: take,
      round: {
        snippetId: first._id.toString(),
        audioUrl: first.audioUrl,
        title: first.title,
        artist: first.artist,
      },
    });
  } catch (err) {
    console.error('[gs] start error', err);
    return res.status(500).json({ error: 'Failed to start game' });
  }
};

exports.resumeGame = async function resumeGame(req, res) {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const cached = await cacheGetSession(sessionId);
    if (cached) return res.json(cached);

    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const ans = currentAnswer(session);
    const snip = ans ? await loadSnippet(ans.snippetId) : null;

    const payload = toResumePayload(session, snip);
    await cacheSetSession(sessionId, payload);
    return res.json(payload);
  } catch (err) {
    console.error('[gs] resume error', err);
    return res.status(500).json({ error: 'Failed to resume game' });
  }
};

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

    session.seq = (session.seq || 0) + 1;
    await session.save();
    await cacheSessionSnapshot(session);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[gs] setRoundStarted error', err);
    return res.status(500).json({ error: 'Failed to set round started' });
  }
};

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
      return res.json({
        correct: ans.correct,
        concluded: true,
        attempts: ans.attempts ?? ans.guesses?.length ?? 0,
        attemptsLeft: Math.max(
          0,
          (ans.maxAttempts || MAX_ATTEMPTS) - (ans.attempts ?? ans.guesses?.length ?? 0)
        ),
        timeMs: ans.timeTaken ?? 0,
        score: session.score,
        streak: session.streak,
        breakdown: { base: 0, timeBonus: 0, penalty: 0, total: 0 },
      });
    }

    const snippet = await Snippet.findById(ans.snippetId);
    if (!snippet) return res.status(404).json({ error: 'Snippet not found' });

    const { titleHit, artistHit, correct } = titleArtistMatch(
      rawGuess,
      snippet.title || '',
      snippet.artist || ''
    );

    ans.guesses = ans.guesses || [];
    ans.guesses.push({ guess: rawGuess, correct, timeMs: undefined, at: new Date() });
    ans.attempts = (ans.attempts || 0) + 1;

    const nowMs = Date.now();
    if (!ans.startedAt) ans.startedAt = new Date(nowMs - 1);

    const snippetSeconds = session.snippetSize || 5;
    const startedAtMs = new Date(ans.startedAt).getTime();
    const effectiveStartMs = startedAtMs + snippetSeconds * 1000;
    const timeMs = Math.max(0, nowMs - effectiveStartMs);

    let base = 0;
    let timeBonus = 0;
    let penalty = 0;
    let total = 0;

    if (correct) {
      ans.answeredAt = new Date();
      ans.correct = true;
      ans.userAnswer = rawGuess;
      ans.timeTaken = timeMs;
      ans.matched = { title: !!titleHit, artist: !!artistHit };

      base = 1000;
      timeBonus = Math.max(0, Math.round((snippetSeconds * 1000 - timeMs) / 20));
      total = base + timeBonus;

      ans.pointsAwarded = total;

      session.score += total;
      session.streak = (session.streak || 0) + 1;
      session.timeBonusTotal = (session.timeBonusTotal || 0) + timeBonus;

      if (
        session.fastestTimeMs === undefined ||
        session.fastestTimeMs === null ||
        timeMs < session.fastestTimeMs
      ) {
        session.fastestTimeMs = timeMs;
      }
    } else {
      const maxAttempts = ans.maxAttempts || MAX_ATTEMPTS;
      if (ans.attempts >= maxAttempts) {
        ans.answeredAt = new Date();
        ans.correct = false;
        ans.userAnswer = rawGuess;
        ans.timeTaken = timeMs;
        session.streak = 0;
      }
    }

    session.seq = (session.seq || 0) + 1;
    await session.save();
    await cacheSessionSnapshot(session);

    const concluded = !!ans.answeredAt;
    const attemptsLeft = Math.max(0, (ans.maxAttempts || MAX_ATTEMPTS) - (ans.attempts || 0));

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

exports.nextRound = async function nextRound(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.currentRound + 1 >= session.rounds) {
      return res.status(400).json({ error: 'No more rounds' });
    }

    session.currentRound += 1;

    const ans = currentAnswer(session);
    if (!ans.startedAt) ans.startedAt = now();

    session.seq = (session.seq || 0) + 1;
    await session.save();

    const snip = await loadSnippet(ans.snippetId);
    await cacheSessionSnapshot(session);

    return res.json({
      roundIndex: session.currentRound,
      round: {
        snippetId: snip._id.toString(),
        audioUrl: snip.audioUrl,
        title: snip.title,
        artist: snip.artist,
      },
    });
  } catch (err) {
    console.error('[gs] nextRound error', err);
    return res.status(500).json({ error: 'Failed to fetch next round' });
  }
};

exports.finishGame = async function finishGame(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'completed';
    session.endedAt = new Date();
    session.seq = (session.seq || 0) + 1;
    await session.save();
    await cacheSessionSnapshot(session);

    if (session.userId) {
      const user = await User.findById(session.userId);
      if (user) {
        user.totalGamesPlayed = (user.totalGamesPlayed || 0) + 1;
        if (!user.highestScore || session.score > user.highestScore)
          user.highestScore = session.score;
        const correctCount = session.answers.filter(a => a.correct).length;
        user.totalSnippetsGuessed = (user.totalSnippetsGuessed || 0) + correctCount;
        await user.save();
      }
    }

    const songDetails = await Promise.all(
      session.answers.map(async ans => {
        const snippet = await Snippet.findById(ans.snippetId, { title: 1, artist: 1 }).lean();
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
