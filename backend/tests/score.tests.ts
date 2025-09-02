// backend/tests/score.tests.ts
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
  return app;
}

describe('Scoring via API (with 5-attempt rounds)', () => {
  const app = makeApp();
  const userId = new mongoose.Types.ObjectId().toHexString();

  beforeEach(async () => {
    await seedSnippets();
  });

  it('awards base + time bonus on correct; streak holds through wrong attempts and resets when attempts are exhausted', async () => {
    const start = await request(app)
      .post('/api/gs/game/start')
      .send({ userId, difficulty: 'easy', snippetSize: 5, rounds: 2 })
      .expect(200);

    const { sessionId } = start.body;

    // Round 0: ensure fast answer for time bonus
    await request(app)
      .post(`/api/gs/game/${sessionId}/round/started`)
      .send({ roundIndex: 0 })
      .expect(200);
    const s0 = await GameSession.findById(sessionId).populate('answers.snippetId');
    s0!.answers[0].startedAt = new Date(Date.now() - 900);
    await s0!.save();

    const okTitle = (s0!.answers[0].snippetId as any).title as string;
    const p1 = await request(app)
      .post(`/api/gs/game/${sessionId}/guess`)
      .send({ roundIndex: 0, guess: okTitle })
      .expect(200);

    expect(p1.body.breakdown.total).toBeGreaterThanOrEqual(1000);
    expect(p1.body.streak).toBe(1);

    // Move to round 1
    await request(app).post(`/api/gs/game/${sessionId}/next`).expect(200);
    await request(app)
      .post(`/api/gs/game/${sessionId}/round/started`)
      .send({ roundIndex: 1 })
      .expect(200);

    // Make 4 wrong attempts: streak should remain 1 and round not concluded yet
    for (let i = 0; i < 4; i++) {
      const r = await request(app)
        .post(`/api/gs/game/${sessionId}/guess`)
        .send({ roundIndex: 1, guess: `wrong-${i}` })
        .expect(200);
      expect(r.body.breakdown.total).toBe(0);
      expect(r.body.concluded).toBe(false);
      expect(r.body.streak).toBe(1);
    }

    // 5th wrong attempt: round concludes; streak resets to 0
    const finalWrong = await request(app)
      .post(`/api/gs/game/${sessionId}/guess`)
      .send({ roundIndex: 1, guess: 'wrong-final' })
      .expect(200);

    expect(finalWrong.body.breakdown.total).toBe(0);
    expect(finalWrong.body.concluded).toBe(true);
    expect(finalWrong.body.streak).toBe(0);
  });
});
