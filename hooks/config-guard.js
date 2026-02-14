#!/usr/bin/env node
'use strict';

// PreToolUse hook: Block agents from modifying .claude/ workflow files during execution.
// Protects: commands, agents, prompts, hooks, and settings.json

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || '';

    // Normalize path separators for cross-platform support
    const normalized = filePath.replace(/\\/g, '/');

    const protectedPatterns = [
      /\.claude\/commands\/.*\.md$/,
      /\.claude\/agents\/.*\.md$/,
      /\.claude\/prompts\/.*\.md$/,
      /\.claude\/hooks\/.*\.js$/,
      /\.claude\/settings\.json$/,
    ];

    for (const pattern of protectedPatterns) {
      if (pattern.test(normalized)) {
        const result = {
          decision: 'block',
          reason: `Config guard: Modifying "${filePath}" is blocked. Agents should never modify workflow files (.claude/) during execution.`,
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
