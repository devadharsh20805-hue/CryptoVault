// server/utils/encryption.js
// AES-256-CBC encryption/decryption for file buffers

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

/**
 * Get the AES encryption key from environment or generate one.
 * For production, always set AES_SECRET_KEY in .env
 */
const getKey = () => {
  const envKey = process.env.AES_SECRET_KEY;
  if (envKey && envKey.length === 64) {
    return Buffer.from(envKey, 'hex');
  }
  // Fallback: derive a key from JWT_SECRET (NOT recommended for production)
  return crypto.scryptSync(process.env.JWT_SECRET || 'default-key', 'salt', 32);
};

/**
 * Encrypt a file buffer using AES-256-CBC
 * @param {Buffer} buffer - The original file buffer
 * @returns {{ encryptedBuffer: Buffer, iv: string }} Encrypted data and IV (hex)
 */
const encryptBuffer = (buffer) => {
  const key = getKey();
  const iv = crypto.randomBytes(16); // Random IV for each file
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

  return {
    encryptedBuffer: encrypted,
    iv: iv.toString('hex'),
  };
};

/**
 * Decrypt a file buffer using AES-256-CBC
 * @param {Buffer} encryptedBuffer - The encrypted file buffer
 * @param {string} ivHex - The initialization vector as hex string
 * @returns {Buffer} The original decrypted file buffer
 */
const decryptBuffer = (encryptedBuffer, ivHex) => {
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

  return decrypted;
};

module.exports = { encryptBuffer, decryptBuffer };
