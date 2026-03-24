#!/usr/bin/env node
'use strict';

// TeammateIdle hook: Quality Gate Enforcement
// Fires when a teammate is about to go idle (end of turn).
// Exit code 2 REJECTS idle — the teammate keeps working and receives stderr as feedback.
// Exit code 0 ALLOWS idle — the teammate goes idle normally.
//
// This replaces quality-gate.js (Stop hook) which could only WARN but not BLOCK.
// TeammateIdle with exit code 2 actually PREVENTS the agent from stopping.
//
// Checks:
//   1. Detect if on a work/* branch (coding agent context)
//   2. Run project verification commands (lint, typecheck, test)
//   3. If any fail → exit 2 with failure details (agent keeps working)
//   4. If all pass → exit 0 (agent goes idle)
//
// Registered for: TeammateIdle (no matchers — fires on every occurrence)

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getBranchingConfig, isWorkBranch, getGuardsConfig } = require('./config.js');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

try {
  // Read stdin for hook payload
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      // Check if quality gate is enabled
      const guards = getGuardsConfig();
      if (guards.qualityGate === false) {
        process.exit(0);
      }

      // Only enforce on work/ branches (coding agent context)
      let branch;
      try {
        branch = execSync('git branch --show-current', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
      } catch {
        process.exit(0); // Can't detect branch — allow idle
      }

      const branchConfig = getBranchingConfig();
      if (!isWorkBranch(branch, branchConfig)) {
        // Not a coding agent — allow idle (don't gate team leader or QA agents)
        process.exit(0);
      }

      // Detect project toolchain
      const checks = detectChecks();
      if (checks.length === 0) {
        process.exit(0); // No checks available — allow idle
      }

      // Run each check
      const failures = [];
      for (const check of checks) {
        try {
          execSync(check.command, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 60000 // 60s per check
          });
        } catch (err) {
          const output = ((err.stdout || '') + (err.stderr || '')).trim();
          const truncated = output.length > 500
            ? output.substring(0, 500) + '... (truncated)'
            : output;
          failures.push({ name: check.name, command: check.command, output: truncated });
        }
      }

      if (failures.length > 0) {
        // Build failure report
        const report = failures.map(f =>
          `**${f.name}** failed:\n\`${f.command}\`\n${f.output}`
        ).join('\n\n');

        // Exit 2 = REJECT idle, teammate keeps working with this feedback
        process.stderr.write(
          `Quality gate: ${failures.length} check(s) failed. Fix these before completing your task:\n\n` +
          report + '\n'
        );
        process.exit(2);
      }

      // All checks passed — allow idle
      process.exit(0);
    } catch {
      // Never crash — allow idle on error
      process.exit(0);
    }
  });
} catch {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Toolchain detection (same as quality-gate.js but extracted here)
// ---------------------------------------------------------------------------

function detectChecks() {
  const checks = [];

  // JS/TS: package.json scripts
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const scripts = pkg.scripts || {};

      if (scripts.lint) checks.push({ name: 'Lint', command: 'npm run lint' });
      if (scripts.typecheck) checks.push({ name: 'Typecheck', command: 'npm run typecheck' });
      else if (scripts['type-check']) checks.push({ name: 'Typecheck', command: 'npm run type-check' });
      if (scripts['test:unit']) checks.push({ name: 'Unit Tests', command: 'npm run test:unit' });
      else if (scripts.test) checks.push({ name: 'Tests', command: 'npm run test' });

      return checks;
    }
  } catch { /* */ }

  // Python
  try {
    if (fs.existsSync(path.join(process.cwd(), 'pyproject.toml')) ||
        fs.existsSync(path.join(process.cwd(), 'setup.py'))) {
      try { execSync('ruff --version', { stdio: 'pipe' }); checks.push({ name: 'Lint', command: 'ruff check .' }); } catch {
        try { execSync('flake8 --version', { stdio: 'pipe' }); checks.push({ name: 'Lint', command: 'flake8 .' }); } catch { /* */ }
      }
      try { execSync('mypy --version', { stdio: 'pipe' }); checks.push({ name: 'Typecheck', command: 'mypy .' }); } catch { /* */ }
      try { execSync('pytest --version', { stdio: 'pipe' }); checks.push({ name: 'Tests', command: 'pytest --tb=short -q' }); } catch { /* */ }
      if (checks.length > 0) return checks;
    }
  } catch { /* */ }

  // Go
  try {
    if (fs.existsSync(path.join(process.cwd(), 'go.mod'))) {
      checks.push({ name: 'Vet', command: 'go vet ./...' });
      checks.push({ name: 'Tests', command: 'go test ./... -short' });
      try { execSync('golangci-lint --version', { stdio: 'pipe' }); checks.unshift({ name: 'Lint', command: 'golangci-lint run' }); } catch { /* */ }
      return checks;
    }
  } catch { /* */ }

  // Makefile
  try {
    if (fs.existsSync(path.join(process.cwd(), 'Makefile'))) {
      const makefile = fs.readFileSync(path.join(process.cwd(), 'Makefile'), 'utf8');
      if (/^lint:/m.test(makefile)) checks.push({ name: 'Lint', command: 'make lint' });
      if (/^test:/m.test(makefile)) checks.push({ name: 'Tests', command: 'make test' });
      if (/^check:/m.test(makefile)) checks.push({ name: 'Check', command: 'make check' });
    }
  } catch { /* */ }

  return checks;
}
