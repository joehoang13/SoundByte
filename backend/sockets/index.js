// backend/sockets/index.js
const { Server } = require('socket.io');
const socketState = new Map();
const { multiplayerRoomHandler } = require('./roomHandlers');
const Room = require('../models/Room');

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', socket => {
    console.log('Socket connected:', socket.id);

    socket.emit('welcome', { message: 'Hello from server!' });

    multiplayerRoomHandler(io, socket, socketState);

    // Single disconnect handler with in-game grace (don't remove players mid-game)
    socket.on('disconnect', async () => {
      try {
        const tracked = socketState.get(socket.id);
        if (!tracked) {
          console.log(`Socket disconnected (untracked): ${socket.id}`);
          return;
        }

        const { code, userId } = tracked;
        const upper = (code || '').toUpperCase();
        socketState.delete(socket.id);

        const room = await Room.findOne({ code: upper });
        if (!room) {
          console.log(`Socket disconnected: ${socket.id} (room not found)`);
          return;
        }

        // If the game is ongoing, keep the player enrolled; just clear socketId
        if (room.status === 'in-game') {
          const idx = room.players.findIndex(p => String(p.user) === String(userId));
          if (idx !== -1) {
            room.players[idx].socketId = undefined;
            await room.save();
            io.to(upper).emit('room:update', await room.toLobbySummary());
          }
        } else {
          // Lobby/ended → remove normally
          const updated = await Room.leaveByCode({ code: upper, userId });
          if (updated) {
            io.to(upper).emit('room:update', await updated.toLobbySummary());
          } else {
            io.to(upper).emit('room:deleted');
          }
        }
      } catch (err) {
        console.error('disconnect cleanup error:', err.message);
      } finally {
        console.log(`Socket disconnected: ${socket.id}`);
      }
    });
  });

  return io;
}

module.exports = setupSocket;
