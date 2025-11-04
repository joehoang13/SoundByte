// backend/routes/auth.js
const express = require('express');
const { body, oneOf, validationResult } = require('express-validator');
const authCtl = require('../controllers/authController');
const auth = require('../middleware/auth');
const usersCtl = require('../controllers/usersController');

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
    body('username').isString().trim().isLength({ min: 3, max: 32 }),
    body('password').isLength({ min: 8 }),
  ]),
  authCtl.signup
);

router.post(
  '/login',
  validate([
    oneOf(
      [
        body('identifier').isString().trim().notEmpty(),
        body('email').isString().trim().notEmpty(),
        body('username').isString().trim().notEmpty(),
      ],
      'identifier/email/username required'
    ),
    body('password').notEmpty(),
  ]),
  authCtl.login
);

router.post('/request-password-reset', usersCtl.requestPasswordReset);
router.post('/reset-password', usersCtl.resetPassword);

router.get('/verify-email', authCtl.verifyEmail);
router.get('/verify', authCtl.verifyEmail);
router.post('/verify', authCtl.verifyEmail);
router.post('/logout', auth, authCtl.logout);

module.exports = router;
