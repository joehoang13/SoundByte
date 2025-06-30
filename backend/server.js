const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

// Load models
require('./models/Users');
require('./models/Snippet');
require('./models/GameSession');
require('./models/PlayerStats');


console.log("Loaded MONGODB_URI:", process.env.MONGODB_URI);

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
const userRoutes = require('./routes/users');
const gsRoutes = require('./routes/gs');
const snipRoutes = require('./routes/snip');

app.use('/api/users', userRoutes);
app.use('/api/gs', gsRoutes);
app.use('/api/snip', snipRoutes);

// Start server
app.listen(3000, () => console.log('🚀 Server running on port 3000'));
