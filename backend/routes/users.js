const express = require('express');
const router = express.Router();
const userController = require('../controllers/usersController');
const User = require('../models/Users');
const Snippet = require('../models/Snippet');
const GameSession = require('../models/GameSession');
const PlayerStats = require('../models/PlayerStats');
const { userLimiter } = require('../middleware/rateLimit');
const requireAuth = require('../middleware/auth');


router.get('/', userLimiter, userController.getUserByEmail);
router.get('/dummy', userLimiter, userController.getUserDummy);
const authController = require('../controllers/authController');
router.post('/register', userLimiter, authController.signup);
router.post('/login', userLimiter, authController.login);
router.post('/reset', userLimiter, userController.resetPassword);
router.post('/requestReset', userLimiter, userController.requestPasswordReset);
router.get('/me', requireAuth, userController.getProfileStats);



module.exports = router;
