const express = require('express');
const router = express.Router();
const userController = require('../controllers/gsController');
const { sessionLimiter } = require('../middleware/rateLimit');

router.get('/dummy', sessionLimiter, userController.getGameSessionDummy);

module.exports = router;
