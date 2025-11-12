const Room = require('../models/Room');
const User = require('../models/Users');
const { generateGameQuestions } = require('../utils/gameUtils');
const redis = require('../utils/redisClient');
const { normalize, titleArtistMatch } = require('../utils/scoringUtils');
const Snippet = require('../models/Snippet');

function ensureHost(room, userId) {
  if (!room?.host || room.host.toString() !== userId) {
    const err = new Error('Only host can perform this action');
    err.status = 403;
    throw err;
  }
}

function multiplayerRoomHandler(io, socket, socketState) {
  const memQuestions = (multiplayerRoomHandler.__q ||= new Map()); // code -> gameData
  const memAttempts = (multiplayerRoomHandler.__a ||= new Map()); // `${code}|${round}|${user}` -> count
  const memScores = (multiplayerRoomHandler.__s ||= new Map()); // code -> { [userId]: {...} }
  const memEnded = (multiplayerRoomHandler.__ended ||= new Set());

  const attemptKey = (code, roundIndex, userId) => `${code}|${roundIndex}|${userId}`;

  async function loadScores(roomCode) {
    // try redis first (only if enabled)
    if (redis.enabled) {
      try {
        const raw = await redis.client.get(`room:${roomCode}:scores`);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    // fallback to memory
    return memScores.get(roomCode) || {};
  }

  async function saveScores(roomCode, map) {
    // always update memory
    memScores.set(roomCode, map);
    // also write to redis when available
    if (redis.enabled) {
      try {
        await redis.client.set(`room:${roomCode}:scores`, JSON.stringify(map), 'EX', 3600);
      } catch {}
    }
  }

  async function resolveUsername(uid) {
    try {
      const u = await User.findById(uid).select('_id username').lean();
      return u?.username || 'Player';
    } catch {
      return 'Player';
    }
  }

  const clearRoomMem = code => {
    memQuestions.delete(code);
    memScores.delete(code);
    for (const k of memAttempts.keys()) if (k.startsWith(`${code}|`)) memAttempts.delete(k);
    memEnded.delete(code);
  };
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

  socket.on('startGame', async (payload, cb) => {
    try {
      const { code, hostId } = payload || {};
      if (!code || !hostId) throw new Error('Missing code/hostId');

      const room = await Room.findOne({ code: code.toUpperCase() });
      if (!room) throw new Error('Room not found');
      ensureHost(room, hostId);

      if (room.status !== 'lobby') throw new Error('Game already started or ended');

      room.status = 'in-game';
      room.currentRound = 1;
      await room.save();

      memEnded.delete(room.code);

      const gameData = await generateGameQuestions(10);
      const questionsKey = `room:${room.code}:questions`;
      const scoresKey = `room:${room.code}:scores`;
      const payloadStr = JSON.stringify(gameData);

      try {
        await redis.client.set(questionsKey, payloadStr, 'EX', 3600);
      } catch {}
      memQuestions.set(room.code, gameData);

      const players = room.players || [];
      const initialScores = {};
      for (const p of players) {
        const pid = (p.user || p).toString?.() || p.id || p._id || p;
        if (!pid) continue;
        initialScores[pid] = {
          score: 0,
          correct: 0,
          finished: false,
          streak: 0,
          name: p.username || p.name || (await resolveUsername(pid)),
        };
      }
      // include host too (some models don’t duplicate host in players array)
      const hostPid = (room.host || '').toString?.() || room.host;
      if (hostPid && !initialScores[hostPid]) {
        initialScores[hostPid] = {
          score: 0,
          correct: 0,
          finished: false,
          streak: 0,
          name: await resolveUsername(hostPid),
        };
      }

      try {
        await redis.client.set(scoresKey, JSON.stringify(initialScores), 'EX', 3600);
      } catch {}
      memScores.set(room.code, initialScores); // ← in-memory fallback

      const summary = await room.toLobbySummary();
      io.to(room.code).emit('room:update', summary);

      let cached = null;
      try {
        cached = await redis.client.get(questionsKey);
      } catch {}
      io.to(room.code).emit('game:start', cached ?? payloadStr);

      cb?.({ ok: true, room: summary });
    } catch (err) {
      console.error('startGame error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('room:error', err.message);
    }
  });

  socket.on('endGame', async (payload, cb) => {
    try {
      const { roomCode, userId } = payload || {};
      if (!roomCode || !userId) throw new Error('Missing code/userId');

      const room = await Room.findOne({ code: roomCode.toUpperCase() });
      if (!room) throw new Error('Room not found');
      ensureHost(room, userId); // host-only

      room.status = 'ended';
      await room.save();

      // Get scores (prefer Redis; fall back to memory)
      let scores = {};
      try {
        const scoreRaw = await redis.client.get(`room:${roomCode}:scores`);
        scores = scoreRaw ? JSON.parse(scoreRaw) : memScores.get(roomCode) || {};
      } catch {
        scores = memScores.get(roomCode) || {};
      }

      // Build a reliable name map:
      // 1) prefer name already stored on score entry
      const idToName = {};
      for (const uid of Object.keys(scores)) {
        if (scores[uid]?.name) idToName[uid] = scores[uid].name;
      }

      // 2) fall back to room.players snapshot
      if (room?.players?.length) {
        for (const p of room.players) {
          const pid = (p.user || p).toString?.() || p.id || p._id || p;
          if (pid && !idToName[pid]) {
            idToName[pid] = p.username || p.name;
          }
        }
      }

      // 3) backfill missing via DB
      const missingIds = Object.keys(scores).filter(uid => !idToName[uid]);
      if (missingIds.length) {
        try {
          const users = await User.find({ _id: { $in: missingIds } })
            .select('_id username')
            .lean();
          for (const u of users || []) {
            idToName[u._id.toString()] = u.username || 'Player';
          }
        } catch {
          // ignore; anything left will default to 'Player'
        }
      }

      // Assemble leaderboard
      let leaderboard = [];
      for (const uid of Object.keys(scores)) {
        leaderboard.push({
          userId: uid,
          name: idToName[uid] || 'Player',
          score: scores[uid]?.score || 0,
        });
      }
      leaderboard.sort((a, b) => b.score - a.score);

      // Emit once to the whole room
      io.to(roomCode).emit('game:end', { roomCode, leaderboard });

      // Cleanup
      try {
        await redis.client.del(`room:${roomCode}:questions`);
        await redis.client.del(`room:${roomCode}:scores`);
      } catch {}
      memQuestions.delete(roomCode);
      for (const k of memAttempts.keys()) if (k.startsWith(`${roomCode}|`)) memAttempts.delete(k);
      // keep memScores until next game or clear if you prefer:
      memScores.delete(roomCode);

      // Lobby refresh
      const summary = await room.toLobbySummary();
      io.to(roomCode).emit('room:update', summary);

      cb?.({ ok: true, ended: true });
    } catch (err) {
      console.error('endGame error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('game:error', err.message);
    }
  });

  socket.on('game:answer', async (payload, cb) => {
    try {
      const { code, userId, roundIndex, guess, snippetSize, elapsedMs } = payload || {};
      if (!code || !userId || !guess) throw new Error('Missing code/userId/guess');

      const roomCode = code.toUpperCase();

      // Load questions (Redis → memory fallback)
      const questionsRaw = await redis.client.get(`room:${roomCode}:questions`);
      const questions = questionsRaw
        ? JSON.parse(questionsRaw)
        : memQuestions.get(roomCode) || null;
      if (!questions) throw new Error('No questions found for this room');

      const snippetMeta = questions.snippets[roundIndex];
      if (!snippetMeta) throw new Error('Invalid round index');

      const snippet = await Snippet.findById(snippetMeta.snippetId);
      if (!snippet) throw new Error('Snippet not found');

      // Attempts (max 5)
      const MAX_ATTEMPTS = 5;
      const key = (multiplayerRoomHandler.__aKey || ((c, r, u) => `${c}|${r}|${u}`))(
        roomCode,
        roundIndex,
        userId
      );
      const usedSoFar = memAttempts.get(key) ?? 0;
      if (usedSoFar >= MAX_ATTEMPTS) {
        cb?.({ ok: false, error: 'No attempts left', attemptsLeft: 0, forceAdvance: true });
        return;
      }
      const newUsed = usedSoFar + 1;
      memAttempts.set(key, newUsed);
      const attemptsLeft = Math.max(0, MAX_ATTEMPTS - newUsed);

      // Match & SP-mirrored scoring
      const { correct } = titleArtistMatch(guess, snippet.title || '', snippet.artist || '');

      const snippetMs = (Number(snippetSize) || 5) * 1000;
      const timeMs = Math.max(0, Math.round(elapsedMs - snippetMs));

      const base = correct ? 1000 : 0;
      const timeBonus = correct ? Math.max(0, Math.round((snippetMs - timeMs) / 20)) : 0;
      const delta = correct ? base + timeBonus : 0;

      // Scores map (Redis + memory fallback)
      const scoreKey = `room:${roomCode}:scores`;
      const scoreRaw = await redis.client.get(scoreKey);
      const scoreMap = scoreRaw ? JSON.parse(scoreRaw) : memScores.get(roomCode) || {};

      // Ensure entry + name
      let entry = scoreMap[userId] || {
        score: 0,
        correct: 0,
        finished: false,
        streak: 0,
        name: undefined,
      };
      if (!entry.name) {
        // Prefer room snapshot
        let nameFromRoom;
        try {
          const room = await Room.findOne({ code: roomCode }).lean();
          if (room?.players?.length) {
            for (const p of room.players) {
              const pid = (p.user || p).toString?.() || p.id || p._id || p;
              if (pid && String(pid) === String(userId)) {
                nameFromRoom = p.username || p.name;
                break;
              }
            }
          }
        } catch {}
        entry.name = nameFromRoom || (await resolveUsername(userId)) || 'Player';
      }

      // Round conclusion + streak
      const concluded = correct || attemptsLeft === 0;
      let newStreak = entry.streak || 0;
      if (correct) newStreak += 1;
      else if (concluded) newStreak = 0;

      const newScore = (entry.score || 0) + delta;
      const newCorrect = (entry.correct || 0) + (correct ? 1 : 0);

      // Mark finished if this was their last round and the round concluded
      const isLastRoundForPlayer = roundIndex >= questions.snippets.length - 1;
      const finishedNow = concluded && isLastRoundForPlayer;

      scoreMap[userId] = {
        ...entry,
        score: newScore,
        correct: newCorrect,
        streak: newStreak,
        finished: finishedNow ? true : !!entry.finished,
      };

      try {
        await redis.client.set(scoreKey, JSON.stringify(scoreMap), 'EX', 3600);
      } catch {}
      memScores.set(roomCode, scoreMap); // keep memory in sync

      // Live updates (per guess)
      io.to(roomCode).emit('game:scoreUpdate', {
        userId,
        roundIndex,
        correct,
        score: newScore,
        streak: newStreak,
        breakdown: { base, timeBonus, total: delta },
      });
      io.to(roomCode).emit('game:leaderboardUpdate',
        Object.entries(scoreMap).map(([id, player]) => ({
          id,
          score: player.score,
        }))
      );
      // Per-round result (so clients can build song results)
      io.to(roomCode).emit('game:roundResult', {
        userId,
        roundIndex,
        correct,
        timeMs,
        snippetId: snippet.id,
        title: snippet.title || 'Unknown Song',
        artist: snippet.artist || 'Unknown Artist',
      });

      // ---- AUTO END: if everyone in the score map is finished, end the game ----
      if (!memEnded.has(roomCode)) {
        const participants = Object.keys(scoreMap);
        const allFinished =
          participants.length > 0 && participants.every(uid => scoreMap[uid]?.finished === true);

        if (allFinished) {
          memEnded.add(roomCode);

          // Build leaderboard (reuse the same logic as host-end)
          const idToName = {};
          for (const uid of participants) {
            if (scoreMap[uid]?.name) idToName[uid] = scoreMap[uid].name;
          }
          try {
            const room = await Room.findOne({ code: roomCode }).lean();
            if (room?.players?.length) {
              for (const p of room.players) {
                const pid = (p.user || p).toString?.() || p.id || p._id || p;
                if (pid && !idToName[pid]) idToName[pid] = p.username || p.name;
              }
            }
          } catch {}
          const missing = participants.filter(uid => !idToName[uid]);
          if (missing.length) {
            try {
              const users = await User.find({ _id: { $in: missing } })
                .select('_id username')
                .lean();
              for (const u of users || []) idToName[u._id.toString()] = u.username || 'Player';
            } catch {}
          }
          let leaderboard = participants.map(uid => ({
            userId: uid,
            name: idToName[uid] || 'Player',
            score: scoreMap[uid]?.score || 0,
          }));
          leaderboard.sort((a, b) => b.score - a.score);

          io.to(roomCode).emit('game:end', { roomCode, leaderboard });

          // cleanup
          try {
            await redis.client.del(`room:${roomCode}:questions`);
            await redis.client.del(`room:${roomCode}:scores`);
          } catch {}
          clearRoomMem(roomCode);

          // Optional: update lobby summary
          try {
            const room = await Room.findOne({ code: roomCode.toUpperCase() });
            if (room) {
              room.status = 'ended';
              await room.save();
              const summary = await room.toLobbySummary();
              io.to(roomCode).emit('room:update', summary);
            }
          } catch {}
        }
      }

      cb?.({
        ok: true,
        correct,
        concluded,
        breakdown: { base, timeBonus, total: delta },
        score: newScore,
        attemptsLeft,
        forceAdvance: attemptsLeft === 0,
      });
    } catch (err) {
      console.error('game:answer error:', err.message);
      cb?.({ ok: false, error: err.message });
      socket.emit('game:error', err.message);
    }
  });

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
