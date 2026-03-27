#!/usr/bin/env node
'use strict';

// PreToolUse hook: Team-Lead Must-Read-Identity Gate
// Blocks TeamCreate and Agent (spawn) tool calls until agents/team-leader.md
// has been read in this session. Uses a temp-file marker with 24-hour TTL.
//
// Detection: When TeamCreate/Agent is called, if no marker exists we check
// whether agents/team-leader.md was recently accessed (atime within the last
// 5 minutes). A recent atime implies the file was read by the session, so we
// create the marker and allow. Otherwise we block and instruct the user.
//
// Fail-open: any error → exit 0 (allow)
// Registered for: TeamCreate, Agent

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function deny(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

function allow() {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow'
    }
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Marker file management
// ---------------------------------------------------------------------------

const MARKER_DIR = path.join(os.tmpdir(), 'claude-workflow-init');
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCwdHash() {
  return crypto.createHash('md5').update(process.cwd()).digest('hex').slice(0, 12);
}

function getMarkerPath() {
  return path.join(MARKER_DIR, getCwdHash() + '.initialized');
}

function isMarkerValid() {
  try {
    const markerPath = getMarkerPath();
    if (!fs.existsSync(markerPath)) return false;
    const stat = fs.statSync(markerPath);
    const age = Date.now() - stat.mtimeMs;
    return age < TTL_MS;
  } catch {
    return false;
  }
}

function createMarker() {
  try {
    fs.mkdirSync(MARKER_DIR, { recursive: true });
    fs.writeFileSync(getMarkerPath(), new Date().toISOString());
  } catch {
    // Best effort — fail silently
  }
}

// ---------------------------------------------------------------------------
// Atime-based detection: check whether team-leader.md was recently read
// ---------------------------------------------------------------------------

const ATIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Look for agents/team-leader.md relative to cwd. If the file exists and its
 * atime is within the last ATIME_WINDOW_MS, it was likely read in the current
 * session — create the marker and return true. Returns false otherwise.
 */
function checkAtimeAndMark() {
  try {
    const tlPath = path.join(process.cwd(), 'agents', 'team-leader.md');
    if (!fs.existsSync(tlPath)) return false;
    const stat = fs.statSync(tlPath);
    const age = Date.now() - stat.atimeMs;
    if (age < ATIME_WINDOW_MS) {
      createMarker();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main: read stdin, dispatch
// ---------------------------------------------------------------------------

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || '';

    // Only gate TeamCreate and Agent tools
    if (toolName !== 'TeamCreate' && toolName !== 'Agent') {
      allow();
      return;
    }

    // 1. Fast path: marker already exists and is fresh
    if (isMarkerValid()) {
      allow();
      return;
    }

    // 2. No marker yet — check if team-leader.md was recently accessed (read)
    if (checkAtimeAndMark()) {
      allow();
      return;
    }

    // 3. Block — team-leader.md not read yet
    deny('Read agents/team-leader.md before spawning agents. This ensures the Team Leader identity and coordination rules are loaded. Recovery: Use the Read tool to read agents/team-leader.md, then retry.');

  } catch {
    // Fail-open: any error → allow
    allow();
  }
});
