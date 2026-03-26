#!/usr/bin/env node
'use strict';

// Ticket extraction and directory management module.
// Handles ticket number extraction from git branch names (ES-{N} pattern),
// ticket directory creation, history.json management, and task file runtime updates.
//
// All functions are synchronous, matching the existing hook module patterns.
// No external dependencies — uses only fs and path.

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Ticket extraction
// ---------------------------------------------------------------------------

/**
 * Extract ticket number and description from a git branch name.
 *
 * Supported patterns:
 *   ES-11850-user-auth-refactor       → { ticket: "ES-11850", description: "user-auth-refactor" }
 *   feature/ES-11850-user-auth        → { ticket: "ES-11850", description: "user-auth" }
 *   work/ES-11850-user-auth/task-1    → { ticket: "ES-11850", description: "user-auth" }
 *   ES-11850                          → { ticket: "ES-11850", description: "" }
 *   main                              → null
 *   feature/old-style-name            → null
 *
 * @param {string} branchName - Git branch name
 * @param {RegExp|string} [ticketPattern] - Custom ticket pattern (default: /^(\w+-\d+)/)
 * @returns {{ ticket: string, description: string } | null}
 */
function extractTicketFromBranch(branchName, ticketPattern) {
  if (!branchName || typeof branchName !== 'string') return null;

  const pattern = ticketPattern
    ? (typeof ticketPattern === 'string' ? new RegExp(ticketPattern) : ticketPattern)
    : /(\w+-\d+)/;

  // Strip prefixes: feature/, work/, etc. — take the segment after the last known prefix
  // For work/ES-11850-desc/task-1, we want the middle segment
  const segments = branchName.split('/');

  for (const segment of segments) {
    const match = segment.match(pattern);
    if (match) {
      const ticket = match[1] || match[0];
      // Description is everything after the ticket in this segment
      const descStart = segment.indexOf(ticket) + ticket.length;
      let description = segment.slice(descStart);
      // Strip leading dash/underscore
      if (description.startsWith('-') || description.startsWith('_')) {
        description = description.slice(1);
      }
      return { ticket, description };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Directory management
// ---------------------------------------------------------------------------

/**
 * Ensure the ticket progress directory exists with standard subdirectories.
 * Creates: progress/{ticket}/ with subdirectories: tasks/, plans/, audits/, reports/
 *
 * @param {string} ticket - Ticket ID (e.g., "ES-11850")
 * @param {string} [progressDir] - Base progress directory (default: ".claude/progress")
 * @param {string} [repoRoot] - Repository root (default: process.cwd())
 * @returns {string} Absolute path to the ticket directory
 */
function ensureTicketDir(ticket, progressDir, repoRoot) {
  if (!ticket) throw new Error('ticket is required');

  const root = repoRoot || process.cwd();
  const progress = progressDir || '.claude/progress';
  const ticketDir = path.join(root, progress, ticket);

  const subdirs = ['tasks', 'plans', 'audits', 'reports'];

  fs.mkdirSync(ticketDir, { recursive: true });
  for (const sub of subdirs) {
    fs.mkdirSync(path.join(ticketDir, sub), { recursive: true });
  }

  return ticketDir;
}

// ---------------------------------------------------------------------------
// History management
// ---------------------------------------------------------------------------

/**
 * Read the history.json for a ticket.
 *
 * @param {string} ticket - Ticket ID
 * @param {string} [progressDir] - Base progress directory
 * @param {string} [repoRoot] - Repository root
 * @returns {Array<object>} History entries (empty array if file doesn't exist)
 */
function getHistory(ticket, progressDir, repoRoot) {
  if (!ticket) return [];

  const root = repoRoot || process.cwd();
  const progress = progressDir || '.claude/progress';
  const historyPath = path.join(root, progress, ticket, 'history.json');

  try {
    const raw = fs.readFileSync(historyPath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Append an entry to history.json for a ticket.
 * Creates the file if it doesn't exist.
 *
 * @param {string} ticket - Ticket ID
 * @param {object} entry - History entry to append
 * @param {string} entry.type - Entry type (e.g., "session.start", "task-handoff", "qa.passed")
 * @param {string} [entry.source] - What created this entry (e.g., "/new-plan", "/team-go")
 * @param {string} [entry.message] - Human-readable description
 * @param {object} [entry.data] - Additional structured data
 * @param {string} [progressDir] - Base progress directory
 * @param {string} [repoRoot] - Repository root
 */
function addHistoryEntry(ticket, entry, progressDir, repoRoot) {
  if (!ticket || !entry) return;

  const root = repoRoot || process.cwd();
  const progress = progressDir || '.claude/progress';
  const ticketDir = path.join(root, progress, ticket);
  const historyPath = path.join(ticketDir, 'history.json');

  // Ensure directory exists
  fs.mkdirSync(ticketDir, { recursive: true });

  // Read existing history
  const history = getHistory(ticket, progressDir, repoRoot);

  // Add timestamp and append
  const enrichedEntry = {
    ts: new Date().toISOString(),
    ...entry
  };
  history.push(enrichedEntry);

  // Write atomically
  const tmpPath = historyPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(history, null, 2));
  fs.renameSync(tmpPath, historyPath);
}

// ---------------------------------------------------------------------------
// Task file runtime updates
// ---------------------------------------------------------------------------

/**
 * Update YAML frontmatter fields in a task handoff file with runtime values.
 * Reads the file, finds the YAML frontmatter between --- delimiters,
 * updates specified fields, and writes back.
 *
 * Uses simple string manipulation — no YAML library needed for flat key-value updates.
 *
 * @param {string} taskFilePath - Absolute path to the task .md file
 * @param {object} runtimeValues - Key-value pairs to update in frontmatter
 *   e.g., { status: "active", workbranch: "work/ES-11850/auth", teamLeaderName: "leader-abc" }
 */
function updateTaskFileRuntime(taskFilePath, runtimeValues) {
  if (!taskFilePath || !runtimeValues) return;

  let content;
  try {
    content = fs.readFileSync(taskFilePath, 'utf8');
  } catch {
    return; // File doesn't exist — skip silently
  }

  // Find frontmatter boundaries
  const fmStart = content.indexOf('---');
  if (fmStart === -1) return;

  const fmEnd = content.indexOf('---', fmStart + 3);
  if (fmEnd === -1) return;

  const before = content.slice(0, fmStart + 3);
  let frontmatter = content.slice(fmStart + 3, fmEnd);
  const after = content.slice(fmEnd);

  // Update each field
  for (const [key, value] of Object.entries(runtimeValues)) {
    // Format value for YAML
    let yamlValue;
    if (value === null) {
      yamlValue = 'null';
    } else if (typeof value === 'string') {
      // Quote strings that contain special chars or are empty
      if (value === '' || /[:#{}[\],&*?|>!%@`]/.test(value) || value.includes(' ')) {
        yamlValue = `"${value.replace(/"/g, '\\"')}"`;
      } else {
        yamlValue = value;
      }
    } else {
      yamlValue = String(value);
    }

    // Try to replace existing key
    const keyRegex = new RegExp(`^(${key}:)\\s*.*$`, 'm');
    if (keyRegex.test(frontmatter)) {
      frontmatter = frontmatter.replace(keyRegex, `$1 ${yamlValue}`);
    } else {
      // Append new key before closing ---
      frontmatter = frontmatter.trimEnd() + `\n${key}: ${yamlValue}\n`;
    }
  }

  // Write back
  const updated = before + frontmatter + after;
  fs.writeFileSync(taskFilePath, updated);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  extractTicketFromBranch,
  ensureTicketDir,
  getHistory,
  addHistoryEntry,
  updateTaskFileRuntime
};
