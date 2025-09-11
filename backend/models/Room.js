const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema(
  {
    userId:  { type: String, required: true, trim: true },
    username:{ type: String, required: true, trim: true },
    socketId:{ type: String, trim: true },            // optional (useful for presence)
    isHost:  { type: Boolean, default: false },
    joinedAt:{ type: Date, default: Date.now },
  },
  { _id: false }
);

const RoomSchema = new mongoose.Schema(
  {
    // Human-shareable code, e.g. "7K4QXZ"
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

    // Game mode (free string so you can add new modes without migrations)
    mode: { type: String, default: 'Classic', trim: true },

    // Lifecycle used by UI/logic
    status: {
      type: String,
      enum: ['lobby', 'in-game', 'ended'],
      default: 'lobby',
      index: true,
    },

    // Redundant host reference for quick reads
    host: {
      userId:   { type: String, required: true, trim: true },
      username: { type: String, required: true, trim: true },
    },

    // Current players
    players: { type: [PlayerSchema], default: [] },

    // Room options
    settings: {
      maxPlayers: { type: Number, default: 8, min: 1, max: 32 },
      isPrivate:  { type: Boolean, default: false },
      passcode:   { type: String, trim: true }, 
    },

    currentRound: { type: Number, default: 0 },
    metadata:     { type: mongoose.Schema.Types.Mixed },
  },
  { collection: 'rooms', timestamps: true }
);


RoomSchema.index({ code: 1 }, { unique: true });
RoomSchema.index({ status: 1, updatedAt: -1 });

RoomSchema.virtual('playerCount').get(function () {
  return (this.players || []).length;
});


function randomCode(len = 6) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; 
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[(Math.random() * alphabet.length) | 0];
  return out;
}

RoomSchema.methods.isFull = function () {
  return this.playerCount >= (this.settings?.maxPlayers ?? 8);
};

RoomSchema.methods.hasPlayer = function (userId) {
  return this.players.some((p) => p.userId === userId);
};

RoomSchema.methods.addPlayer = function ({ userId, username, socketId }) {
  if (this.isFull()) throw new Error('Room is full');

  // Rejoin path: update existing player’s socket/username
  const idx = this.players.findIndex((p) => p.userId === userId);
  if (idx !== -1) {
    const existing = this.players[idx];
    this.players[idx] = {
      ...existing.toObject?.() ?? existing,
      username,
      socketId,
    };
    return this;
  }

  this.players.push({ userId, username, socketId, isHost: false, joinedAt: new Date() });
  return this;
};

RoomSchema.methods.removePlayer = function (userId) {
  const before = this.playerCount;
  this.players = this.players.filter((p) => p.userId !== userId);

  // If host left (and still in lobby), promote first remaining player
  if (this.status === 'lobby' && this.players.length > 0 && this.host.userId === userId) {
    this.players[0].isHost = true;
    this.host = { userId: this.players[0].userId, username: this.players[0].username };
  }
  return before !== this.playerCount;
};

RoomSchema.methods.toLobbySummary = function () {
  return {
    code: this.code,
    mode: this.mode,
    status: this.status,
    host: this.host,
    playerCount: this.playerCount,
    maxPlayers: this.settings?.maxPlayers ?? 8,
    players: this.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      isHost: !!p.isHost,
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
  // Rare collisions → increase code length
  return this.generateUniqueCode(len + 1, maxAttempts);
};

// Create a room and seed host as first player
RoomSchema.statics.createRoom = async function ({
  hostUserId,
  hostUsername,
  mode = 'Classic',
  settings = {},
  code,
}) {
  const Room = this;
  const finalCode = code?.toUpperCase?.() || (await Room.generateUniqueCode(6));
  const room = new Room({
    code: finalCode,
    mode,
    status: 'lobby',
    host: { userId: hostUserId, username: hostUsername },
    players: [{ userId: hostUserId, username: hostUsername, isHost: true }],
    settings,
  });
  return room.save();
};

// Join room by code
RoomSchema.statics.joinByCode = async function ({ code, userId, username, socketId, passcode }) {
  const upper = code.toUpperCase();
  const room = await this.findOne({ code: upper });
  if (!room) throw new Error('Room not found');
  if (room.status !== 'lobby') throw new Error('Game already started');
  if (room.settings?.isPrivate && room.settings?.passcode && room.settings.passcode !== passcode) {
    throw new Error('Invalid passcode');
  }
  room.addPlayer({ userId, username, socketId });
  await room.save();
  return room;
};

// Leave room; delete if empty after leaving
RoomSchema.statics.leaveByCode = async function ({ code, userId }) {
  const upper = code.toUpperCase();
  const room = await this.findOne({ code: upper });
  if (!room) return null;

  const changed = room.removePlayer(userId);
  if (!changed) return room;

  if (room.players.length === 0) {
    await this.deleteOne({ _id: room._id });
    return null;
  }

  await room.save();
  return room;
};

module.exports = mongoose.models.Room || mongoose.model('Room', RoomSchema);
