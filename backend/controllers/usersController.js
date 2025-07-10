const User = require('../models/Users');

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
