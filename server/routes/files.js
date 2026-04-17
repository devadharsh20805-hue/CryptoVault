// server/routes/files.js
// File handling routes — upload, list, download, delete, modify, permissions

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { cloudinary } = require('../config/cloudinary');
const File = require('../models/File');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const checkFilePermission = require('../middleware/filePermission');
const { encryptBuffer, decryptBuffer } = require('../utils/encryption');

// Multer config — store in memory for encryption before upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Validate file types: PDF, JPG, DOCX, PPT
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-powerpoint',
    ];

    const allowedExtensions = /\.(pdf|jpg|jpeg|png|docx|doc|pptx|ppt)$/i;

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported. Allowed: PDF, JPG, PNG, DOCX, PPT'), false);
    }
  },
});

// ─── Upload File ──────────────────────────────────────────────
// POST /api/upload
// Owner only — encrypts file and uploads to Cloudinary
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided.' });
      }

      const { securityLevel = 'medium', ownerId: reqOwnerId } = req.body;

      // Determine the owner ID
      let ownerId;
      if (req.user.role === 'owner') {
        ownerId = req.user.id;
      } else {
        if (!reqOwnerId) {
          return res.status(400).json({ error: 'ownerId is required for user uploads.' });
        }
        
        const userDoc = await User.findById(req.user.id);
        const membership = userDoc.memberships.find(
          m => m.ownerId.toString() === reqOwnerId && m.status === 'active'
        );
        
        if (!membership || membership.role !== 'editor') {
          return res.status(403).json({ error: 'You do not have editor access.' });
        }

        const levelValues = { low: 1, medium: 2, high: 3 };
        const userLevel = levelValues[membership.permissionLevel] || 1;
        const reqLevel = levelValues[securityLevel] || 2;
        if (reqLevel > userLevel) {
          return res.status(403).json({ error: 'Cannot upload a file with security level higher than your permission.' });
        }
        
        ownerId = reqOwnerId;
      }

      // Encrypt the file buffer
      const { encryptedBuffer, iv } = encryptBuffer(req.file.buffer);

      // Upload encrypted buffer to Cloudinary as raw resource
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: `cryptovault/${ownerId}`,
            public_id: `${Date.now()}_${req.file.originalname}`,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(encryptedBuffer);
      });

      // Determine file extension
      const ext = req.file.originalname.split('.').pop().toLowerCase();

      // Create file record in DB
      const fileDoc = new File({
        ownerId,
        uploadedBy: req.user.id,
        fileUrl: uploadResult.secure_url,
        cloudinaryPublicId: uploadResult.public_id,
        originalName: req.file.originalname,
        fileType: ext,
        fileSize: req.file.size,
        securityLevel,
        iv,
      });

      await fileDoc.save();

      // Log activity
      await ActivityLog.create({
        userId: req.user.id,
        userName: req.user.uid,
        action: 'upload',
        fileId: fileDoc._id,
        fileName: req.file.originalname,
      });

      res.status(201).json({
        message: 'File uploaded and encrypted successfully.',
        file: {
          id: fileDoc._id,
          originalName: fileDoc.originalName,
          fileType: fileDoc.fileType,
          fileSize: fileDoc.fileSize,
          securityLevel: fileDoc.securityLevel,
          uploadedAt: fileDoc.uploadedAt,
        },
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message || 'File upload failed.' });
    }
  }
);

// ─── List Files ───────────────────────────────────────────────
// GET /api/files
// Returns files accessible to the current user
router.get('/files', authenticate, async (req, res) => {
  try {
    let files = [];
    const levelValues = { low: 1, medium: 2, high: 3 };

    if (req.user.role === 'owner') {
      // Owner sees all files in their system
      files = await File.find({ ownerId: req.user.id })
        .populate('uploadedBy', 'uid')
        .sort({ uploadedAt: -1 });
    } else {
      // User fetches based on active memberships and permission levels
      const userDoc = await User.findById(req.user.id);
      const queryOptions = [];

      userDoc.memberships.forEach(m => {
        if (m.status === 'active') {
          const pLevel = levelValues[m.permissionLevel] || 1;
          const allowedSecurityLevels = ['low'];
          if (pLevel >= 2) allowedSecurityLevels.push('medium');
          if (pLevel >= 3) allowedSecurityLevels.push('high');

          queryOptions.push({
            ownerId: m.ownerId,
            securityLevel: { $in: allowedSecurityLevels }
          });
        }
      });

      if (queryOptions.length > 0) {
        files = await File.find({ $or: queryOptions })
          .populate('uploadedBy', 'uid')
          .sort({ uploadedAt: -1 });
      }
    }

    let userDoc = null;
    if (req.user.role === 'user') {
      userDoc = await User.findById(req.user.id);
    }

    // Strip sensitive fields from response
    const sanitizedFiles = files.map((f) => {
      let canEdit = req.user.role === 'owner';
      
      if (!canEdit && userDoc) {
        const membership = userDoc.memberships.find(m => m.ownerId.toString() === f.ownerId.toString() && m.status === 'active');
        if (membership && membership.role === 'editor') {
          const userLevel = levelValues[membership.permissionLevel] || 1;
          const fileLevel = levelValues[f.securityLevel] || 2;
          if (userLevel >= fileLevel) {
            canEdit = true;
          }
        }
      }

      return {
        id: f._id,
        originalName: f.originalName,
        fileType: f.fileType,
        fileSize: f.fileSize,
        securityLevel: f.securityLevel,
        uploadedBy: f.uploadedBy?.uid || 'Unknown',
        uploadedAt: f.uploadedAt,
        canEdit
      };
    });

    res.json({ files: sanitizedFiles });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to fetch files.' });
  }
});

// ─── Download File ────────────────────────────────────────────
// GET /api/file/:id
// Decrypts and streams file to user (with permission check)
router.get('/file/:id', authenticate, checkFilePermission('read'), async (req, res) => {
  try {
    const file = req.file; // Attached by filePermission middleware

    // Fetch encrypted file from Cloudinary
    const response = await fetch(file.fileUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch file from storage.');
    }

    const encryptedBuffer = Buffer.from(await response.arrayBuffer());

    // Decrypt the file
    const decryptedBuffer = decryptBuffer(encryptedBuffer, file.iv);

    // Log download activity
    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.uid,
      action: 'download',
      fileId: file._id,
      fileName: file.originalName,
    });

    // Set headers and stream decrypted file
    const mimeTypes = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt: 'application/vnd.ms-powerpoint',
    };

    res.setHeader('Content-Type', mimeTypes[file.fileType] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.send(decryptedBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'File download failed.' });
  }
});

// ─── Delete File ──────────────────────────────────────────────
// DELETE /api/file/:id
// Owner or editor with edit permission can delete
router.delete('/file/:id', authenticate, checkFilePermission('edit'), async (req, res) => {
  try {
    const file = req.file;

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(file.cloudinaryPublicId, {
      resource_type: 'raw',
    });

    // Delete from DB
    await File.findByIdAndDelete(file._id);

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.uid,
      action: 'delete',
      fileId: file._id,
      fileName: file.originalName,
    });

    res.json({ message: `File "${file.originalName}" deleted successfully.` });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'File deletion failed.' });
  }
});

// ─── Modify File (Re-upload) ─────────────────────────────────
// PUT /api/file/:id
// Re-uploads a new version of the file (owner or editor with edit permission)
router.put(
  '/file/:id',
  authenticate,
  checkFilePermission('edit'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided.' });
      }

      const existingFile = req.fileDoc || (await File.findById(req.params.id));
      if (!existingFile) {
        return res.status(404).json({ error: 'File not found.' });
      }

      // Delete old file from Cloudinary
      await cloudinary.uploader.destroy(existingFile.cloudinaryPublicId, {
        resource_type: 'raw',
      });

      // Encrypt new file
      const { encryptedBuffer, iv } = encryptBuffer(req.file.buffer);

      // Upload new encrypted file
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: `cryptovault/${existingFile.ownerId}`,
            public_id: `${Date.now()}_${req.file.originalname}`,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(encryptedBuffer);
      });

      // Update file record
      const ext = req.file.originalname.split('.').pop().toLowerCase();
      existingFile.fileUrl = uploadResult.secure_url;
      existingFile.cloudinaryPublicId = uploadResult.public_id;
      existingFile.originalName = req.file.originalname;
      existingFile.fileType = ext;
      existingFile.fileSize = req.file.size;
      existingFile.iv = iv;
      existingFile.uploadedAt = new Date();

      await existingFile.save();

      // Log activity
      await ActivityLog.create({
        userId: req.user.id,
        userName: req.user.uid,
        action: 'edit',
        fileId: existingFile._id,
        fileName: req.file.originalname,
      });

      res.json({
        message: 'File modified successfully.',
        file: {
          id: existingFile._id,
          originalName: existingFile.originalName,
          fileType: existingFile.fileType,
          fileSize: existingFile.fileSize,
          uploadedAt: existingFile.uploadedAt,
        },
      });
    } catch (error) {
      console.error('Modify error:', error);
      res.status(500).json({ error: 'File modification failed.' });
    }
  }
);

// (Removed permissions endpoints as they are no longer used)

module.exports = router;
