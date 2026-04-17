// server/routes/users.js
// User management routes — approve, reject, list users (owner only)

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');

// ─── Get All Users in Owner's System ─────────────────────────
// GET /api/admin/users
// Owner only — returns all users linked to this owner
router.get('/admin/users', authenticate, authorize('owner'), async (req, res) => {
  try {
    const users = await User.find({
      'memberships.ownerId': req.user.id
    })
      .select('-password')
      .sort({ createdAt: -1 });

    // Map the users to include their specific membership details for this owner
    const mappedUsers = users.map(user => {
      const membership = user.memberships.find(m => m.ownerId.toString() === req.user.id);
      return {
        _id: user._id,
        uid: user.uid,
        status: membership.status,
        permissionLevel: membership.permissionLevel,
        role: membership.role,
        createdAt: user.createdAt,
        joinedAt: membership.joinedAt
      };
    });

    res.json({ users: mappedUsers });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// ─── Get Pending Users ───────────────────────────────────────
// GET /api/admin/pending
// Owner only — returns users waiting for approval
router.get('/admin/pending', authenticate, authorize('owner'), async (req, res) => {
  try {
    const pendingUsers = await User.find({
      memberships: {
        $elemMatch: { ownerId: req.user.id, status: 'pending' }
      }
    })
      .select('-password')
      .sort({ createdAt: -1 });

    // Map to include membership
    const mappedUsers = pendingUsers.map(user => {
      const membership = user.memberships.find(m => m.ownerId.toString() === req.user.id);
      return {
        _id: user._id,
        uid: user.uid,
        status: membership.status,
        createdAt: user.createdAt
      };
    });

    res.json({ users: mappedUsers });
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ error: 'Failed to fetch pending users.' });
  }
});

// ─── Approve User ────────────────────────────────────────────
// POST /api/approve-user
// Owner only — approves a pending user and assigns permissionLevel
router.post('/approve-user', authenticate, authorize('owner'), async (req, res) => {
  try {
    const { userId, permissionLevel, role = 'reader' } = req.body;

    // Validate permissionLevel
    if (!['low', 'medium', 'high'].includes(permissionLevel)) {
      return res.status(400).json({ error: 'Permission level must be low, medium, or high.' });
    }

    if (!['reader', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be reader or editor.' });
    }

    // Find the pending user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Find membership
    const membership = user.memberships.find(m => m.ownerId.toString() === req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'User has not requested to join your system.' });
    }

    if (membership.status !== 'pending') {
      return res.status(400).json({ error: 'User is not in pending status.' });
    }

    // Approve user
    membership.status = 'active';
    membership.permissionLevel = permissionLevel;
    membership.role = role;
    await user.save();

    res.json({
      message: `User "${user.uid}" approved with ${permissionLevel} permission and ${role} role.`,
      user: {
        id: user._id,
        uid: user.uid,
        permissionLevel: membership.permissionLevel,
        role: membership.role,
        status: membership.status,
      },
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ error: 'Failed to approve user.' });
  }
});

// ─── Reject User ─────────────────────────────────────────────
// POST /api/reject-user
// Owner only — rejects a pending user
router.post('/reject-user', authenticate, authorize('owner'), async (req, res) => {
  try {
    const { userId } = req.body;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Find membership
    const membership = user.memberships.find(m => m.ownerId.toString() === req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'User has not requested to join your system.' });
    }

    // Reject user
    membership.status = 'rejected';
    await user.save();

    res.json({
      message: `User "${user.uid}" has been rejected.`,
    });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ error: 'Failed to reject user.' });
  }
});

// ─── Update User Permission Level ────────────────────────────
// PUT /api/admin/users/:userId/permission
// Owner only — change an active user's permissionLevel
router.put('/admin/users/:userId/permission', authenticate, authorize('owner'), async (req, res) => {
  try {
    const { permissionLevel, role } = req.body;
    const { userId } = req.params;

    if (permissionLevel && !['low', 'medium', 'high'].includes(permissionLevel)) {
      return res.status(400).json({ error: 'Permission level must be low, medium, or high.' });
    }

    if (role && !['reader', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be reader or editor.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const membership = user.memberships.find(m => m.ownerId.toString() === req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'User is not in your system.' });
    }

    if (permissionLevel) membership.permissionLevel = permissionLevel;
    if (role) membership.role = role;
    await user.save();

    res.json({
      message: `User "${user.uid}" updated.`,
      user: {
        id: user._id,
        uid: user.uid,
        permissionLevel: membership.permissionLevel,
        role: membership.role,
      },
    });
  } catch (error) {
    console.error('Update permission error:', error);
    res.status(500).json({ error: 'Failed to update user permission.' });
  }
});

// ─── Request to Join Owner ───────────────────────────────────
// POST /api/join-owner
// Logged in user submits an owner's systemCode
router.post('/join-owner', authenticate, async (req, res) => {
  try {
    const { systemCode } = req.body;

    if (!systemCode) {
      return res.status(400).json({ error: 'System code is required.' });
    }

    const owner = await User.findOne({ systemCode, role: 'owner' });
    if (!owner) {
      return res.status(404).json({ error: 'Invalid system code. No owner found.' });
    }

    const user = await User.findById(req.user.id);
    
    // Check if already requested or joined
    const existingMembership = user.memberships.find(m => m.ownerId.toString() === owner._id.toString());
    if (existingMembership) {
      return res.status(400).json({ error: `You have already joined or requested to join this system. Status: ${existingMembership.status}` });
    }

    user.memberships.push({
      ownerId: owner._id,
      status: 'pending',
      permissionLevel: 'low'
    });

    await user.save();

    res.status(201).json({
      message: 'Join request submitted. Waiting for owner approval.',
      memberships: user.memberships
    });
  } catch (error) {
    console.error('Join owner error:', error);
    res.status(500).json({ error: 'Failed to join system.' });
  }
});

module.exports = router;
