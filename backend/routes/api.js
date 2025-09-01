const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/snip', require('./snip'));

// Use default auth middleware in production
const createGsRouter = require('./gs');
router.use('/gs', createGsRouter({}));

module.exports = router;
