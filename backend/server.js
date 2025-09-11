// backend/server.js — normalized CORS + preflight + quick pings
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const setupSocket = require('./sockets/index')

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
// Accept multiple env names, allow common dev ports by default, and never 500 on CORS.
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173', // vite preview
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
const ENV_ORIGINS = (
  process.env.CORS_ORIGINS ||
  process.env.CORS_ORIGIN ||
  process.env.CLIENT_ORIGIN ||
  ''
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const normalize = o => (o || '').replace(/\/$/, '');
const ORIGINS = Array.from(new Set([...DEFAULT_ORIGINS, ...ENV_ORIGINS])).map(normalize);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // non-browser / same-origin
    const ok = ORIGINS.includes(normalize(origin));

    // In dev, be permissive to avoid local 500s if origin isn't listed yet
    if (!ok && process.env.NODE_ENV !== 'production') {
      console.warn('CORS (dev allow):', origin);
      return cb(null, true);
    }

    if (ok) return cb(null, true);

    // Do NOT throw an error here (causes 500). Deny politely.
    console.warn('CORS blocked:', origin);
    return cb(null, false);
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

const server = http.createServer(app);
setupSocket(server);
const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, () => console.log(`Server on :${PORT} (CORS: ${ORIGINS.join(', ')})`));
