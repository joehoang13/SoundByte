import express = require('express');
import request = require('supertest');
import mongoose = require('mongoose');
import { seedSnippets } from './helpers/seed';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const createGsRouter = require('../routes/gs');

function makeApp() {
  const app = express();
  app.use(express.json());
  const authBypass = (_req: any, _res: any, next: any) => {
    // why: tests don't need JWT; controller also accepts body.userId
    _req.user = { id: new mongoose.Types.ObjectId().toHexString() };
    next();
  };
  app.use('/api/gs', createGsRouter({ auth: authBypass }));
  return app;
}

describe('Router + auth chain (E2E)', () => {
  const app = makeApp();
  const userId = new mongoose.Types.ObjectId().toHexString();

  beforeEach(async () => {
    await seedSnippets();
  });

  it('flows through router with injected auth', async () => {
    const start = await request(app)
      .post('/api/gs/game/start')
      .send({ userId, difficulty: 'easy', snippetSize: 5, rounds: 1 })
      .expect(200);

    const { sessionId } = start.body;
    await request(app)
      .post(`/api/gs/game/${sessionId}/round/started`)
      .send({ roundIndex: 0 })
      .expect(200);
    const r = await request(app)
      .post(`/api/gs/game/${sessionId}/guess`)
      .send({ roundIndex: 0, guess: 'artist' }) // might be wrong; we only check status 200
      .expect(200);
    expect(typeof r.body.correct).toBe('boolean');
  });
});
