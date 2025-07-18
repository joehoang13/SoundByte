const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
require('dotenv').config();

// Load models
require('./models/Users');
require('./models/Snippet');
require('./models/GameSession');
require('./models/PlayerStats');

console.log('Loaded MONGODB_URI:', process.env.MONGODB_URI);

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Connection to MongoDB successful'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
const userRoutes = require('./routes/users');
const gsRoutes   = require('./routes/gs');
const snipRoutes = require('./routes/snip');

app.use('/api/users',    userRoutes);
app.use('/api/gs',       gsRoutes);
app.use('/api/snippets', snipRoutes);

// Start server on 3001 (so it won’t collide with a React app on 3000)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
