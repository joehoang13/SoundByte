// backend/tests/stringMatch.test.ts
import express = require('express');
import request = require('supertest');
import mongoose = require('mongoose');
import { seedSnippets } from './helpers/seed';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gs = require('../controllers/gsController');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GameSession = require('../models/GameSession');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/gs/game/start', gs.startGame);
  app.post('/api/gs/game/:sessionId/round/started', gs.setRoundStarted);
  app.post('/api/gs/game/:sessionId/guess', gs.submitGuess);
  return app;
}

describe('Fuzzy matching via API', () => {
  const app = makeApp();
  const userId = new mongoose.Types.ObjectId().toHexString(); // <- valid ObjectId

  beforeEach(async () => {
    await seedSnippets();
  });

  it('accepts partial/artist matches', async () => {
    const start = await request(app)
      .post('/api/gs/game/start')
      .send({ userId, difficulty: 'easy', snippetSize: 5, rounds: 1 })
      .expect(200);

    const { sessionId } = start.body;

    await request(app)
      .post(`/api/gs/game/${sessionId}/round/started`)
      .send({ roundIndex: 0 })
      .expect(200);

    const s = await GameSession.findById(sessionId).populate('answers.snippetId');
    const artist = ((s!.answers[0].snippetId as any).artist as string) || '';

    const tokens = artist
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const token = tokens.sort((a, b) => b.length - a.length)[0] || artist.toLowerCase();

    const partial = token.slice(0, Math.max(3, Math.ceil(token.length * 0.6)));

    const resp = await request(app)
      .post(`/api/gs/game/${sessionId}/guess`)
      .send({ roundIndex: 0, guess: partial })
      .expect(200);

    expect(resp.body.correct).toBe(true);
  });
});
