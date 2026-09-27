const mongoose = require('mongoose');

const AuthSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    trim: true,
    maxlength: 500,
    default: 'Unknown device'
  },
  ipHash: {
    type: String,
    maxlength: 64,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastSeenAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  revokedAt: {
    type: Date,
    default: null,
    index: true
  },
  revokedReason: {
    type: String,
    trim: true,
    maxlength: 120,
    default: null
  }
}, { versionKey: false });

AuthSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AuthSession', AuthSessionSchema);
