// server/utils/systemCode.js
// Generates unique system codes for owner registration

const crypto = require('crypto');

/**
 * Generate a unique 8-character alphanumeric system code
 * Used to link users to their owner's system
 * @returns {string} 8-char uppercase alphanumeric code
 */
const generateSystemCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

module.exports = { generateSystemCode };
