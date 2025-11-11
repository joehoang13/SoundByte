// ======================================================================
// backend/sockets/roomHandlers.js  (FULL FILE - with resume + results)
// ======================================================================
const Room = require('../models/Room');
const User = require('../models/Users');
const { generateGameQuestions } = require('../utils/gameUtils');
const redis = require('../utils/redisClient');
const { titleArtistMatch } = require('../utils/scoringUtils');
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
  // NEW: per-user round results (why: rebuild Song Results after refresh)
  const memRoundResults = (multiplayerRoomHandler.__r ||= new Map()); // code -> { [userId]: { [roundIndex]: RoundResult } }

  const attemptKey = (code, roundIndex, userId) => `${code}|${roundIndex}|${userId}`;
  const resultsKey = (code, userId) => `room:${code}:results:${userId}`;

  async function loadScores(roomCode) {
    if (redis.enabled) {
      try {
        const raw = await redis.get(`room:${roomCode}:scores`);
        if (raw) return JSON.parse(raw);
      } catch { }
    }
    return memScores.get(roomCode) || {};
  }

  async function saveScores(roomCode, map) {
    memScores.set(roomCode, map);
    if (redis.enabled) {
      try {
        await redis.set(`room:${roomCode}:scores`, JSON.stringify(map), 'EX', 3600);
      } catch { }
    }
  }

  async function loadQuestions(roomCode) {
    try {
      const questionsRaw = await redis.get(`room:${roomCode}:questions`);
      if (questionsRaw) return JSON.parse(questionsRaw);
    } catch { }
    return memQuestions.get(roomCode) || null;
  }

  function getCtxFromSocket(payload = {}) {
    const tracked = socketState.get(socket.id) || {};
    const code =
      (payload.code || payload.roomCode || tracked.code || '').toUpperCase();
    const userId = payload.userId || tracked.userId;
    return { code, userId };
  }

  // --- Round results persistence (rehydration after refresh) ---
  async function loadUserResults(roomCode, userId) {
    // Redis → mem fallback
    if (redis.enabled) {
      try {
        const raw = await redis.get(resultsKey(roomCode, userId));
        if (raw) return JSON.parse(raw);
      } catch { }
    }
    const roomMap = memRoundResults.get(roomCode) || {};
    return roomMap[userId] || {};
  }

  async function saveUserResult(roomCode, userId, roundIndex, value) {
    // Update mem
    const roomMap = memRoundResults.get(roomCode) || {};
    const userMap = roomMap[userId] || {};
    userMap[roundIndex] = value;
    roomMap[userId] = userMap;
    memRoundResults.set(roomCode, roomMap);
    // Also store in Redis for durability (optional)
    if (redis.enabled) {
      try {
        await redis.set(resultsKey(roomCode, userId), JSON.stringify(userMap), 'EX', 3600);
      } catch { }
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
    memRoundResults.delete(code);
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

  socket.on('debug:whoami', (payload, cb) => {
    const tracked = socketState.get(socket.id) || null;
    cb?.({ socketId: socket.id, tracked, rooms: [...socket.rooms] });
  });

  socket.on('debug:roomMembers', async (payload, cb) => {
    const code = (payload?.code || '').toUpperCase();
    if (!code) return cb?.({ ok: false, error: 'Missing code' });
    const ids = await io.in(code).allSockets();
    cb?.({ ok: true, code, members: Array.from(ids) });
  });

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
      memRoundResults.set(room.code, {}); // start fresh results map

      const gameData = await generateGameQuestions(10);
      const questionsKey = `room:${room.code}:questions`;
      const scoresKey = `room:${room.code}:scores`;
      const payloadStr = JSON.stringify(gameData);

      try {
        await redis.set(questionsKey, payloadStr, 'EX', 3600);
      } catch { }
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
        await redis.set(scoresKey, JSON.stringify(initialScores), 'EX', 3600);
      } catch { }
      memScores.set(room.code, initialScores);

      const summary = await room.toLobbySummary();
      io.to(room.code).emit('room:update', summary);

      let cached = null;
      try {
        cached = await redis.get(questionsKey);
      } catch { }
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
      const { code: roomCode, userId } = getCtxFromSocket(payload);
      if (!roomCode || !userId) throw new Error('Missing code/userId');

      const room = await Room.findOne({ code: roomCode });
      if (!room) throw new Error('Room not found');
      ensureHost(room, userId);

      room.status = 'ended';
      await room.save();

      let scores = await loadScores(roomCode);
      const idToName = {};
      for (const uid of Object.keys(scores)) {
        if (scores[uid]?.name) idToName[uid] = scores[uid].name;
      }
      if (room?.players?.length) {
        for (const p of room.players) {
          const pid = (p.user || p).toString?.() || p.id || p._id || p;
          if (pid && !idToName[pid]) idToName[pid] = p.username || p.name;
        }
      }

      let leaderboard = Object.keys(scores).map(uid => ({
        userId: uid,
        name: idToName[uid] || 'Player',
        score: scores[uid]?.score || 0,
      }));
      leaderboard.sort((a, b) => b.score - a.score);

      io.to(roomCode).emit('game:end', { roomCode, leaderboard });

      try {
        await redis.del(`room:${roomCode}:questions`);
        await redis.del(`room:${roomCode}:scores`);
      } catch { }
      clearRoomMem(roomCode);

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
      const { code: roomCode, userId } = getCtxFromSocket(payload);
      const { roundIndex: ri, guess, snippetSize, elapsedMs } = payload || {};
      if (!roomCode || !userId || !guess) throw new Error('Missing code/userId/guess');

      const questions = await loadQuestions(roomCode);
      if (!questions) throw new Error('No questions found for this room');

      // If roundIndex wasn't sent or is out of range, derive it from results
      let roundIndex = Number.isFinite(ri) ? Number(ri) : 0;
      if (!Number.isFinite(roundIndex) || roundIndex < 0 || roundIndex >= questions.snippets.length) {
        const myResults = await loadUserResults(roomCode, userId);
        const finished = Object.keys(myResults).map(n => +n).filter(n => !Number.isNaN(n));
        roundIndex = finished.length
          ? Math.min(Math.max(...finished) + 1, questions.snippets.length - 1)
          : 0;
      }

      const snippetMeta = questions.snippets[roundIndex];
      if (!snippetMeta) throw new Error('Invalid round index');

      const snippet = await Snippet.findById(snippetMeta.snippetId);
      if (!snippet) throw new Error('Snippet not found');

      const MAX_ATTEMPTS = 5;
      const key = attemptKey(roomCode, roundIndex, userId);
      const usedSoFar = memAttempts.get(key) ?? 0;
      if (usedSoFar >= MAX_ATTEMPTS) {
        cb?.({ ok: false, error: 'No attempts left', attemptsLeft: 0, forceAdvance: true });
        return;
      }
      const newUsed = usedSoFar + 1;
      memAttempts.set(key, newUsed);
      const attemptsLeft = Math.max(0, MAX_ATTEMPTS - newUsed);

      const { correct } = titleArtistMatch(guess, snippet.title || '', snippet.artist || '');
      const snippetMs = (Number(snippetSize) || 5) * 1000;
      const timeMs = Math.max(0, Math.round((elapsedMs ?? 0) - snippetMs));

      const base = correct ? 1000 : 0;
      const timeBonus = correct ? Math.max(0, Math.round((snippetMs - timeMs) / 20)) : 0;
      const delta = correct ? base + timeBonus : 0;

      let scoreMap = await loadScores(roomCode);
      let entry = scoreMap[userId] || {
        score: 0, correct: 0, finished: false, streak: 0, name: undefined,
      };
      if (!entry.name) entry.name = await resolveUsername(userId);

      const concluded = correct || attemptsLeft === 0;
      const newStreak = correct ? (entry.streak || 0) + 1 : (concluded ? 0 : (entry.streak || 0));
      const newScore = (entry.score || 0) + delta;
      const newCorrect = (entry.correct || 0) + (correct ? 1 : 0);
      const isLast = roundIndex >= questions.snippets.length - 1;
      const finishedNow = concluded && isLast;

      scoreMap[userId] = { ...entry, score: newScore, correct: newCorrect, streak: newStreak, finished: finishedNow ? true : !!entry.finished };
      await saveScores(roomCode, scoreMap);

      io.to(roomCode).emit('game:scoreUpdate', {
        userId, roundIndex, correct, score: newScore, streak: newStreak,
        breakdown: { base, timeBonus, total: delta },
      });

      const roundResult = {
        userId, roundIndex, correct, timeMs,
        snippetId: snippet.id, title: snippet.title || 'Unknown Song', artist: snippet.artist || 'Unknown Artist',
      };
      io.to(roomCode).emit('game:roundResult', roundResult);

      if (concluded) {
        await saveUserResult(roomCode, userId, roundIndex, {
          snippetId: snippet.id, title: snippet.title || 'Unknown Song', artist: snippet.artist || 'Unknown Artist', correct, timeMs,
        });
      }

      // [auto-end unchanged]

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


  // --- NEW: resume API used after refresh to rebuild client state ---
  socket.on('game:resume', async (payload, cb) => {
    try {
      const { code, userId } = payload || {};
      if (!code || !userId) throw new Error('Missing code/userId');

      const roomCode = code.toUpperCase();

      // Re-join so this socket receives subsequent broadcasts
      socket.join(roomCode);
      socketState.set(socket.id, { code: roomCode, userId });

      // NEW: refresh this player's socketId in the Room doc (so UI/diagnostics stay accurate)
      try {
        const roomDoc = await Room.findOne({ code: roomCode });
        if (roomDoc) {
          const idx = roomDoc.players.findIndex(p => String(p.user) === String(userId));
          if (idx !== -1) {
            roomDoc.players[idx].socketId = socket.id;
            await roomDoc.save();
            // optional: let lobby/GameScreen widgets reflect the fresh socketId
            const summary = await roomDoc.toLobbySummary();
            io.to(roomCode).emit('room:update', summary);
          }
        }
      } catch (e) {
        console.warn('resume: failed to rebind socketId:', e?.message || e);
      }

      const [questions, scores] = await Promise.all([
        loadQuestions(roomCode),
        loadScores(roomCode),
      ]);
      if (!questions) throw new Error('No questions for this room');

      const myResults = await loadUserResults(roomCode, userId);

      const finishedIndices = Object.keys(myResults)
        .map(n => Number(n))
        .filter(n => !Number.isNaN(n));
      let nextRoundIndex = 0;
      if (finishedIndices.length) {
        nextRoundIndex = Math.min(
          Math.max(...finishedIndices) + 1,
          questions.snippets.length - 1
        );
      }

      const roomDocLite = await Room.findOne({ code: roomCode }).lean().catch(() => null);
      const hostId = roomDocLite?.host?.toString?.() || String(roomDocLite?.host || '');

      const MAX_ATTEMPTS = 5;
      const usedSoFar = memAttempts.get(attemptKey(roomCode, nextRoundIndex, userId)) ?? 0;
      const attemptsLeft = Math.max(0, MAX_ATTEMPTS - usedSoFar);

      let status = memEnded.has(roomCode) ? 'ended' : 'in-game';
      try {
        const room = await Room.findOne({ code: roomCode }).lean();
        if (room?.status === 'ended') status = 'ended';
      } catch { }

      cb?.({
        ok: true,
        snapshot: {
          questions,
          scores,
          me: scores[userId] || { score: 0, streak: 0 },
          attemptsLeft,
          results: Object.entries(myResults).map(([idx, r]) => ({
            roundIndex: Number(idx),
            ...r,
          })),
          status,
          nextRoundIndex,
          hostId,
        },
      });
    } catch (err) {
      console.error('game:resume error:', err.message);
      cb?.({ ok: false, error: err.message });
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