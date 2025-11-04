// path: backend/controllers/authController.js
'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { URL } = require('url');
const User = require('../models/Users');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EMAIL_SECRET = process.env.EMAIL_VERIFICATION_SECRET || 'another-secret';

// Build a safe origin for links (why: avoid localhost/default mistakes in prod)
function getFrontendOrigin() {
  const raw = process.env.FRONTEND_URL;
  if (!raw) throw new Error('FRONTEND_URL is not set');
  try { return new URL(raw).origin; } catch { throw new Error(`FRONTEND_URL invalid: ${raw}`); }
}
const FRONTEND_ORIGIN = getFrontendOrigin();

// Create SMTP transport (why: default to 587 STARTTLS; only 465 uses secure)
function createTransport() {
  const { SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Missing SMTP_HOST/SMTP_USER/SMTP_PASS');
  }
  const port = Number(SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

function sign(user) {
  return jwt.sign({ sub: String(user._id), email: user.email }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

async function sendVerifyEmail(to, username, token) {
  const transporter = createTransport();
  await transporter.verify(); // why: fail fast on creds/port/TLS issues

  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error('EMAIL_FROM is not set');

  const verifyUrl = `${FRONTEND_ORIGIN}/email-verified?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from,
    replyTo: from,
    to,
    subject: 'Verify your SoundByte account',
    text: `Welcome to SoundByte, ${username}!\nVerify your email: ${verifyUrl}`,
    html: `<p>Welcome to SoundByte, ${username}!</p>
           <p>Please verify your email by clicking below:</p>
           <p><a href="${verifyUrl}">Verify Email</a></p>
           <p>If you didn’t sign up, please ignore this email.</p>`,
  });
}

exports.signup = async (req, res) => {
  try {
    const { email, password, username } = req.body || {};
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'email, username and password are required' });
    }

    const emailTrim = String(email).trim();
    const usernameTrim = String(username).trim();
    if (!emailTrim || !usernameTrim) {
      return res.status(400).json({ error: 'email and username cannot be empty' });
    }

    const emailLC = emailTrim.toLowerCase();
    const usernameLC = usernameTrim.toLowerCase();

    // Find existing by email OR username (case-insensitive via stored lowers)
    const existing = await User.findOne({
      $or: [{ emailLower: emailLC }, { usernameLower: usernameLC }],
    });

    // If a verified account conflicts, return 409 with the exact field
    if (existing?.isVerified) {
      const conflict =
        existing.emailLower === emailLC ? 'email' :
        existing.usernameLower === usernameLC ? 'username' :
        'email';
      return res.status(409).json({ error: 'Already in use', conflict, verified: true });
    }

    // Create or update an unverified user and (re)send verification
    const hash = await bcrypt.hash(String(password), 10);
    let user = existing;

    if (!user) {
      user = new User({
        email: emailTrim,
        username: usernameTrim,
        passwordHash: hash,
        isVerified: false,
      });
    } else {
      // Refresh password or username in case the unverified user is retrying
      user.passwordHash = hash;
      if (!user.username) user.username = usernameTrim;
    }

    const verificationToken = jwt.sign({ userId: user._id }, EMAIL_SECRET, { expiresIn: '24h' });
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerifyEmail(user.email, user.username, verificationToken);

    return res
      .status(existing ? 200 : 201)
      .json({
        message: existing
          ? 'Account exists but not verified. Verification email re-sent.'
          : 'Signup successful. Please verify your email.',
        resent: !!existing,
      });

  } catch (e) {
    console.error('[signup] error', {
      message: e?.message,
      code: e?.code,
      command: e?.command,
      response: e?.response,
      stack: e?.stack,
    });
    return res.status(500).json({ error: 'Unable to send verification email. Please try again later.' });
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
    return res.json({ token, user: { id: String(user._id), email: user.email, username: user.username } });
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

exports.logout = async (_req, res) => res.status(200).json({ message: 'Logged out successfully' });

exports.me = async (req, res) => {
  try {
    const id = req.user?.id;
    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: String(user._id), email: user.email, username: user.username });
  } catch {
    res.status(500).json({ error: 'Failed to load profile' });
  }
};
