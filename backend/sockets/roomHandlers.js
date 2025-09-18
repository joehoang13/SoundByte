const Room = require('../models/Room');

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
        socketState.set(socket.id, { code: room.code, hostId });

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
        const { code, hostId } = payload || {};
        if (!code || !hostId) throw new Error('Missing code/hostId');

        const room = await Room.findOne({ code: code.toUpperCase() });
        if (!room) throw new Error('Room not found');
        ensureHost(room, hostId);

        if (room.status !== 'lobby') throw new Error('Game already started or ended');
        room.status = 'in-game';
        room.currentRound = 1;
        await room.save();

        const summary = await room.toLobbySummary();
        io.to(room.code).emit('room:update', summary);
        io.to(room.code).emit('game:start');
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
        const { code, userId } = payload || {};
        if (!code || !userId) throw new Error('Missing code/userId');

        const room = await Room.findOne({ code: code.toUpperCase() });
        if (!room) throw new Error('Room not found');
        ensureHost(room, userId);

        if (room.status === 'ended') throw new Error('Game already ended');
        room.status = 'ended';
        await room.save();

        const summary = await room.toLobbySummary();
        io.to(room.code).emit('room:update', summary);
        cb?.({ ok: true, room: summary });
      } catch (err) {
        console.error('endGame error:', err.message);
        cb?.({ ok: false, error: err.message });
        socket.emit('room:error', err.message);
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
    

module.exports = { multiplayerRoomHandler }