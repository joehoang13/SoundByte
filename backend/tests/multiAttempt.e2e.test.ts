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

describe('Multi-attempt flow', () => {
  const app = makeApp();
  const userId = new mongoose.Types.ObjectId().toHexString();

  beforeEach(async () => {
    await seedSnippets();
  });

  it('allows several wrong attempts and then a correct guess within 5', async () => {
    const start = await request(app)
      .post('/api/gs/game/start')
      .send({ userId, difficulty: 'easy', snippetSize: 5, rounds: 1 })
      .expect(200);

    const { sessionId } = start.body;

    await request(app)
      .post(`/api/gs/game/${sessionId}/round/started`)
      .send({ roundIndex: 0 })
      .expect(200);

    // wrong x2
    const w1 = await request(app)
      .post(`/api/gs/game/${sessionId}/guess`)
      .send({ roundIndex: 0, guess: 'wrong one' })
      .expect(200);
    expect(w1.body.concluded).toBe(false);

    const w2 = await request(app)
      .post(`/api/gs/game/${sessionId}/guess`)
      .send({ roundIndex: 0, guess: 'wrong two' })
      .expect(200);
    expect(w2.body.concluded).toBe(false);

    // now correct
    const s0 = await GameSession.findById(sessionId).populate('answers.snippetId');
    const title = (s0!.answers[0].snippetId as any).title as string;
    const ok = await request(app)
      .post(`/api/gs/game/${sessionId}/guess`)
      .send({ roundIndex: 0, guess: title })
      .expect(200);
    expect(ok.body.correct).toBe(true);
    expect(ok.body.concluded).toBe(true);
    expect(ok.body.attempts).toBeGreaterThanOrEqual(3);
  });

  it('concludes after 5 wrongs and rejects a 6th with 409', async () => {
    const start = await request(app)
      .post('/api/gs/game/start')
      .send({ userId, difficulty: 'easy', snippetSize: 5, rounds: 1 })
      .expect(200);
    const { sessionId } = start.body;

    await request(app)
      .post(`/api/gs/game/${sessionId}/round/started`)
      .send({ roundIndex: 0 })
      .expect(200);

    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post(`/api/gs/game/${sessionId}/guess`)
        .send({ roundIndex: 0, guess: `nope-${i}` })
        .expect(200);
      expect(r.body.concluded).toBe(i === 4);
    }

    await request(app)
      .post(`/api/gs/game/${sessionId}/guess`)
      .send({ roundIndex: 0, guess: 'still nope' })
      .expect(409);
  });
});
