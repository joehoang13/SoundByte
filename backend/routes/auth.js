const express = require('express');
const { body, validationResult } = require('express-validator');
const authCtl = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const errors = validationResult(req);
      return errors.isEmpty() ? next() : res.status(400).json({ errors: errors.array() });
    },
  ];
}

router.post(
  '/signup',
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('username').optional().isString().trim(),
  ]),
  authCtl.signup
);

router.post(
  '/login',
  validate([body('email').isEmail().normalizeEmail(), body('password').notEmpty()]),
  authCtl.login
);

router.get('/me', auth, authCtl.me);

module.exports = router;
