// server/routes/admin.js
// Admin routes — storage stats, activity logs (owner only)

const express = require('express');
const router = express.Router();
const File = require('../models/File');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');

// ─── Get Storage Stats ───────────────────────────────────────
// GET /api/admin/storage
// Owner only — returns total and per-user storage usage
router.get('/admin/storage', authenticate, authorize('owner'), async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Get all files in owner's system
    const files = await File.find({ ownerId }).populate('uploadedBy', 'uid');

    // Calculate total storage
    const totalStorage = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
    const totalFiles = files.length;

    // Calculate per-user storage
    const userStorageMap = {};
    files.forEach((file) => {
      const uploaderUid = file.uploadedBy?.uid || 'Unknown';
      const uploaderId = file.uploadedBy?._id?.toString() || 'unknown';

      if (!userStorageMap[uploaderId]) {
        userStorageMap[uploaderId] = {
          uid: uploaderUid,
          totalSize: 0,
          fileCount: 0,
        };
      }

      userStorageMap[uploaderId].totalSize += file.fileSize || 0;
      userStorageMap[uploaderId].fileCount += 1;
    });

    const perUserStorage = Object.values(userStorageMap).sort(
      (a, b) => b.totalSize - a.totalSize
    );

    res.json({
      totalStorage,
      totalFiles,
      perUserStorage,
    });
  } catch (error) {
    console.error('Storage stats error:', error);
    res.status(500).json({ error: 'Failed to fetch storage stats.' });
  }
});

// ─── Get Activity Logs ───────────────────────────────────────
// GET /api/logs
// Owner only — returns activity logs for the owner's system
router.get('/logs', authenticate, authorize('owner'), async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Get all users who have joined this owner's system
    const systemUsers = await User.find({ 'memberships.ownerId': ownerId }).select('_id');
    const userIds = systemUsers.map((u) => u._id);
    userIds.push(ownerId); // Include owner's logs too

    // Get logs for these users, most recent first
    const logs = await ActivityLog.find({ userId: { $in: userIds } })
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({ logs });
  } catch (error) {
    console.error('Activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
});

module.exports = router;
