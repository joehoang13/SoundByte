// backend/tests/game.e2e.test.ts
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
  app.post('/api/gs/game/:sessionId/next', gs.nextRound);
  app.post('/api/gs/game/:sessionId/finish', gs.finishGame);
  return app;
}

describe('Game flow (E2E)', () => {
  const app = makeApp();
  const userId = new mongoose.Types.ObjectId().toHexString(); // <- valid ObjectId

  beforeEach(async () => {
    await seedSnippets();
  });

  it('plays two rounds end-to-end and scores correctly', async () => {
    const start = await request(app)
      .post('/api/gs/game/start')
      .send({ userId, difficulty: 'easy', snippetSize: 5, rounds: 2 })
      .expect(200);

    const { sessionId, round, roundIndex } = start.body;
    expect(roundIndex).toBe(0);
    expect(round.audioUrl).toBeTruthy();

    await request(app)
      .post(`/api/gs/game/${sessionId}/round/started`)
      .send({ roundIndex: 0 })
      .expect(200);

    const s0 = await GameSession.findById(sessionId);
    s0!.answers[0].startedAt = new Date(Date.now() - 900);
    await s0!.save();

    const s0pop = await GameSession.findById(sessionId).populate('answers.snippetId');
    const actualTitle = (s0pop!.answers[0].snippetId as any).title as string;

    const guess1 = await request(app)
      .post(`/api/gs/game/${sessionId}/guess`)
      .send({ roundIndex: 0, guess: actualTitle })
      .expect(200);

    expect(guess1.body.correct).toBe(true);
    expect(guess1.body.breakdown.timeBonus).toBe(700);
    expect(guess1.body.breakdown.total).toBe(1700);

    const next = await request(app).post(`/api/gs/game/${sessionId}/next`).expect(200);
    expect(next.body.roundIndex).toBe(1);

    const finish = await request(app).post(`/api/gs/game/${sessionId}/finish`).expect(200);
    expect(finish.body.rounds).toBe(2);
    expect(finish.body.score).toBeGreaterThanOrEqual(1700);
  });
});
