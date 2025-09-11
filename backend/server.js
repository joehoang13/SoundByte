// backend/server.js — Express + Socket.IO (rooms + lobby sync)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

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
const server = http.createServer(app); // HTTP wrapper for Socket.IO

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
  .map((s) => s.trim())
  .filter(Boolean);

const normalize = (o) => (o || '').replace(/\/$/, '');
const ORIGINS = Array.from(new Set([...DEFAULT_ORIGINS, ...ENV_ORIGINS])).map(normalize);

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
  .catch((err) => {
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

/* ----------------------------- Socket.IO ------------------------------ */
const io = new Server(server, {
  cors: {
    origin: ORIGINS,
    credentials: true,
  },
});

const socketState = new Map();

// small helper
function ensureHost(room, userId) {
  if (!room?.host || room.host.userId !== userId) {
    const err = new Error('Only host can perform this action');
    err.status = 403;
    throw err;
  }
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Client → createRoom
  socket.on('createRoom', async (payload, cb) => {
    try {
      const { userId, username, mode, settings } = payload || {};
      if (!userId || !username) throw new Error('Missing userId/username');

      const room = await Room.createRoom({
        hostUserId: userId,
        hostUsername: username,
        mode,
        settings,
      });

      socket.join(room.code);
      socketState.set(socket.id, { code: room.code, userId });

      const summary = room.toLobbySummary();
      io.to(room.code).emit('room:update', summary);
      cb?.({ ok: true, room: summary });
    } catch (err) {
      console.error('createRoom error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('room:error', err.message);
    }
  });

  // Client → joinRoom
  socket.on('joinRoom', async (payload, cb) => {
    try {
      const { code, userId, username, passcode } = payload || {};
      if (!code || !userId || !username) throw new Error('Missing code/userId/username');

      const room = await Room.joinByCode({
        code,
        userId,
        username,
        socketId: socket.id,
        passcode,
      });

      socket.join(room.code);
      socketState.set(socket.id, { code: room.code, userId });

      const summary = room.toLobbySummary();
      io.to(room.code).emit('room:update', summary);
      cb?.({ ok: true, room: summary });
    } catch (err) {
      console.error('joinRoom error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('room:error', err.message);
    }
  });

  // Client → leaveRoom
  socket.on('leaveRoom', async (payload, cb) => {
    try {
      const { code: codeFromClient, userId } = payload || {};
      const tracked = socketState.get(socket.id);
      const code = (codeFromClient || tracked?.code || '').toUpperCase();
      if (!code || !userId) throw new Error('Missing code/userId');

      const room = await Room.leaveByCode({ code, userId });
      socket.leave(code);
      socketState.delete(socket.id);

      if (room) {
        io.to(code).emit('room:update', room.toLobbySummary());
        cb?.({ ok: true, deleted: false });
      } else {
        io.to(code).emit('room:deleted');
        cb?.({ ok: true, deleted: true });
      }
    } catch (err) {
      console.error('leaveRoom error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('room:error', err.message);
    }
  });

  // Client → requestRoom 
  socket.on('requestRoom', async (payload, cb) => {
    try {
      const { code } = payload || {};
      if (!code) throw new Error('Missing code');
      const room = await Room.findOne({ code: code.toUpperCase() });
      if (!room) throw new Error('Room not found');
      const summary = room.toLobbySummary();
      cb?.({ ok: true, room: summary });
    } catch (err) {
      console.error('requestRoom error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('room:error', err.message);
    }
  });

  // Client → updateRoomSettings (host only)
  // payload.patch can include { maxPlayers, isPrivate, passcode }
  socket.on('updateRoomSettings', async (payload, cb) => {
    try {
      const { code, userId, patch } = payload || {};
      if (!code || !userId || !patch) throw new Error('Missing code/userId/patch');

      const room = await Room.findOne({ code: code.toUpperCase() });
      if (!room) throw new Error('Room not found');
      ensureHost(room, userId);

      if (typeof patch.maxPlayers === 'number') {
        const val = Math.max(1, Math.min(32, patch.maxPlayers));
        room.settings.maxPlayers = val;
      }
      if (typeof patch.isPrivate === 'boolean') {
        room.settings.isPrivate = patch.isPrivate;
      }
      if (typeof patch.passcode === 'string') {
        room.settings.passcode = patch.passcode.trim();
      }

      await room.save();
      const summary = room.toLobbySummary();
      io.to(room.code).emit('room:update', summary);
      cb?.({ ok: true, room: summary });
    } catch (err) {
      console.error('updateRoomSettings error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('room:error', err.message);
    }
  });

  // Client → setMode (host only)
  socket.on('setMode', async (payload, cb) => {
    try {
      const { code, userId, mode } = payload || {};
      if (!code || !userId || !mode) throw new Error('Missing code/userId/mode');

      const room = await Room.findOne({ code: code.toUpperCase() });
      if (!room) throw new Error('Room not found');
      ensureHost(room, userId);

      room.mode = String(mode).trim();
      await room.save();

      const summary = room.toLobbySummary();
      io.to(room.code).emit('room:update', summary);
      cb?.({ ok: true, room: summary });
    } catch (err) {
      console.error('setMode error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('room:error', err.message);
    }
  });

  // Client → startGame (host only)
  socket.on('startGame', async (payload, cb) => {
    try {
      const { code, userId } = payload || {};
      if (!code || !userId) throw new Error('Missing code/userId');

      const room = await Room.findOne({ code: code.toUpperCase() });
      if (!room) throw new Error('Room not found');
      ensureHost(room, userId);

      if (room.status !== 'lobby') throw new Error('Game already started or ended');
      room.status = 'in-game';
      room.currentRound = 1;
      await room.save();

      const summary = room.toLobbySummary();
      io.to(room.code).emit('room:update', summary);
      cb?.({ ok: true, room: summary });
    } catch (err) {
      console.error('startGame error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('room:error', err.message);
    }
  });

  // Client → endGame (host only)
  socket.on('endGame', async (payload, cb) => {
    try {
      const { code, userId } = payload || {};
      if (!code || !userId) throw new Error('Missing code/userId');

      const room = await Room.findOne({ code: code.toUpperCase() });
      if (!room) throw new Error('Room not found');
      ensureHost(room, userId);

      if (room.status === 'ended') throw new Error('Game already ended');
      room.status = 'ended';
      await room.save();

      const summary = room.toLobbySummary();
      io.to(room.code).emit('room:update', summary);
      cb?.({ ok: true, room: summary });
    } catch (err) {
      console.error('endGame error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('room:error', err.message);
    }
  });

  // Guess relay (unchanged idea, scoped by { code, guess })
  socket.on('guess', (payload) => {
    try {
      const { code, guess } = payload || {};
      if (!code) return;
      io.to(code.toUpperCase()).emit('newGuess', { playerId: socket.id, guess });
    } catch (err) {
      console.error('guess error:', err.message);
    }
  });

  // Cleanup on disconnect
  socket.on('disconnect', async () => {
    try {
      const tracked = socketState.get(socket.id);
      if (!tracked) return;
      const { code, userId } = tracked;

      const room = await Room.leaveByCode({ code, userId });
      socketState.delete(socket.id);

      if (room) {
        io.to(code).emit('room:update', room.toLobbySummary());
      } else {
        io.to(code).emit('room:deleted');
      }
    } catch (err) {
      console.error('disconnect cleanup error:', err.message);
    } finally {
      console.log(`Socket disconnected: ${socket.id}`);
    }
  });
});

/* ------------------------------- Startup ------------------------------ */
const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, () => {
  console.log(`Server on :${PORT} (CORS: ${ORIGINS.join(', ')})`);
});
