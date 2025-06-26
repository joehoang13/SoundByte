const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
console.log("Loaded MONGODB_URI:", process.env.MONGODB_URI);


const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// Start server
app.listen(3000, () => console.log('🚀 Server running on port 3000'));
