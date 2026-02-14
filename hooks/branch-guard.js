#!/usr/bin/env node
'use strict';

// PreToolUse hook: Block git commit/push on protected branches.
// Allows: commits on work/*, hotfix/*, refactor/* branches
// Blocks: commits on main, master, feature/* branches
// Passes through: all non-git commands

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

    // Check current branch
    const { execSync } = require('child_process');
    let branch;
    try {
      branch = execSync('git branch --show-current', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
      // Can't determine branch — allow (might not be in a git repo)
      process.exit(0);
    }

    // Allow commits on agent workbranches
    if (branch.startsWith('work/') || branch.startsWith('hotfix/') || branch.startsWith('refactor/')) {
      process.exit(0);
    }

    // Block commits on protected branches (main, master, feature/*)
    if (branch === 'main' || branch === 'master' || branch.startsWith('feature/')) {
      const action = isGitCommit ? 'commit' : 'push';
      const result = {
        decision: 'block',
        reason: `Branch guard: git ${action} blocked on protected branch "${branch}". Agents should only commit on work/* branches.`,
      };
      process.stdout.write(JSON.stringify(result));
    }

    process.exit(0);
  } catch {
    // On any error, allow the operation (fail open)
    process.exit(0);
  }
});
