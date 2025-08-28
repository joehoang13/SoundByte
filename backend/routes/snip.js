const express = require('express');
const router = express.Router();
const snipController = require('../controllers/snipController');
const {snippetLimiter} = require('../middleware/rateLimit')

router.get('/dummy', snippetLimiter, snipController.getSnippetDummy);
router.get('/random', snippetLimiter, snipController.getRandomSnippet);
router.get('/difficulty', snippetLimiter, snipController.getRandomSnippetByDifficulty);
router.get('/genre', snippetLimiter, snipController.getRandomSnippetByGenre);

module.exports = router;
