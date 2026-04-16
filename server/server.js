// server/server.js
// CryptoVault — Express application entry point

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { configureCloudinary } = require('./config/cloudinary');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const fileRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', fileRoutes);
app.use('/api', adminRoutes);

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Catch-all: serve frontend for SPA routes ────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Error Handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum 50MB allowed.' });
  }

  // Multer file type error
  if (err.message && err.message.includes('File type not supported')) {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start Server ─────────────────────────────────────────────
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✅ Database connected');
  } catch (error) {
    console.warn('⚠️  MongoDB not connected:', error.message);
    console.warn('⚠️  Server will start but API routes requiring DB will fail.');
  }

  try {
    // Configure Cloudinary
    configureCloudinary();
  } catch (error) {
    console.warn('⚠️  Cloudinary not configured:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`\n🔒 CryptoVault server running on http://localhost:${PORT}`);
    console.log(`📂 Serving frontend from: ${path.join(__dirname, '..', 'public')}\n`);
  });
};

startServer();
