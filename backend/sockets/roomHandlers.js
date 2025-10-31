const Room = require('../models/Room');
const User = require('../models/Users');
const { generateGameQuestions } = require('../utils/gameUtils');

function ensureHost(room, userId) {
  if (!room?.host || room.host.toString() !== userId) {
    const err = new Error('Only host can perform this action');
    err.status = 403;
    throw err;
  }
}

function multiplayerRoomHandler(io, socket, socketState) {
  socket.on('createRoom', async (payload, cb) => {
    try {
      const { hostId, hostSocketId, mode, settings } = payload || {};
      if (!hostId) throw new Error('Missing userId/username');

      const room = await Room.createRoom({
        hostId: hostId,
        hostSocketId: hostSocketId,
        mode,
        settings,
      });

      socket.join(room.code);
      socketState.set(socket.id, { code: room.code, userId: hostId });

      const summary = await room.toLobbySummary();
      io.to(room.code).emit('room:update', summary);
      cb?.({ ok: true, room: summary });
    } catch (err) {
      console.error('createRoom error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('room:error', err.message);
    }
  });

  socket.on('joinRoom', async (payload, cb) => {
    try {
      const { code, userId, userSocketId, passcode } = payload || {};
      if (!code || !userId) throw new Error('Missing code/userId');

      const room = await Room.joinByCode({
        code,
        userId,
        userSocketId: userSocketId,
        passcode,
      });

      socket.join(room.code);
      socketState.set(socket.id, { code: room.code, userId });

      const summary = await room.toLobbySummary();
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
      const { roomId, userId } = payload || {};
      const tracked = socketState.get(socket.id);
      const code = (roomId || tracked?.code || '').toUpperCase();
      if (!code || !userId) throw new Error('Missing code/userId');

      const room = await Room.leaveByCode({ code, userId });
      socket.leave(code);
      socketState.delete(socket.id);

      if (room) {
        io.to(code).emit('room:update', await room.toLobbySummary());
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
      const summary = await room.toLobbySummary();
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
      const summary = await room.toLobbySummary();
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

      const summary = await room.toLobbySummary();
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
      const { code, hostId, players } = payload || {};
      if (!code || !hostId || !players) throw new Error('Missing code/hostId/players');

      const room = await Room.findOne({ code: code.toUpperCase() });
      if (!room) throw new Error('Room not found');
      ensureHost(room, hostId);

      if (room.status !== 'lobby') throw new Error('Game already started or ended');
      room.status = 'in-game';
      room.currentRound = 1;
      await room.save();

      // 🔁 Generate shared question set
      const gameData = await generateGameQuestions(4); // or pull rounds from settings
      await redis.set(`room:${room.code}:questions`, JSON.stringify(gameData), 'EX', 3600); // TTL 1h

      await redis.set(
        `room:${room.code}:scores`,
        JSON.stringify(
          players.reduce((acc, player) => {
            acc[player.id] = {
              score: 1,
              correct: 1,
              finished: false,
            };
            return acc;
          }, {} )
        )
      );
      const summary = await room.toLobbySummary();

      io.to(room.code).emit('room:update', summary);
      io.to(room.code).emit('game:start', await redis.get(`room:${room.code}:questions`));

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
      const { roomCode, userId } = payload || {};
      if (!roomCode || !userId) throw new Error('Missing code/userId');

      scoresString = await redis.get(`room:${roomCode}:scores`);
      const scoresJSON = JSON.parse(scoresString);
      
      const players = Object.values(scoresJSON);
      const finishedCount = players.filter(p => p.finished).length;
      const shouldEndGame = finishedCount >= players.length - 1;

      if (shouldEndGame) {
        const leaderboard = [];
        for (const userId in scoresJSON) {
          const user = await User.findById(userId);
          const entry = {
            name: user.username,
            score: scoresJSON[userId].score,
          }
          leaderboard.push(entry);
        }
        leaderboard.sort((a,b) => b.score - a.score); 
        io.to(roomCode).emit('game:end', leaderboard);
        cb?.({ allDone: true});
      }
      else {
        scoresJSON[userId].finished = true;
        await redis.set(`room:${roomCode}:scores`,JSON.stringify(scoresJSON));
        cb?.({ allDone: false})
      }
      
    } catch (err) {
      console.error('endGame error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('room:error', err.message);
    }
  });

  const redis = require('../utils/redisClient');
  const { normalize, titleArtistMatch } = require('../utils/scoringUtils'); // we'll extract this
  const Snippet = require('../models/Snippet');

  socket.on('game:answer', async (payload, cb) => {
    try {
      const { code, userId, roundIndex, guess } = payload || {};
      if (!code || !userId || !guess) throw new Error('Missing code/userId/guess');

      const roomCode = code.toUpperCase();
      const questionsRaw = await redis.get(`room:${roomCode}:questions`);
      if (!questionsRaw) throw new Error('No questions found for this room');

      const questions = JSON.parse(questionsRaw);
      const snippetMeta = questions.snippets[roundIndex];
      if (!snippetMeta) throw new Error('Invalid round index');

      const snippet = await Snippet.findById(snippetMeta.snippetId);
      if (!snippet) throw new Error('Snippet not found');
      // Match logic (reuse from gsController)
      const { titleHit, artistHit, correct } = titleArtistMatch(
        guess,
        snippet.title || '',
        snippet.artist || ''
      );
      let base = 0,
        timeBonus = 0,
        total = 0;
      let concluded = false;

      if (correct) {
        base = 1000;
        timeBonus = 300; // static or adjust with timing later
        total = base + timeBonus;
        concluded = true;
      }

      // Update score in Redis
      const scoreKey = `room:${roomCode}:scores`;
      const scoreRaw = await redis.get(scoreKey);
      const scoreMap = scoreRaw ? JSON.parse(scoreRaw) : {};

      const prev = scoreMap[userId] || { score: 0, correct: 0 };
      if (correct) {
        prev.score += total;
        prev.correct += 1;
      }

      scoreMap[userId] = prev;
      await redis.set(scoreKey, JSON.stringify(scoreMap), 'EX', 3600);

      // Emit score update
      io.to(roomCode).emit('game:scoreUpdate', {
        userId,
        newScore: prev.score,
        correctCount: prev.correct,
      });

      cb?.({
        correct,
        concluded,
        breakdown: { base, timeBonus, total },
        score: prev.score,
      });
    } catch (err) {
      console.error('game:answer error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('game:error', err.message);
    }
  });

  // Guess relay (unchanged idea, scoped by { code, guess })
  socket.on('guess', payload => {
    try {
      const { code, guess } = payload || {};
      if (!code) return;
      io.to(code.toUpperCase()).emit('newGuess', { playerId: socket.id, guess });
    } catch (err) {
      console.error('guess error:', err.message);
    }
  });

}

module.exports = { multiplayerRoomHandler };
