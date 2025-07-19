const express = require('express');
const router = express.Router();
const snipController = require('../controllers/snipController');

router.get('/dummy', snipController.getSnippetDummy);
router.get('/difficulty', snipController.getRandomSnippetByDifficulty);
router.get('/genre', snipController.getRandomSnippetByGenre);

module.exports = router;
