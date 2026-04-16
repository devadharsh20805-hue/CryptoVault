// server/models/User.js
// User schema — supports owner, editor, reader, and pending roles

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: [true, 'UID is required'],
    unique: true,
    trim: true,
    minlength: [3, 'UID must be at least 3 characters'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
  },
  role: {
    type: String,
    enum: ['owner', 'user'],
    default: 'user',
  },
  systemCode: {
    type: String,
    index: true,
  },
  memberships: [
    {
      ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      status: {
        type: String,
        enum: ['pending', 'active', 'rejected'],
        default: 'pending',
      },
      permissionLevel: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low',
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
