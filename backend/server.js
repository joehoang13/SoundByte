const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./routes/auth');
const helmet = require('helmet');
const { authLimiter } = require('./middleware/rateLimit');
require('dotenv').config();

// Load models
require('./models/Users');
require('./models/Snippet');
require('./models/GameSession');
require('./models/PlayerStats');

console.log('Loaded MONGODB_URI:', process.env.MONGODB_URI);

const app = express();
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: ORIGIN })); // why: avoid wide-open CORS in prod
app.use(express.json({ limit: '1mb' })); // why: protect against large payloads
app.use(morgan('dev'));
app.use('/api/auth', authRoutes);

// Health for uptime checks and docker-compose
app.get('/health', (_req, res) => res.json({ ok: true }));

// Connect to MongoDB
if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment');
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Connection to MongoDB successful'))
  .catch(err => console.error('MongoDB connection error:', err));

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in environment');
  process.exit(1); // why: fail fast in all envs
}

app.use(helmet());

// Gentle rate limit for auth endpoints only
app.use('/api/auth', authLimiter);

// Routes
const userRoutes = require('./routes/users');
const gsRoutes = require('./routes/gs');
const snipRoutes = require('./routes/snip');

app.use('/api/users', userRoutes);
app.use('/api/gs', gsRoutes);
app.use('/api/snippets', snipRoutes);

// 404 for any unmatched route
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// Start server on 3001 (so it won’t collide with a React app on 3000)
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`Server running on port ${PORT} (CORS origin: ${ORIGIN})`));
