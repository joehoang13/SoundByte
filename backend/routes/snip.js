const express = require('express');
const router = express.Router();
const userController = require('../controllers/snipController');

router.get('/dummy', userController.getSnippetDummy);

module.exports = router;
