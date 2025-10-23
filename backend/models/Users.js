// backend/models/Users.js
'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String },
  passwordHash: { type: String },

  // NEW FIELDS FOR VERIFICATION
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationTokenExpires: { type: Date },

  authProvider: { type: String, default: 'firebase' },
  profilePicture: { type: String },
  createdAt: { type: Date, default: Date.now },
  highestScore: { type: Number, default: 0 },
  totalSnippetsGuessed: { type: Number, default: 0 },
  totalGamesPlayed: { type: Number, default: 0 },
  resetToken: { type: String, default: '' },
  needsReset: { type: Boolean, default: false },

  emailLower: { type: String, index: true, unique: true, sparse: true },
  usernameLower: { type: String, index: true, unique: true, sparse: true },
});

UserSchema.pre('save', function handleLowercase(next) {
  if (this.isModified('email') || this.isNew) {
    this.emailLower = (this.email || '').trim().toLowerCase();
  }
  if (this.isModified('username') || this.isNew) {
    this.usernameLower = (this.username || '').trim().toLowerCase();
  }
  next();
});

UserSchema.methods.comparePassword = async function comparePassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(String(plain), this.passwordHash);
};

UserSchema.statics.findByIdentifier = function findByIdentifier(identifier) {
  const id = String(identifier || '').trim().toLowerCase();
  if (!id) return null;
  return this.findOne({ $or: [{ emailLower: id }, { usernameLower: id }] });
};

module.exports = mongoose.model('User', UserSchema);
