#!/usr/bin/env node
'use strict';

// PreToolUse hook: Configurable branch guard for git commit/push.
// Enforcement modes:
//   "off"   → exit immediately, no checks
//   "warn"  → write warning to stderr, allow operation (default)
//   "block" → return { decision: "block" }, preventing the operation
//
// Uses branching config from .claude/workflow.json via hooks/config.js.
// Worktree-aware: detects branch from command path (cd <path> && or git -C <path>).

const {
  getBranchingConfig,
  isProtectedBranch,
  isFeatureBranch,
  isWorkBranch,
  getEffectiveBranch
} = require('./config.js');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const command = (data.tool_input && data.tool_input.command) || '';

    // Only check git commit and git push commands
    const isGitCommit = /\bgit\s+commit\b/.test(command);
    const isGitPush = /\bgit\s+push\b/.test(command);

    if (!isGitCommit && !isGitPush) {
      process.exit(0);
    }

    const config = getBranchingConfig();

    // enforce: "off" → skip all checks
    if (config.enforce === 'off') {
      process.exit(0);
    }

    // Detect branch (worktree-aware)
    const branch = getEffectiveBranch(command);
    if (!branch) {
      // Can't determine branch — allow
      process.exit(0);
    }

    // Allow commits on work branches, hotfix branches, and refactor branches
    if (isWorkBranch(branch, config) ||
        branch.startsWith('hotfix/') ||
        branch.startsWith('refactor/')) {
      process.exit(0);
    }

    const action = isGitCommit ? 'commit' : 'push';

    // Check protected branches (main, master, etc.)
    if (isProtectedBranch(branch, config.protectedBranches)) {
      const msg = `Branch guard: git ${action} on protected branch "${branch}". ` +
        `Agents should only commit on ${config.workPrefix}/* branches. ` +
        `To change, edit .claude/workflow.json branching.enforce or tell Claude to adjust.`;

      if (config.enforce === 'block') {
        const result = { decision: 'block', reason: msg };
        process.stdout.write(JSON.stringify(result));
      } else {
        // enforce: "warn" (default)
        process.stderr.write(`⚠ ${msg}\n`);
      }
      process.exit(0);
    }

    // Feature branches: warn only if workPrefix is set (agents should use work branches)
    if (config.workPrefix && isFeatureBranch(branch, config)) {
      const msg = `Branch guard: git ${action} on feature branch "${branch}". ` +
        `Agents should commit on ${config.workPrefix}/* branches instead. ` +
        `To change, edit .claude/workflow.json branching.enforce or tell Claude to adjust.`;

      if (config.enforce === 'block') {
        const result = { decision: 'block', reason: msg };
        process.stdout.write(JSON.stringify(result));
      } else {
        // enforce: "warn" (default)
        process.stderr.write(`⚠ ${msg}\n`);
      }
    }

    process.exit(0);
  } catch {
    // On any error, allow the operation (fail open)
    process.exit(0);
  }
});
