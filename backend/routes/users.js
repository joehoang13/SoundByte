const express = require('express');
const router = express.Router();
const userController = require('../controllers/usersController');
const User = require('../models/Users');
const Snippet = require('../models/Snippet');
const GameSession = require('../models/GameSession');
const PlayerStats = require('../models/PlayerStats');

router.get('/', userController.getUserByEmail);
router.get('/dummy', userController.getUserDummy);
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/reset', userController.resetPassword);

module.exports = router;
