const express = require('express');
const router = express.Router();
const Question = require('../models/Questions');

// GET /api/questions/random?limit=3
router.get('/random', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 3;
    const items = await Question.aggregate([{ $sample: { size: limit } }]);
    res.json({ ok: true, items });
  } catch (err) {
    console.error('Error fetching random inference questions:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch inference questions' });
  }
});

// Optional: GET /api/questions/all → retrieve all questions
router.get('/all', async (_req, res) => {
  try {
    const all = await Question.find({});
    res.json({ ok: true, items: all });
  } catch (err) {
    console.error('Error fetching all questions:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch all inference questions' });
  }
});

// Optional: POST /api/questions → add a new question manually
router.post('/', async (req, res) => {
  try {
    const { question, answer, difficulty } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const newQ = new Question({ question, answer, difficulty });
    await newQ.save();
    res.json({ ok: true, item: newQ });
  } catch (err) {
    console.error('Error saving question:', err);
    res.status(500).json({ ok: false, error: 'Failed to save question' });
  }
});

module.exports = router;
