const User = require('../models/Users');

exports.getUserDummy = async (req, res) => {
  const user = {
    _id: '60f7e3b5d6e2f1a5b2c8a9f0',
    email: 'dummyuser@example.com',
    authMethod: 'guest',
    scoreHistory: 1000000,
  };

  res.json(user);
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
