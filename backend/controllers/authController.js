const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/Users');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

function sign(user) {
  return jwt.sign({ sub: String(user._id), email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

exports.signup = async (req, res) => {
  try {
    const { email, password, username } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);
    const doc = new User({ email, username, password: hash, passwordHash: hash });
    await doc.save();

    const token = sign(doc);
    res
      .status(201)
      .json({ token, user: { id: String(doc._id), email: doc.email, username: doc.username } });
  } catch (e) {
    // Handle duplicate key index just in case
    if (e && e.code === 11000) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    if (e && e.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation error', details: e.errors });
    }
    console.error('signup error', e);
    // expose message in dev only
    return res.status(500).json({
      error: 'Signup failed',
      ...(process.env.NODE_ENV !== 'production' ? { message: e.message } : {}),
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    // Try to fetch whichever hash field your schema uses
    const user = await User.findOne({ email }).select('+password +passwordHash +email +username');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const hash = user.passwordHash || user.password;
    if (!hash) return res.status(500).json({ error: 'No password set' });

    const ok = await bcrypt.compare(password, hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = sign(user);
    res.json({ token, user: { id: String(user._id), email: user.email, username: user.username } });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.me = async (req, res) => {
  try {
    const id = req.user?.id;
    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: String(user._id), email: user.email, username: user.username });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
};
