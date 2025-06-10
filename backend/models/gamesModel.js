const mongoose = require('mongoose')

const gameSchema = mongoose.Schema({
  players: String,
  answers: String,
  timeStamps: String,
  scores: String,
})

module.exports = mongoose.model('Game', gameSchema)
