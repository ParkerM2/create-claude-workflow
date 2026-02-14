'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Write a file with conflict detection.
 * Returns: 'created' | 'updated' | 'skipped'
 */
function writeFile(filePath, content, options = {}) {
  const { backup = true, force = false } = options;

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return 'created';
  }

  const existing = fs.readFileSync(filePath, 'utf-8');

  // Skip if content is identical
  if (contentHash(existing) === contentHash(content)) {
    return 'skipped';
  }

  if (force) {
    if (backup) {
      createBackup(filePath, existing);
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return 'updated';
  }

  // Caller should handle the conflict (prompt user)
  return 'conflict';
}

/**
 * Create a .bak backup of a file.
 */
function createBackup(filePath, content) {
  const backupPath = filePath + '.bak';
  // Don't overwrite existing backup
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, content, 'utf-8');
  }
}

/**
 * Content hash for comparison (normalizes line endings).
 */
function contentHash(content) {
  const normalized = content.replace(/\r\n/g, '\n').trimEnd();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

module.exports = { writeFile, createBackup, contentHash };
