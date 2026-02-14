#!/usr/bin/env node
'use strict';

// PreToolUse hook: Block destructive git/shell operations.
// Blocks: force-push, hard reset, rm -rf, git clean -fd, git branch -D

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const command = (data.tool_input && data.tool_input.command) || '';

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
          reason: `Destructive guard: "${name}" is blocked. This command can cause irreversible data loss. If you need this, ask the user to run it manually.`,
        };
        process.stdout.write(JSON.stringify(result));
        process.exit(0);
        return;
      }
    }

    process.exit(0);
  } catch {
    // On any error, allow the operation (fail open)
    process.exit(0);
  }
});
