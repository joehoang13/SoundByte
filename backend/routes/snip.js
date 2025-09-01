const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/gsController');
// Optional: auth middleware if our routes require JWT
// const requireAuth = require('../middleware/auth');

function pick(...fns) {
  for (const fn of fns) if (typeof fn === 'function') return fn;
  return (_req, res) => res.status(501).json({ error: 'Not Implemented' });
}

// Expected by frontend client (frontend/src/api/gs.ts)
// POST /api/gs/session  → create/begin a new game session
router.post('/session', /* requireAuth, */ pick(ctrl.startSession, ctrl.createSession, ctrl.start));
// Alias used as fallback by client
router.post('/start', /* requireAuth, */ pick(ctrl.startSession, ctrl.createSession, ctrl.start));

// POST /api/gs/guess → submit a guess for current round
router.post('/guess', /* requireAuth, */ pick(ctrl.submitGuess, ctrl.guess));
// Alias used as fallback by client
router.post('/submit', /* requireAuth, */ pick(ctrl.submitGuess, ctrl.guess));

// POST /api/gs/end → finalize a session (optionally persist stats)
router.post('/end', /* requireAuth, */ pick(ctrl.endSession, ctrl.end, ctrl.finish));
// DELETE /api/gs → optional alternative to end/cleanup
router.delete('/', /* requireAuth, */ pick(ctrl.endSession, ctrl.end, ctrl.finish));

// Optional health for diagnostics
router.get('/health', (_req, res) => res.json({ ok: true }));

module.exports = router;
