const { Server } = require('socket.io');

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

    socket.on('chatMessage', msg => {
      console.log('💬 Message from client:', msg);
      io.emit('chatMessage', msg); // broadcast to all
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io; // optional if you want to use io elsewhere
}

module.exports = setupSocket;
