const GameSession = require('../models/GameSession');

exports.getGameSessionDummy = async (req, res) => {
  const dummyGameSession = {
    userId: '665d71f9b9c3b12a54e12345', // pretend ObjectId
    mode: 'classic',
    score: 7300,
    answerStreak: 4,
    snippetSize: 5,
    answers: [
      {
        snippetId: '665d7206a1b3a03c94e67890', // pretend ObjectId
        userAnswer: 'Kanye West',
        correct: true,
        timeTaken: 5.2,
      },
      {
        snippetId: '665d7206a1b3a03c94e67891',
        userAnswer: 'Drake',
        correct: false,
        timeTaken: 6.8,
      },
    ],
    startedAt: new Date('2025-06-23T15:00:00Z'),
    endedAt: new Date('2025-06-23T15:05:45Z'),
  };

  res.json(dummyGameSession);
};
