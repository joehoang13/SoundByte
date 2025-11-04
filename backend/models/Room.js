const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 4,
      maxlength: 10,
      index: true,
    },

    mode: { type: String, default: 'Classic', trim: true },

    status: {
      type: String,
      enum: ['lobby', 'in-game', 'ended'],
      default: 'lobby',
      index: true,
    },

    // Host and players are just User references now
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    players: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        socketId: { type: String, trim: true },
      },
    ],

    settings: {
      maxPlayers: { type: Number, default: 8, min: 1, max: 32 },
      isPrivate: { type: Boolean, default: false },
      passcode: { type: String, trim: true },
    },

    currentRound: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { collection: 'rooms', timestamps: true }
);

RoomSchema.virtual('playerCount').get(function () {
  return this.players.length;
});

function randomCode(len = 6) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: len },
    () => alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join('');
}

RoomSchema.methods.isFull = function () {
  return this.playerCount >= (this.settings?.maxPlayers ?? 8);
};

RoomSchema.methods.hasPlayer = function (userId) {
  return this.players.some(id => String(id) === String(userId));
};

RoomSchema.methods.addPlayer = function ({ userId, socketId }) {
  if (this.isFull()) throw new Error('Room is full');

  const existingIndex = this.players.findIndex(p => String(p.user) === String(userId));
  if (existingIndex !== -1) {
    // Update socketId if the player rejoined
    this.players[existingIndex].socketId = socketId;
  } else {
    // Add new player
    this.players.push({ user: userId, socketId: socketId });
  }

  return this;
};

RoomSchema.methods.removePlayer = function (userId) {
  const before = this.playerCount;
  this.players = this.players.filter(p => String(p.user) !== String(userId));

  // If the host left and room is still in lobby, promote the first remaining player
  if (this.status === 'lobby' && this.players.length > 0 && String(this.host) === String(userId)) {
    this.host = this.players[0].user;
  }

  return before !== this.playerCount;
};

RoomSchema.methods.toLobbySummary = async function () {
  await this.populate([
    { path: 'host', select: 'username profilePicture' },
    { path: 'players.user', select: 'username profilePicture' },
  ]);

  return {
    code: this.code,
    mode: this.mode,
    status: this.status,
    host: {
      id: this.host._id,
      username: this.host.username,
      profilePicture: this.host.profilePicture,
    },
    playerCount: this.playerCount,
    maxPlayers: this.settings?.maxPlayers ?? 8,
    players: this.players.map(p => ({
      id: p.user._id,
      username: p.user.username,
      profilePicture: p.user.profilePicture,
      socketId: p.socketId,
    })),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

RoomSchema.statics.generateUniqueCode = async function (len = 6, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = randomCode(len);
    const exists = await this.exists({ code });
    if (!exists) return code;
  }
  return this.generateUniqueCode(len + 1, maxAttempts);
};

RoomSchema.statics.createRoom = async function ({
  hostId,
  hostSocketId,
  mode = 'Classic',
  settings = {},
  code,
}) {
  const Room = this;

  const existing = await Room.findOne({
    'players.user': hostId,
    status: { $in: ['lobby', 'in-game'] },
  });

  if (existing) {
    throw new Error('You are already in an active lobby or game.');
  }

  const finalCode = code?.toUpperCase?.() || (await Room.generateUniqueCode(6));
  const room = new Room({
    code: finalCode,
    mode,
    status: 'lobby',
    host: hostId,
    players: [{ user: hostId, socketId: hostSocketId }],
    settings,
  });
  return room.save();
};

RoomSchema.statics.joinByCode = async function ({ code, userId, userSocketId, passcode }) {
  const upper = code.toUpperCase();
  const room = await this.findOne({ code: upper });
  if (!room) throw new Error('Room not found');
  if (room.status !== 'lobby') throw new Error('Game already started');
  if (room.settings?.isPrivate && room.settings.passcode && room.settings.passcode !== passcode) {
    throw new Error('Invalid passcode');
  }

  // Add or update player with their socketId
  room.addPlayer({ userId: userId, socketId: userSocketId });

  await room.save();
  return room;
};

RoomSchema.statics.leaveByCode = async function ({ code, userId }) {
  const upper = code.toUpperCase();

  const room = await this.findOneAndUpdate(
    { code: upper },
    { $pull: { players: { user: userId } } },
    { new: true }
  );

  if (!room) return null; // Room was deleted or never existed

  // If the host left and there are still players, promote the first remaining
  if (room.status === 'lobby' && String(room.host) === String(userId)) {
    if (room.players.length > 0) {
      room.host = room.players[0].user;
      await room.save();
    }
  }

  // If no players left, delete the room
  if (room.players.length === 0) {
    await this.deleteOne({ _id: room._id });
    return null;
  }

  return room;
};

module.exports = mongoose.model('Room', RoomSchema);
