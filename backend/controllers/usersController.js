const User = require('../models/Users');
const bcrypt = require('bcrypt');

exports.getUserDummy = async (req, res) => {
  const dummyUser = {
    username: 'testuser123',
    email: 'testuser@example.com',
    passwordHash: '$2b$10$abcd1234fakehash5678efgh', // fake hashed password
    authProvider: 'firebase',
    profilePicture: 'https://example.com/avatar.png',
    createdAt: new Date('2024-12-01T10:15:30Z'),
    highScores: {
      classic: 8500,
      instrumental: 7200,
      lyrics: 9100,
      sampleHunt: 6800,
      artistChallenge: 7500,
    },
    totalGamesPlayed: 42,
  };

  res.json(dummyUser);
};

//Friending?
exports.getUserByEmail = async (req, res) => {
  const { email } = req.params;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user by email: ', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      passwordHash,
      authProvider: 'firebase',
      profilePicture:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Default_pfp.svg/2048px-Default_pfp.svg.png',
      highScores: {
        classic: 0,
        instrumental: 0,
        lyrics: 0,
        sampleHunt: 0,
        artistChallenge: 0,
      },
      totalGamesPlayed: 0,
      needsReset: false,
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (err) {
    console.error('Error when registering User:', err);
    res.status(500).json({ error: 'Server error while registering user.' });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await User.findOne({ username: username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid Username' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Password' });
    }

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        highScores: user.highScores,
        totalGamesPlayed: user.totalGamesPlayed,
      },
    });
  } catch (err) {
    console.error('Error logging in', err);
    res.status(500).json({ error: 'Server error while logging in.' });
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Generate a 6-digit token (e.g. 123456)
    const token = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetToken = token;
    user.needsReset = true;

    await user.save();

    //TODO: Send user email with token

    res.status(200).json({ message: 'Reset code sent to email' });
  } catch (err) {
    console.error('Error requesting password reset:', err);
    res.status(500).json({ error: 'Server error while requesting password reset.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { username, newPassword, resetToken } = req.body;

    if (!username || !newPassword || !resetToken) {
      return res
        .status(400)
        .json({ error: 'Username, new password, and reset token are required.' });
    }

    const user = await User.findOne({ username });

    if (!user || !user.needsReset || user.resetToken !== resetToken) {
      return res.status(403).json({ error: 'Invalid or expired reset token.' });
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    user.passwordHash = newHashedPassword;
    user.resetToken = '';
    user.needsReset = false;

    await user.save();

    res.status(200).json({ message: 'Password reset successful.' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Server error while resetting password.' });
  }
};
