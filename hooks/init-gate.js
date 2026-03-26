#!/usr/bin/env node
'use strict';

// PreToolUse hook: Team-Lead Must-Read-Identity Gate
// Blocks TeamCreate and Agent (spawn) tool calls until agents/team-leader.md
// has been read in this session. Uses a temp-file marker with 24-hour TTL.
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
// Main: read stdin, dispatch
// ---------------------------------------------------------------------------

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};

    // PostToolUse check: if Read targeted team-leader.md, create marker
    // (This hook is registered for PreToolUse, but we check if this is
    //  a Read that already happened by looking at the tool result)
    // Actually, for PreToolUse we check BEFORE the tool runs.
    // The marker gets created when we detect Read of team-leader.md in
    // the proof-ledger or via a separate PostToolUse registration.
    // For simplicity, we check if the Read tool is targeting team-leader.md
    // and allow it (plus create the marker for subsequent calls).

    // If this is a Read tool targeting team-leader.md — always allow + mark
    if (toolName === 'Read') {
      const filePath = (toolInput.file_path || '').replace(/\\/g, '/');
      if (filePath.includes('agents/team-leader.md')) {
        createMarker();
      }
      allow();
      return;
    }

    // Only gate TeamCreate and Agent tools
    if (toolName !== 'TeamCreate' && toolName !== 'Agent') {
      allow();
      return;
    }

    // Check if team-leader.md has been read (marker exists and fresh)
    if (isMarkerValid()) {
      allow();
      return;
    }

    // Block — team-leader.md not read yet
    deny('Read agents/team-leader.md before spawning agents. This ensures the Team Leader identity and coordination rules are loaded. Recovery: Use the Read tool to read agents/team-leader.md, then retry.');

  } catch {
    // Fail-open: any error → allow
    allow();
  }
});
