const express = require('express');
const router = express.Router();
const userController = require('../controllers/usersController');
const User = require('../models/Users');

router.get('/', userController.getUserByEmail);
router.get('/dummy', userController.getUserDummy);

module.exports = router;

router.post('/test', async (req, res) => {
    try {
      console.log('POST /api/users/test route hit');
      const newUser = new User({
        username: 'testuser',
        email: 'test@example.com',
      });
      const savedUser = await newUser.save();
      console.log('Saved user:', savedUser);
      res.status(201).json({ message: 'Test user created' });
    } catch (err) {
      console.error('Error saving user:', err);
      res.status(500).json({ message: err.message });
    }
});
  