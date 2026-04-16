// server/routes/auth.js
// Authentication routes — register owner, register user, login

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateSystemCode } = require('../utils/systemCode');

// ─── Register Owner ───────────────────────────────────────────
// POST /api/register-owner
// Creates a new owner with a unique systemCode
router.post('/register-owner', async (req, res) => {
  try {
    const { uid, password } = req.body;

    // Validation
    if (!uid || !password) {
      return res.status(400).json({ error: 'UID and password are required.' });
    }

    if (uid.length < 3) {
      return res.status(400).json({ error: 'UID must be at least 3 characters.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check if UID already exists
    const existingUser = await User.findOne({ uid });
    if (existingUser) {
      return res.status(409).json({ error: 'UID already taken.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique system code
    let systemCode = generateSystemCode();
    while (await User.findOne({ systemCode, role: 'owner' })) {
      systemCode = generateSystemCode();
    }

    // Create owner
    const owner = new User({
      uid,
      password: hashedPassword,
      role: 'owner',
      systemCode,
    });

    await owner.save();

    // Generate JWT
    const token = jwt.sign(
      { id: owner._id, uid: owner.uid, role: owner.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Owner registered successfully.',
      token,
      user: {
        id: owner._id,
        uid: owner.uid,
        role: owner.role,
        systemCode: owner.systemCode,
      },
    });
  } catch (error) {
    console.error('Register owner error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// ─── Register User ────────────────────────────────────────────
// POST /api/register-user
// Creates a pending user linked to an owner via systemCode
router.post('/register-user', async (req, res) => {
  try {
    const { uid, password, confirmPassword } = req.body;

    // Validation
    if (!uid || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (uid.length < 3) {
      return res.status(400).json({ error: 'UID must be at least 3 characters.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    // Check if UID already exists
    const existingUser = await User.findOne({ uid });
    if (existingUser) {
      return res.status(409).json({ error: 'UID already taken.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      uid,
      password: hashedPassword,
      role: 'user',
      memberships: [],
    });

    await user.save();

    res.status(201).json({
      message: 'Account created successfully. Please login.',
      user: {
        id: user._id,
        uid: user.uid,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Register user error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// ─── Login ────────────────────────────────────────────────────
// POST /api/login
// Validates credentials and returns JWT token
router.post('/login', async (req, res) => {
  try {
    const { uid, password } = req.body;

    // Validation
    if (!uid || !password) {
      return res.status(400).json({ error: 'UID and password are required.' });
    }

    // Find user
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, uid: user.uid, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        uid: user.uid,
        role: user.role,
        systemCode: user.systemCode,
        memberships: user.memberships,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

module.exports = router;
