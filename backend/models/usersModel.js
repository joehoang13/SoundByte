const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  id: String,
  email: String,
  authMethod: String,
  scoreHistory: Number,
});

module.exports = mongoose.model('User', userSchema);
