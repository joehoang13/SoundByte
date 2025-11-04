const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // <- load from backend folder first

// backend/server.js — Express + Socket.IO (rooms + lobby sync)
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const setupSocket = require('./sockets/index');

//Models
require('./models/Users');
require('./models/Snippet');
require('./models/GameSession');
require('./models/PlayerStats');
require('./models/Questions');
const Room = require('./models/Room'); // <- new Rooms model

// Rate limiter
const { authLimiter } = require('./middleware/rateLimit');

// App
const app = express();

// Logging
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - t0;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`);
  });
  next();
});

// CORS
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
const ORIGINS = Array.from(new Set([...ENV_ORIGINS])).map(normalize);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // allow curl/postman
    const ok = ORIGINS.includes(normalize(origin));
    if (!ok && process.env.NODE_ENV !== 'production') {
      console.warn('CORS (dev allow):', origin);
      return cb(null, true);
    }
    if (ok) return cb(null, true);
    console.warn('CORS blocked:', origin);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ----------------------------- Middleware ----------------------------- */
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(helmet());

/* --------------------------- Health Endpoints -------------------------- */
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get('/api/gs/ping', (_req, res) => res.json({ ok: true, scope: 'gs' }));

/* -------------------------- DB & Secret Checks ------------------------- */
if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in environment');
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB error:', err);
    process.exit(1);
  });

/* -------------------------------- Routes ------------------------------- */
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const createGsRouter = require('./routes/gs');
const snipRoutes = require('./routes/snip');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/gs', createGsRouter());
app.use('/api/snip', snipRoutes);
app.use('/api/snippets', snipRoutes);

// 404 (keep last)
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

const server = http.createServer(app);
setupSocket(server);
/* ------------------------------- Startup ------------------------------ */
const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, () => {
  console.log(`Server on :${PORT} (CORS: ${ORIGINS.join(', ')})`);
});
