#!/usr/bin/env node
'use strict';

// PostToolUse(Bash) hook: Detect git operations and emit tracking events.
// Pattern-matches git commands for branch creation, merges, pulls, and rebases.
// Non-blocking — always exits 0.

const { emitEvent } = require('./tracker.js');

// Conflict detection patterns
const CONFLICT_PATTERNS = [
  /CONFLICT/i,
  /Merge conflict/i,
  /rebase conflict/i,
];

function hasConflicts(output) {
  if (!output) return false;
  return CONFLICT_PATTERNS.some((pattern) => pattern.test(output));
}

// Extract current branch from git command context.
// Falls back to execSync if needed.
function getCurrentBranch() {
  try {
    const { execSync } = require('child_process');
    return execSync('git branch --show-current', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function processGitCommand(command, toolResult) {
  const output = typeof toolResult === 'string' ? toolResult : '';

  // git checkout -b <branch> or git switch -c <branch>
  const checkoutMatch = command.match(/git\s+checkout\s+-b\s+([\w\-\/]+)/);
  const switchMatch = command.match(/git\s+switch\s+-c\s+([\w\-\/]+)/);
  if (checkoutMatch || switchMatch) {
    const branchName = checkoutMatch ? checkoutMatch[1] : switchMatch[1];
    const parent = getCurrentBranch();
    emitEvent('branch.created', { name: branchName, parent });
    return;
  }

  // git merge [--no-ff] <branch>
  const mergeMatch = command.match(/git\s+merge\s+(?:--no-ff\s+)?([\w\-\/]+)/);
  if (mergeMatch) {
    const mergedBranch = mergeMatch[1];
    const currentBranch = getCurrentBranch();
    const conflicts = hasConflicts(output);
    emitEvent('branch.merged', { name: mergedBranch, target: currentBranch, conflicts });
    return;
  }

  // git pull
  const pullMatch = command.match(/git\s+pull\b/);
  if (pullMatch) {
    const currentBranch = getCurrentBranch();
    emitEvent('branch.pulled', { branch: currentBranch, behind: null, ahead: null });
    return;
  }

  // git rebase <target>
  const rebaseMatch = command.match(/git\s+rebase\s+([\w\-\/]+)/);
  if (rebaseMatch) {
    const onto = rebaseMatch[1];
    const currentBranch = getCurrentBranch();
    const conflicts = hasConflicts(output);
    emitEvent('branch.rebased', { branch: currentBranch, onto, conflicts });
    return;
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Only process Bash tool calls
    if (data.tool_name !== 'Bash') {
      process.exit(0);
    }

    const command = (data.tool_input && data.tool_input.command) || '';
    const toolResult = data.tool_result || '';

    // Only process if the command looks like a git operation
    if (/\bgit\b/.test(command)) {
      processGitCommand(command, toolResult);
    }
  } catch {
    // Non-blocking — never crash
  }
  process.exit(0);
});
