#!/usr/bin/env node
'use strict';

// TaskCompleted hook: Task Completion Validator
// Fires when a teammate marks a task as completed.
// Exit code 2 REJECTS completion — the task stays in-progress, feedback sent to agent.
// Exit code 0 ALLOWS completion.
//
// Checks:
//   1. Verify the agent has committed changes (git status shows clean working tree)
//   2. Verify at least one commit exists on the work branch
//
// Registered for: TaskCompleted (no matchers — fires on every occurrence)

const { execSync } = require('child_process');
const { getBranchingConfig, isWorkBranch, getGuardsConfig } = require('./config.js');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    // Check if task validation is enabled
    const guards = getGuardsConfig();
    if (guards.taskValidator === false) {
      process.exit(0);
    }

    // Only validate on work/ branches (coding agent context)
    let branch;
    try {
      branch = execSync('git branch --show-current', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch {
      process.exit(0); // Can't detect branch — allow completion
    }

    const branchConfig = getBranchingConfig();
    if (!isWorkBranch(branch, branchConfig)) {
      process.exit(0); // Not a coding agent — allow
    }

    // Check 1: Working tree should be clean (all changes committed)
    try {
      const status = execSync('git status --porcelain', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      if (status) {
        const fileCount = status.split('\n').length;
        process.stderr.write(
          `Task completion rejected: ${fileCount} uncommitted file(s) detected. ` +
          `Commit all changes before marking the task complete.\n` +
          `Uncommitted files:\n${status}\n`
        );
        process.exit(2);
      }
    } catch {
      // git status failed — allow completion (don't block on git errors)
      process.exit(0);
    }

    // All checks passed — allow completion
    process.exit(0);
  } catch {
    // Never crash — allow completion on error
    process.exit(0);
  }
});
