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

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });

    multiplayerRoomHandler(io, socket, socketState);

    // Cleanup on disconnect
    socket.on('disconnect', async () => {
      try {
        const tracked = socketState.get(socket.id);
        if (!tracked) return;
        const { code, userId } = tracked;

        const room = await Room.leaveByCode({ code, userId });
        socketState.delete(socket.id);

        if (room) {
          io.to(code).emit('room:update', await room.toLobbySummary());
        } else {
          io.to(code).emit('room:deleted');
        }
      } catch (err) {
        console.error('disconnect cleanup error:', err.message);
      } finally {
        console.log(`Socket disconnected: ${socket.id}`);
      }
    });
  });

  return io; // optional if you want to use io elsewhere
}

module.exports = setupSocket;
