'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/Users');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

function sign(user) {
  // why: keep existing token shape for compatibility
  return jwt.sign({ sub: String(user._id), email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function escapeRegExp(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.signup = async (req, res) => {
  try {
    const { email, password, username } = req.body || {};
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'email, username and password are required' });
    }

    const emailLC = String(email).trim().toLowerCase();
    const usernameLC = String(username).trim().toLowerCase();

    // Pre-check duplicates (handles legacy docs without lower mirrors)
    const existing = await User.findOne({
      $or: [
        { emailLower: emailLC },
        { usernameLower: usernameLC },
        { email: new RegExp(`^${escapeRegExp(email)}$`, 'i') },
        { username: new RegExp(`^${escapeRegExp(username)}$`, 'i') },
      ],
    }).lean();
    if (existing) {
      return res.status(409).json({ error: 'Email or username already in use' });
    }

    const hash = await bcrypt.hash(String(password), 10);

    const doc = new User({ email, username, passwordHash: hash });
    await doc.save();

    const token = sign(doc);
    return res
      .status(201)
      .json({ token, user: { id: String(doc._id), email: doc.email, username: doc.username } });
  } catch (e) {
    if (e && e.code === 11000) {
      // Duplicate key from unique index on emailLower/usernameLower
      const field = Object.keys(e.keyPattern || {})[0] || 'field';
      const nice = field.includes('email') ? 'Email' : 'Username';
      return res.status(409).json({ error: `${nice} already in use` });
    }
    if (e && e.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation error', details: e.errors });
    }
    console.error('signup error', e);
    return res.status(500).json({ error: 'Signup failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const identifier =
      (req.body && (req.body.identifier || req.body.email || req.body.username)) || '';
    const { password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({ error: 'identifier/email/username and password required' });
    }

    const user = await User.findByIdentifier(identifier);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = sign(user);
    return res.json({
      token,
      user: { id: String(user._id), email: user.email, username: user.username },
    });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: 'Login failed' });
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
