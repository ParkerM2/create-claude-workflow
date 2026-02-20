#!/usr/bin/env node
'use strict';

// PreToolUse hook: Combined branch + destructive safety guard.
// Runs both checks in a single process to cut per-Bash-command latency in half.
//
// Destructive Guard (checked first — hard blocks):
//   Blocks: force-push, hard reset, rm -rf, git clean -fd, git branch -D
//
// Branch Guard (checked second — warn or block):
//   Enforcement modes: "off" | "warn" (default) | "block"
//   Prevents commits/pushes on protected and feature branches.
//
// Both guards can be toggled independently via .claude/workflow.json guards section.

const {
  getBranchingConfig,
  getGuardsConfig,
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
    const guards = getGuardsConfig();

    // --- Destructive Guard (checked first — hard blocks) ---
    if (guards.destructiveGuard) {
      const blocklist = [
        { pattern: /\bgit\s+push\s+.*--force\b/, name: 'git push --force' },
        { pattern: /\bgit\s+push\s+.*-f\b/, name: 'git push -f' },
        { pattern: /\bgit\s+reset\s+--hard\b/, name: 'git reset --hard' },
        { pattern: /\brm\s+-rf\b/, name: 'rm -rf' },
        { pattern: /\bgit\s+clean\s+-fd\b/, name: 'git clean -fd' },
        { pattern: /\bgit\s+branch\s+-D\b/, name: 'git branch -D' },
      ];

      for (const { pattern, name } of blocklist) {
        if (pattern.test(command)) {
          const result = {
            decision: 'block',
            reason: `Safety guard: "${name}" is blocked. This command can cause irreversible data loss. If you need this, ask the user to run it manually.`,
          };
          process.stdout.write(JSON.stringify(result));
          process.exit(0);
          return;
        }
      }
    }

    // --- Branch Guard ---
    if (guards.branchGuard) {
      const isGitCommit = /\bgit\s+commit\b/.test(command);
      const isGitPush = /\bgit\s+push\b/.test(command);

      if (isGitCommit || isGitPush) {
        const config = getBranchingConfig();

        if (config.enforce !== 'off') {
          const branch = getEffectiveBranch(command);

          if (branch) {
            // Allow commits on work branches, hotfix branches, and refactor branches
            const isAllowed = isWorkBranch(branch, config) ||
              branch.startsWith('hotfix/') ||
              branch.startsWith('refactor/');

            if (!isAllowed) {
              const action = isGitCommit ? 'commit' : 'push';

              // Check protected branches (main, master, etc.)
              if (isProtectedBranch(branch, config.protectedBranches)) {
                const msg = `Branch guard: git ${action} on protected branch "${branch}". ` +
                  `Agents should only commit on ${config.workPrefix}/* branches. ` +
                  `To change, edit .claude/workflow.json branching.enforce or tell Claude to adjust.`;

                if (config.enforce === 'block') {
                  process.stdout.write(JSON.stringify({ decision: 'block', reason: msg }));
                } else {
                  process.stderr.write(`\u26A0 ${msg}\n`);
                }
                process.exit(0);
              }

              // Feature branches: warn if workPrefix is set
              if (config.workPrefix && isFeatureBranch(branch, config)) {
                const msg = `Branch guard: git ${action} on feature branch "${branch}". ` +
                  `Agents should commit on ${config.workPrefix}/* branches instead. ` +
                  `To change, edit .claude/workflow.json branching.enforce or tell Claude to adjust.`;

                if (config.enforce === 'block') {
                  process.stdout.write(JSON.stringify({ decision: 'block', reason: msg }));
                } else {
                  process.stderr.write(`\u26A0 ${msg}\n`);
                }
              }
            }
          }
        }
      }
    }

    process.exit(0);
  } catch {
    // On any error, allow the operation (fail open)
    process.exit(0);
  }
});
