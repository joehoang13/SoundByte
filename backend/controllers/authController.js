// backend/controllers/authController.js
'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/Users');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EMAIL_SECRET = process.env.EMAIL_VERIFICATION_SECRET || 'another-secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function sign(user) {
  return jwt.sign({ sub: String(user._id), email: user.email }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

exports.signup = async (req, res) => {
  try {
    const { email, password, username } = req.body || {};
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'email, username and password are required' });
    }

    const emailLC = String(email).trim().toLowerCase();
    const usernameLC = String(username).trim().toLowerCase();

    const existing = await User.findOne({
      $or: [
        { emailLower: emailLC },
        { usernameLower: usernameLC },
        { email: new RegExp(`^${email}$`, 'i') },
        { username: new RegExp(`^${username}$`, 'i') },
      ],
    }).lean();

    if (existing) {
      return res.status(409).json({ error: 'Email or username already in use' });
    }

    const hash = await bcrypt.hash(String(password), 10);

    const newUser = new User({ email, username, passwordHash: hash, isVerified: false });

    const verificationToken = jwt.sign({ userId: newUser._id }, EMAIL_SECRET, { expiresIn: '24h' });
    newUser.verificationToken = verificationToken;
    newUser.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await newUser.save();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'SoundByte <noreply@soundbyte.com>',
      to: newUser.email,
      subject: 'Verify your SoundByte account',
      html: `
        <p>Welcome to SoundByte, ${username}!</p>
        <p>Please verify your email by clicking below:</p>
        <a href="${FRONTEND_URL}/email-verified?token=${verificationToken}">
          Verify Email
        </a>
        <p>If you didn’t sign up, please ignore this email.</p>
      `,
    });

    return res.status(200).json({ message: 'Signup successful. Please verify your email.' });
  } catch (e) {
    console.error('signup error', e);
    return res.status(500).json({ error: 'Signup failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const identifier = req.body?.identifier || req.body?.email || req.body?.username || '';
    const { password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({ error: 'identifier/email/username and password required' });
    }

    const user = await User.findByIdentifier(identifier);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email before logging in.' });
    }

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

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;
  try {
    const payload = jwt.verify(token, EMAIL_SECRET);
    const user = await User.findById(payload.userId);

    if (!user || user.verificationToken !== token) {
      return res.status(400).json({ message: 'Invalid or expired verification link' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully!' });
  } catch (err) {
    console.error('email verification error', err);
    res.status(400).json({ message: 'Invalid or expired token' });
  }
};

exports.logout = async (req, res) => {
  return res.status(200).json({ message: 'Logged out successfully' });
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
