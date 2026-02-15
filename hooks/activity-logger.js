#!/usr/bin/env node
'use strict';

// PostToolUse hook: Log all file edits for post-mortem debugging.
// Appends to <progressDir>/.edit-log
// Non-blocking — always exits 0

const fs = require('fs');
const path = require('path');

// Read progress directory from project config, fall back to default
function getProgressDir() {
  try {
    const configPath = path.join(process.cwd(), '.claude', 'workflow.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.progressDir || '.claude/progress';
  } catch {
    return '.claude/progress';
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || 'unknown';
    const filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || 'unknown';

    const logDir = getProgressDir();
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, '.edit-log');
    const now = new Date();
    const timestamp = now.toTimeString().slice(0, 8); // HH:MM:SS
    const entry = `[${timestamp}] ${toolName}: ${filePath}\n`;

    fs.appendFileSync(logFile, entry);
  } catch {
    // Non-blocking — always exit 0
  }
  process.exit(0);
});
