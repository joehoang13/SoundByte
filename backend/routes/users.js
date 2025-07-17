const express = require('express');
const router = express.Router();
const userController = require('../controllers/usersController');
const User = require('../models/Users');
const Snippet = require('../models/Snippet');
const GameSession = require('../models/GameSession');
const PlayerStats = require('../models/PlayerStats');

router.get('/', userController.getUserByEmail);
router.get('/dummy', userController.getUserDummy);
router.get('/register', userController.registerUser);
router.get('/login', userController.loginUser);

module.exports = router;
