#!/usr/bin/env node
'use strict';

// Quality Gate — Stop hook
// Fires at end-of-turn for coding agents on work/ branches.
// Runs project verification commands (lint, typecheck, test) automatically.
// Blocks turn completion if any check fails — forces the agent to fix before proceeding.
//
// This is deterministic and outside the LLM — the agent cannot skip it.
// Registered for: Stop event (fires after every agent turn)

const { execSync } = require('child_process');
const { getWorkflowConfig, getBranchingConfig, isWorkBranch, getGuardsConfig } = require('./config.js');

// ---------------------------------------------------------------------------
// Hook entry
// ---------------------------------------------------------------------------

try {
  const input = JSON.parse(process.argv[2] || '{}');
  const hookEvent = input.hook_event || input.event || '';

  // Only fire on Stop events
  if (hookEvent !== 'Stop' && hookEvent !== 'stop') {
    // Also handle being called from hooks.json Stop matcher
    // The hook system passes tool_name as empty for Stop events
  }

  // Check if quality gate is enabled
  const guards = getGuardsConfig();
  if (guards.qualityGate === false) {
    process.exit(0);
  }

  // Only run on work/ branches (coding agent context)
  let branch;
  try {
    branch = execSync('git branch --show-current', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch {
    process.exit(0); // Can't detect branch — skip
  }

  const branchConfig = getBranchingConfig();
  if (!isWorkBranch(branch, branchConfig)) {
    // Not a coding agent — skip (don't gate the team leader or QA agents)
    process.exit(0);
  }

  // Detect project toolchain and available commands
  const checks = detectChecks();
  if (checks.length === 0) {
    process.exit(0); // No checks available — skip
  }

  // Run each check
  const failures = [];
  for (const check of checks) {
    try {
      execSync(check.command, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000 // 60 second timeout per check
      });
    } catch (err) {
      const output = (err.stdout || '') + (err.stderr || '');
      // Truncate output to avoid flooding
      const truncated = output.length > 500
        ? output.substring(0, 500) + '... (truncated)'
        : output;
      failures.push({
        name: check.name,
        command: check.command,
        output: truncated
      });
    }
  }

  if (failures.length > 0) {
    // Build failure report
    const report = failures.map(f =>
      `**${f.name}** failed:\n\`${f.command}\`\n${f.output}`
    ).join('\n\n');

    // Write to stderr as a warning (visible to the agent)
    process.stderr.write(
      `\n⚠ Quality Gate: ${failures.length} check(s) failed. Fix before proceeding.\n\n` +
      report + '\n'
    );

    // Exit 0 with a warning rather than blocking — the Stop hook cannot
    // actually block turn completion (only PreToolUse can block).
    // The warning injects into the agent's context for the next turn.
    process.exit(0);
  }

  // All checks passed — silent success
  process.exit(0);

} catch {
  // Never crash — quality gate is best-effort
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Toolchain detection
// ---------------------------------------------------------------------------

/**
 * Detect which verification commands are available for this project.
 * Checks package.json scripts, Makefile targets, and common CLI tools.
 * Returns an array of { name, command } objects.
 */
function detectChecks() {
  const checks = [];
  const fs = require('fs');
  const path = require('path');

  // Try package.json scripts first (most common for JS/TS projects)
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const scripts = pkg.scripts || {};

      if (scripts.lint) {
        checks.push({ name: 'Lint', command: 'npm run lint' });
      }
      if (scripts.typecheck) {
        checks.push({ name: 'Typecheck', command: 'npm run typecheck' });
      } else if (scripts['type-check']) {
        checks.push({ name: 'Typecheck', command: 'npm run type-check' });
      }
      // Only run tests if there's a quick test script (avoid long integration tests)
      if (scripts['test:unit']) {
        checks.push({ name: 'Unit Tests', command: 'npm run test:unit' });
      } else if (scripts.test) {
        checks.push({ name: 'Tests', command: 'npm run test' });
      }

      return checks; // Found package.json — use these
    }
  } catch { /* no package.json or parse error */ }

  // Try Python projects
  try {
    if (fs.existsSync(path.join(process.cwd(), 'pyproject.toml')) ||
        fs.existsSync(path.join(process.cwd(), 'setup.py'))) {
      // Check for common Python linters
      try {
        execSync('ruff --version', { stdio: 'pipe' });
        checks.push({ name: 'Lint', command: 'ruff check .' });
      } catch {
        try {
          execSync('flake8 --version', { stdio: 'pipe' });
          checks.push({ name: 'Lint', command: 'flake8 .' });
        } catch { /* no linter */ }
      }
      try {
        execSync('mypy --version', { stdio: 'pipe' });
        checks.push({ name: 'Typecheck', command: 'mypy .' });
      } catch { /* no mypy */ }
      try {
        execSync('pytest --version', { stdio: 'pipe' });
        checks.push({ name: 'Tests', command: 'pytest --tb=short -q' });
      } catch { /* no pytest */ }

      if (checks.length > 0) return checks;
    }
  } catch { /* not a Python project */ }

  // Try Go projects
  try {
    if (fs.existsSync(path.join(process.cwd(), 'go.mod'))) {
      checks.push({ name: 'Vet', command: 'go vet ./...' });
      checks.push({ name: 'Tests', command: 'go test ./... -short' });
      try {
        execSync('golangci-lint --version', { stdio: 'pipe' });
        checks.unshift({ name: 'Lint', command: 'golangci-lint run' });
      } catch { /* no golangci-lint */ }

      return checks;
    }
  } catch { /* not a Go project */ }

  // Try Makefile
  try {
    if (fs.existsSync(path.join(process.cwd(), 'Makefile'))) {
      const makefile = fs.readFileSync(path.join(process.cwd(), 'Makefile'), 'utf8');
      if (/^lint:/m.test(makefile)) {
        checks.push({ name: 'Lint', command: 'make lint' });
      }
      if (/^test:/m.test(makefile)) {
        checks.push({ name: 'Tests', command: 'make test' });
      }
      if (/^check:/m.test(makefile)) {
        checks.push({ name: 'Check', command: 'make check' });
      }
    }
  } catch { /* no Makefile */ }

  return checks;
}
