const express = require('express');
const gs = require('../controllers/gsController');

module.exports = function createGameRouter({ auth } = {}) {
  const router = express.Router();
  const useAuth = auth || require('../middleware/auth');

  router.get('/ping', (req, res) => res.json({ ok: true, scope: 'gs' }));
  router.get('/inventory', useAuth, gs.inventory);

  router.post('/game/start', useAuth, gs.startGame);
  router.post('/game/:sessionId/round/started', useAuth, gs.setRoundStarted);
  router.post('/game/:sessionId/guess', useAuth, gs.submitGuess);
  router.post('/game/:sessionId/next', useAuth, gs.nextRound);
  router.post('/game/:sessionId/finish', useAuth, gs.finishGame);

  return router;
};
