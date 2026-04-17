// server/middleware/filePermission.js
// File-level permission checks — verifies user can read/edit a specific file

const File = require('../models/File');

/**
 * Creates middleware to check file-level permissions
 * @param {'read'|'edit'} permissionType - The type of permission to check
 * @returns {Function} Express middleware
 */
const levelValues = { low: 1, medium: 2, high: 3 };

const checkFilePermission = (permissionType) => {
  return async (req, res, next) => {
    try {
      const fileId = req.params.id;
      const userId = req.user.id.toString();

      const file = await File.findById(fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      // Owner of the system always has full access to their files
      const fileOwnerId = file.ownerId.toString();
      if (req.user.role === 'owner' && userId === fileOwnerId) {
        req.file = file;
        return next();
      }

      // Fetch user to check memberships
      const User = require('../models/User'); // Import here to avoid circular dep if any
      const user = await User.findById(userId);
      const membership = user?.memberships.find(
        m => m.ownerId.toString() === fileOwnerId && m.status === 'active'
      );

      if (membership) {
        const userLevelVal = levelValues[membership.permissionLevel] || 1;
        const fileSecVal = levelValues[file.securityLevel] || 2; // Default to medium

        // If trying to edit/delete, must be an editor
        if (permissionType !== 'read') {
          if (membership.role !== 'editor') {
            return res.status(403).json({ error: 'Only owners or editors can modify files.' });
          }
        }

        if (userLevelVal >= fileSecVal) {
          req.file = file;
          return next();
        } else {
          return res.status(403).json({ error: `You need ${file.securityLevel} permission to access this file.` });
        }
      }

      return res.status(403).json({
        error: 'You do not have permission to access this file.',
      });
    } catch (error) {
      return res.status(500).json({ error: 'Permission check failed.' });
    }
  };
};

module.exports = checkFilePermission;
