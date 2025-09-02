// backend/server.js — normalized CORS + preflight + quick pings
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
require('dotenv').config();

// Models (side-effect)
require('./models/Users');
require('./models/Snippet');
require('./models/GameSession');
require('./models/PlayerStats');

// Rate limiter
const { authLimiter } = require('./middleware/rateLimit');

const app = express();

app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - t0;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ── CORS (single, normalized) ──────────────────────────────────────────────
const ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // non-browser clients
    return ORIGINS.includes(origin) ? cb(null, true) : cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // allow JWT header
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // reply to preflight

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(helmet());

// Health + ping
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get('/api/gs/ping', (_req, res) => res.json({ ok: true, scope: 'gs' }));

// ── DB + secrets ───────────────────────────────────────────────────────────
if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment');
  process.exit(1);
}
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in environment');
  process.exit(1);
}

// Routers
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const createGsRouter = require('./routes/gs');
const snipRoutes = require('./routes/snip');

// Mount
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/gs', createGsRouter()); // IMPORTANT: invoke factory
app.use('/api/snip', snipRoutes);
app.use('/api/snippets', snipRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`Server on :${PORT} (CORS: ${ORIGINS.join(', ')})`));
