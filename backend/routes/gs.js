const express = require('express');
const router = express.Router();
const userController = require('../controllers/gsController');

router.get('/dummy', userController.getGameSessionDummy);

module.exports = router;
